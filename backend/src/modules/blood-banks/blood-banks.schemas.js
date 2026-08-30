'use strict';
const { z } = require('zod');
const text=(min,max)=>z.string().trim().min(min).max(max); const nullable=(max)=>z.union([text(1,max),z.literal(''),z.null()]).transform(v=>v||null).optional(); const coord=(min,max)=>z.union([z.number().min(min).max(max),z.null()]).optional();
const fields={name:text(1,160),licenseNo:text(1,100),contactName:text(1,120),contactPhone:z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/),address:text(1,300),city:text(1,100),locality:nullable(120),pinCode:z.union([z.string().trim().regex(/^[1-9][0-9]{5}$/),z.literal(''),z.null()]).transform(v=>v||null).optional(),latitude:coord(-90,90),longitude:coord(-180,180)};
const createProfileSchema=z.object(fields).strict(); const updateProfileSchema=z.object(fields).partial().strict().refine(v=>Object.keys(v).length>0,'At least one field is required'); module.exports={createProfileSchema,updateProfileSchema};
