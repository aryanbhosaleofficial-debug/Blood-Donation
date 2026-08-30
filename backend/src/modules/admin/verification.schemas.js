'use strict';const {z}=require('zod');const userIdSchema=z.object({userId:z.coerce.number().int().positive()}).strict();module.exports={userIdSchema};
