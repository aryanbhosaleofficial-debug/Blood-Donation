'use strict';require('../helpers/env');const{test}=require('node:test');const assert=require('node:assert/strict');const{pledgeCapacity,ACTIVE_PLEDGE_STATUSES}=require('../../src/modules/pledges/pledges.constants');
test('pledge capacity is units needed plus configured backup slots',()=>{assert.equal(pledgeCapacity(2,0),2);assert.equal(pledgeCapacity(2,1),3);assert.equal(pledgeCapacity(4,undefined),4);});
test('only PLEDGED and ARRIVED consume active coordination slots',()=>assert.deepEqual(ACTIVE_PLEDGE_STATUSES,['PLEDGED','ARRIVED']));
