'use strict';
const {sendSuccess}=require('../../core/response'); const service=require('./hospitals.service');
function handler(method,status=200){return (req,res,next)=>{try{return sendSuccess(res,service[method](req.user.id,req.validated),status);}catch(e){return next(e);}};}
module.exports={create:handler('create',201),get:handler('get'),update:handler('update')};
