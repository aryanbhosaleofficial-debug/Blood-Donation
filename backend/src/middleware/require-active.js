'use strict';
const { UnauthorizedError, ForbiddenError } = require('../core/errors');
const usersService = require('../modules/users/users.service');
function requireActive(req,res,next){try{const sessionUser=req.session&&req.session.user;if(!sessionUser)throw new UnauthorizedError();const current=usersService.findById(sessionUser.id);if(!current||!usersService.isActive(current)){req.session.destroy(()=>{});throw new ForbiddenError('This account is inactive.',{code:'ACCOUNT_INACTIVE'});}req.user=usersService.toSessionUser(current);req.session.user=req.user;return next();}catch(e){return next(e);}}
module.exports={requireActive};
