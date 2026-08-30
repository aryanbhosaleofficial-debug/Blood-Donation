'use strict';

/**
 * modules/broadcasts/broadcasts.serializer
 *
 * Broadcast rows are internal coordination records. The hospital view exposes
 * only a summary (how many banks were notified); individual bank identities are
 * not disclosed to the hospital in Module 03.
 */

function summary(rows) {
  return {
    bankCount: rows.length,
    statuses: rows.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {}),
  };
}

module.exports = { summary };
