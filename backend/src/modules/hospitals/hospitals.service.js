'use strict';
const { ConflictError, NotFoundError } = require('../../core/errors');
const repo = require('./hospitals.repository'); const policy = require('./hospitals.policy'); const serializer = require('./hospitals.serializer');
function sqliteConflict(err, code) { if (err && err.code && err.code.startsWith('SQLITE_CONSTRAINT')) throw new ConflictError('Organization identity is already in use.', {code}); throw err; }
function create(userId, d) { if (repo.findByUserId(userId)) throw new ConflictError('Profile already exists.', {code:'PROFILE_ALREADY_EXISTS'}); const normalized={...d,locality:d.locality??null,pinCode:d.pinCode??null,latitude:d.latitude??null,longitude:d.longitude??null}; try { return serializer.serialize(repo.insert(userId,normalized)); } catch(e) { return sqliteConflict(e,'REGISTRATION_REFERENCE_TAKEN'); } }
function get(userId) { const row=repo.findByUserId(userId); if(!row) throw new NotFoundError('Hospital profile not found.',{code:'PROFILE_NOT_FOUND'}); return serializer.serialize(row); }
function update(userId,d) { const row=repo.findByUserId(userId); if(!row) throw new NotFoundError('Hospital profile not found.',{code:'PROFILE_NOT_FOUND'}); policy.assertIdentityEditable(row,d); try{return serializer.serialize(repo.update(userId,d));}catch(e){return sqliteConflict(e,'REGISTRATION_REFERENCE_TAKEN');} }
module.exports={create,get,update};
