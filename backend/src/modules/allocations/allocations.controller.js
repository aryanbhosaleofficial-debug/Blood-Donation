'use strict';
const {sendSuccess}=require('../../core/response');const service=require('./allocations.service');
function allocate(req,res,next){try{return sendSuccess(res,service.allocate(req.user,req.requestId??req.validated.requestId),201);}catch(e){return next(e);}}
function hospitalList(req,res,next){try{return sendSuccess(res,service.listForHospitalRequest(req.user,req.validated.requestId));}catch(e){return next(e);}}
function bankList(req,res,next){try{return sendSuccess(res,service.listForBank(req.user));}catch(e){return next(e);}}
function action(method){return(req,res,next)=>{try{return sendSuccess(res,service[method](req.user,req.allocationId??req.validated.allocationId));}catch(e){return next(e);}};}
module.exports={allocate,hospitalList,bankList,release:action('release'),complete:action('complete')};
