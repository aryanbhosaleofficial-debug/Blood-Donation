'use strict';require('../helpers/env');const{test}=require('node:test');const assert=require('node:assert/strict');const{requireState}=require('../../src/modules/pledges/pledges.policy');
test('PLEDGED may perform donor-controlled transitions',()=>assert.equal(requireState({status:'PLEDGED'},['PLEDGED']).status,'PLEDGED'));
test('terminal/deferred pledge states cannot transition backwards',()=>{for(const status of['ARRIVED','CANCELLED','DEFERRED','EXPIRED','CLOSED'])assert.throws(()=>requireState({status},['PLEDGED']),err=>err.code==='INVALID_PLEDGE_STATE');});
