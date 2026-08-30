'use strict';require('../helpers/env');const{test}=require('node:test');const assert=require('node:assert/strict');const{remainingUnits,reservableUnits}=require('../../src/modules/allocations/allocations.constants');
test('remaining units are derived and never negative',()=>{assert.equal(remainingUnits(5,2),3);assert.equal(remainingUnits(5,5),0);assert.equal(remainingUnits(5,8),0);});
test('automatic reservation is limited by remaining need and stock',()=>{assert.equal(reservableUnits(3,5),3);assert.equal(reservableUnits(5,2),2);assert.equal(reservableUnits(0,5),0);});
