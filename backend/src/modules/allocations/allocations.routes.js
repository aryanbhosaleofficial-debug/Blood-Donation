'use strict';
const router=require('express').Router();const{requireRole}=require('../../middleware/require-role');const{requireVerified}=require('../../middleware/require-verified');const{validate}=require('../../middleware/validate');const{ROLES}=require('../../core/constants');const schemas=require('./allocations.schemas');const c=require('./allocations.controller');
router.use(requireRole(ROLES.BLOOD_BANK),requireVerified);
const capture=(key)=>(req,res,next)=>{req[key]=req.validated[key];next();};
router.post('/:allocationId/release',validate(schemas.allocationIdParamSchema,'params'),capture('allocationId'),validate(schemas.emptyBodySchema),c.release);
router.post('/:allocationId/complete',validate(schemas.allocationIdParamSchema,'params'),capture('allocationId'),validate(schemas.emptyBodySchema),c.complete);
module.exports=router;
