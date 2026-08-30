'use strict';

// Exact coordinates deliberately have no serializer and never leave the server.
function serializeLocationForDonorSelf(row, now = Date.now()) {
  const active = Boolean(row) && Number.isFinite(Date.parse(row.expires_at)) && Date.parse(row.expires_at) > now;
  return {
    isSharing: active,
    expiresAt: active ? row.expires_at : null,
    updatedAt: row ? row.updated_at : null,
  };
}

module.exports = { serializeLocationForDonorSelf };
