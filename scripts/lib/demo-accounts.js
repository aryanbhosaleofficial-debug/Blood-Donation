'use strict';

/**
 * scripts/lib/demo-accounts
 *
 * The deterministic demo account catalogue — PURE DATA, no native / heavy
 * requires (so read-only scripts like verify-demo.js don't load bcrypt).
 *
 * DEMO ONLY. Every address is @example.test; nothing here is a real credential
 * or a real person's contact detail.
 */

const ADMIN = { email: 'admin.demo@example.test', role: 'ADMIN' };
const HOSPITAL_EMAIL = 'hospital.demo@example.test';

const BANK_EMAILS = ['bank1.demo@example.test', 'bank2.demo@example.test', 'bank3.demo@example.test'];
const DONOR_EMAILS = [
  'donor1.demo@example.test', 'donor2.demo@example.test', 'donor3.demo@example.test',
  'donor4.demo@example.test', 'donor5.demo@example.test',
];
const SURGE_HOSPITAL_EMAILS = [
  'surge.hospital1.demo@example.test', 'surge.hospital2.demo@example.test', 'surge.hospital3.demo@example.test',
];

const DEMO_ACCOUNTS = [
  { email: ADMIN.email, role: 'ADMIN' },
  { email: HOSPITAL_EMAIL, role: 'HOSPITAL' },
  ...BANK_EMAILS.map((email) => ({ email, role: 'BLOOD_BANK' })),
  ...DONOR_EMAILS.map((email) => ({ email, role: 'DONOR' })),
];

const SURGE_CITY = 'Ahmedabad';
const SURGE_REQUEST_COUNT = 8;

module.exports = {
  ADMIN, HOSPITAL_EMAIL, BANK_EMAILS, DONOR_EMAILS, SURGE_HOSPITAL_EMAILS,
  DEMO_ACCOUNTS, SURGE_CITY, SURGE_REQUEST_COUNT,
};
