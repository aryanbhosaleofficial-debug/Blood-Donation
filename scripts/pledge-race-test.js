'use strict';

/**
 * Donor-pledge concurrency race (viva/demo proof).
 *
 * Isolated: generated test-only credentials, temporary SQLite, real HTTP
 * sessions/CSRF, no production data or secrets.
 *
 *   npm run pledge-race-test
 *   node scripts/pledge-race-test.js --rounds 10
 *
 * Invariant: active pledges (PLEDGED|ARRIVED) never exceed capacity
 * (units_needed + backup_slots). Also checks slot release: after one pledged
 * donor cancels, a waiting donor can pledge. Exit 0 on success.
 */

require('../backend/tests/helpers/env');

const crypto = require('node:crypto');
const { startTestServer, loginAs, ORIGIN } = require('../backend/tests/helpers/server');
const { createHospital, createDonor, requestPayload } = require('../backend/tests/helpers/orgs');
const { getDb, closeDatabase } = require('../backend/src/core/database');

const write = (token) => ({ headers: { Origin: ORIGIN, 'X-CSRF-Token': token } });
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i !== -1 ? Number(process.argv[i + 1]) : fallback;
};

async function runRound(server, round) {
  const password = crypto.randomBytes(18).toString('base64url');
  const tag = crypto.randomUUID();
  const city = `Race${tag}`;
  const hospital = await createHospital({ email: `pledge-race-h-${tag}@example.test`, password, city, locality: 'Race' });
  const donors = [];
  for (let i = 0; i < 6; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    donors.push(await createDonor({ email: `pledge-race-d-${i}-${tag}@example.test`, password, city, locality: 'Race' }));
  }

  const hc = server.client();
  const ht = await loginAs(hc, hospital.user);
  const created = await hc.post('/api/requests', requestPayload({ unitsNeeded: 2 }), write(ht));
  const requestId = created.json.data.request.id;
  await hc.post(`/api/requests/${requestId}/donor-fallback`, {}, write(ht));

  const alerts = getDb().prepare('SELECT id,donor_id FROM donor_alerts WHERE request_id=? ORDER BY donor_id').all(requestId);
  const actors = [];
  for (let i = 0; i < donors.length; i += 1) {
    const client = server.client();
    // eslint-disable-next-line no-await-in-loop
    const token = await loginAs(client, donors[i].user);
    const alert = alerts.find((a) => a.donor_id === donors[i].donor.id);
    actors.push({ client, token, alertId: alert ? alert.id : null });
  }

  // 5 donors race for capacity 2.
  const racers = actors.slice(0, 5).filter((a) => a.alertId);
  const results = await Promise.all(racers.map((a) => a.client.post(`/api/donor/alerts/${a.alertId}/pledge`, {}, write(a.token))));
  const db = getDb();
  const active1 = db.prepare("SELECT COUNT(*) n FROM donor_pledges WHERE request_id=? AND status IN('PLEDGED','ARRIVED')").get(requestId).n;
  const ok201 = results.filter((r) => r.status === 201).length;
  if (active1 > 2 || ok201 !== 2) throw new Error(`capacity breached: active=${active1}, 201s=${ok201}`);

  // Slot release: one pledged donor cancels, the 6th donor can now pledge.
  const pledged = db.prepare("SELECT p.id, d.user_id FROM donor_pledges p JOIN donors d ON d.id=p.donor_id WHERE p.request_id=? AND p.status='PLEDGED' LIMIT 1").get(requestId);
  const pledgedActor = actors.find((a, i) => donors[i].donor.user_id === pledged.user_id) || actors[0];
  const donorPledge = db.prepare('SELECT id FROM donor_pledges WHERE request_id=? AND donor_id=(SELECT id FROM donors WHERE user_id=?)').get(requestId, pledged.user_id);
  await pledgedActor.client.post(`/api/donor/pledges/${donorPledge.id}/cancel`, {}, write(pledgedActor.token));

  const sixth = actors[5];
  let released = 'n/a';
  if (sixth && sixth.alertId) {
    const r = await sixth.client.post(`/api/donor/alerts/${sixth.alertId}/pledge`, {}, write(sixth.token));
    released = r.status === 201 ? 'PASS' : `FAIL(${r.status})`;
    if (r.status !== 201) throw new Error(`slot release failed: HTTP ${r.status}`);
  }
  const active2 = db.prepare("SELECT COUNT(*) n FROM donor_pledges WHERE request_id=? AND status IN('PLEDGED','ARRIVED')").get(requestId).n;
  if (active2 > 2) throw new Error(`capacity breached after release: active=${active2}`);

  console.log(`  Round ${round}: race active=${active1} (201s=${ok201}), after cancel+repledge active=${active2}, slot-release=${released} -> PASS`);
}

async function main() {
  const rounds = arg('--rounds', 1);
  const server = await startTestServer();
  try {
    for (let round = 1; round <= rounds; round += 1) {
      // eslint-disable-next-line no-await-in-loop
      await runRound(server, round);
    }
    console.log(`\nPASS: ${rounds} round(s), active potential-donor pledges never exceeded capacity.`);
  } finally {
    await server.close();
    closeDatabase();
  }
}

main().catch((err) => { console.error('FAIL:', err.message); process.exitCode = 1; });
