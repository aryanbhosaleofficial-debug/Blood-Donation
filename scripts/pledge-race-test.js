'use strict';

// Isolated viva/demo race: generated test-only credentials, temporary SQLite,
// real HTTP sessions/CSRF, and no production data or secrets.
require('../backend/tests/helpers/env');

const crypto = require('node:crypto');
const { startTestServer, loginAs, ORIGIN } = require('../backend/tests/helpers/server');
const { createHospital, createDonor, requestPayload } = require('../backend/tests/helpers/orgs');
const { getDb, closeDatabase } = require('../backend/src/core/database');

const write = (token) => ({ headers: { Origin: ORIGIN, 'X-CSRF-Token': token } });

async function main() {
  const server = await startTestServer();
  try {
    const password = crypto.randomBytes(18).toString('base64url');
    const tag = crypto.randomUUID();
    const hospital = await createHospital({ email: `pledge-race-h-${tag}@example.test`, password, city: `Race${tag}`, locality: 'Race' });
    const donors = [];
    for (let index = 0; index < 5; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      donors.push(await createDonor({ email: `pledge-race-d-${index}-${tag}@example.test`, password, city: `Race${tag}`, locality: 'Race' }));
    }
    const hospitalClient = server.client();
    const hospitalToken = await loginAs(hospitalClient, hospital.user);
    const created = await hospitalClient.post('/api/requests', requestPayload({ unitsNeeded: 2 }), write(hospitalToken));
    const requestId = created.json.data.request.id;
    await hospitalClient.post(`/api/requests/${requestId}/donor-fallback`, {}, write(hospitalToken));
    const alerts = getDb().prepare('SELECT id,donor_id FROM donor_alerts WHERE request_id=? ORDER BY donor_id').all(requestId);
    const actors = [];
    for (let index = 0; index < donors.length; index += 1) {
      const client = server.client();
      // eslint-disable-next-line no-await-in-loop
      const token = await loginAs(client, donors[index].user);
      actors.push({ client, token, alertId: alerts[index].id });
    }
    const results = await Promise.all(actors.map((actor) => actor.client.post(`/api/donor/alerts/${actor.alertId}/pledge`, {}, write(actor.token))));
    results.forEach((result, index) => console.log(`Potential donor ${index + 1}: HTTP ${result.status} ${result.json?.error?.code || 'PLEDGED'}`));
    const active = getDb().prepare("SELECT COUNT(*) n FROM donor_pledges WHERE request_id=? AND status IN('PLEDGED','ARRIVED')").get(requestId).n;
    console.log(`Final pledge capacity=2, active pledges=${active}`);
    if (active !== 2 || results.filter((result) => result.status === 201).length !== 2) throw new Error('Pledge race invariant failed');
    console.log('PASS: active potential-donor pledges did not exceed capacity.');
  } finally {
    await server.close();
    closeDatabase();
  }
}

main().catch((err) => { console.error(err.message); process.exitCode = 1; });
