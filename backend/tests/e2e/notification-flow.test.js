'use strict';

/**
 * E2E E — domain event → QUEUED outbox row → worker → SENT → user reads it.
 *
 * Proves the Module 07 transactional outbox + worker + IN_APP provider chain
 * works end to end over HTTP, and that read state is separate from delivery.
 */

require('../helpers/env');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, loginAs, ORIGIN } = require('../helpers/server');
const { createHospital, createBank, requestPayload } = require('../helpers/orgs');
const { getDb, closeDatabase } = require('../../src/core/database');

let srv;
const write = (t) => ({ headers: { Origin: ORIGIN, 'X-CSRF-Token': t } });
before(async () => { srv = await startTestServer(); });
after(async () => { await srv.close(); closeDatabase(); });
async function loggedIn(user) { const client = srv.client(); const token = await loginAs(client, user); return { client, token }; }

test('E2E E: broadcast → QUEUED → worker delivers → SENT → bank reads → read_at set', async () => {
  const db = getDb();
  const bank = await createBank({ email: 'e2e-e-bank@example.test' });
  const hospital = await createHospital({ email: 'e2e-e-hospital@example.test' });
  const h = await loggedIn(hospital.user);

  const created = await h.client.post('/api/requests', requestPayload({ unitsNeeded: 1 }), write(h.token));
  assert.equal(created.status, 201);

  // A REQUEST_BROADCAST_RECEIVED notification was queued for the bank inside
  // the create transaction (never delivered from inside it).
  const queued = db.prepare("SELECT * FROM notifications WHERE recipient_user_id=? AND event_type='REQUEST_BROADCAST_RECEIVED'").get(bank.user.id);
  assert.ok(queued);
  assert.equal(queued.status, 'QUEUED');
  assert.equal(queued.read_at, null);

  // Worker delivers it.
  // eslint-disable-next-line global-require
  const stats = require('../../src/modules/notifications/notification-worker.service').processBatch();
  assert.ok(stats.sent >= 1);
  const afterWorker = db.prepare('SELECT status, read_at FROM notifications WHERE id=?').get(queued.id);
  assert.equal(afterWorker.status, 'SENT');
  assert.equal(afterWorker.read_at, null); // delivery != read

  // Bank lists notifications over HTTP and marks it read.
  const b = await loggedIn(bank.user);
  const list = await b.client.get('/api/notifications', write(b.token));
  assert.equal(list.status, 200);
  assert.ok(list.json.data.notifications.some((n) => n.id === queued.id));

  const unreadBefore = await b.client.get('/api/notifications/unread-count', write(b.token));
  assert.ok(unreadBefore.json.data.count >= 1);

  const read = await b.client.post(`/api/notifications/${queued.id}/read`, {}, write(b.token));
  assert.equal(read.status, 200);
  assert.ok(db.prepare('SELECT read_at FROM notifications WHERE id=?').get(queued.id).read_at);

  // Notification payloads carry no secrets / donor contact.
  const blob = JSON.stringify(list.json).toLowerCase();
  for (const leak of ['password', 'csrf', 'session', 'phone', 'latitude', 'longitude']) {
    assert.ok(!blob.includes(leak), `notification list must not leak ${leak}`);
  }
});
