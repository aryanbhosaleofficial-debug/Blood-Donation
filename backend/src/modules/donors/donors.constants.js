'use strict';
const { BLOOD_GROUPS } = require('../../core/constants');
const AVAILABILITY=Object.freeze({AVAILABLE:'AVAILABLE',UNAVAILABLE:'UNAVAILABLE',UNKNOWN:'UNKNOWN'});
const AVAILABILITY_VALUES=Object.freeze(Object.values(AVAILABILITY));
module.exports={BLOOD_GROUPS,AVAILABILITY,AVAILABILITY_VALUES};
