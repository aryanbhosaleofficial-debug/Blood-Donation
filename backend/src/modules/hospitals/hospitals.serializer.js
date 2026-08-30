'use strict';
const { toBoolean } = require('../users/users.serializer');
function serialize(row) {
  if (!row) return null;
  return { id: row.id, name: row.name, registrationReference: row.registration_reference,
    contactName: row.contact_name, contactPhone: row.contact_phone, address: row.address,
    city: row.city, locality: row.locality, pinCode: row.pin_code, latitude: row.latitude,
    longitude: row.longitude, isVerified: toBoolean(row.is_verified), verifiedAt: row.verified_at,
    verifiedByUserId: row.verified_by_user_id, createdAt: row.created_at, updatedAt: row.updated_at };
}
module.exports = { serialize };
