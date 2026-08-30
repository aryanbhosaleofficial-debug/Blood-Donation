'use strict';
const router=require('express').Router(); const {requireRole}=require('../../middleware/require-role'); const {validate}=require('../../middleware/validate'); const {ROLES}=require('../../core/constants'); const schemas=require('./hospitals.schemas'); const c=require('./hospitals.controller');
router.use(requireRole(ROLES.HOSPITAL)); router.post('/profile',validate(schemas.createProfileSchema),c.create); router.get('/profile',c.get); router.patch('/profile',validate(schemas.updateProfileSchema),c.update); module.exports=router;
