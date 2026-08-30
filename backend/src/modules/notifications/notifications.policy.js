'use strict';

/**
 * modules/notifications/notifications.policy
 *
 * Ownership and access policy for notifications.
 */

const { NotFoundError } = require('../../core/errors');

/**
 * Assert that the notification belongs to the requesting user.
 * Returns the notification or throws 404 (concealed-resource pattern).
 */
function assertOwned(row, recipientUserId) {
  if (!row || row.recipient_user_id !== recipientUserId) {
    throw new NotFoundError('Notification not found.', { code: 'NOTIFICATION_NOT_FOUND' });
  }
  return row;
}

module.exports = { assertOwned };
