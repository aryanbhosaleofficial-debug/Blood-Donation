'use strict';

/**
 * modules/notifications/providers/in-app.provider
 *
 * IN_APP provider: no network, no I/O. The persisted notification row IS
 * the delivery mechanism -- once the worker marks it SENT it is available
 * through the notification REST APIs.
 *
 * This provider works fully offline and never fails.
 */

class InAppProvider {
  get channel() { return 'IN_APP'; }

  send(_notification) {
    // Accepting immediately: the row's existence in the DB is the delivery.
    return { accepted: true, providerMessageId: null };
  }
}

module.exports = new InAppProvider();
