'use strict';
const{z}=require('zod');const{BLOOD_GROUPS,AVAILABILITY_VALUES}=require('./donors.constants');
const text=(min,max)=>z.string().trim().min(min).max(max);const nullable=(schema)=>z.union([schema,z.literal(''),z.null()]).transform(v=>v||null).optional();const coord=(min,max)=>z.union([z.number().min(min).max(max),z.null()]).optional();
const dateOnly=z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(`${v}T00:00:00Z`)),'Invalid date');
const instant=z.string().datetime({offset:true});
const fields={displayName:text(1,120),bloodGroup:z.enum(BLOOD_GROUPS),phone:nullable(z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/)),email:nullable(z.string().trim().email().max(254)),city:text(1,100),locality:nullable(text(1,120)),pinCode:nullable(z.string().trim().regex(/^[1-9][0-9]{5}$/)),approxLatitude:coord(-90,90),approxLongitude:coord(-180,180),lastDonationDate:nullable(dateOnly),nextContactAfter:nullable(instant)};
const createProfileSchema=z.object(fields).strict();const updateProfileSchema=z.object(fields).partial().strict().refine(v=>Object.keys(v).length>0,'At least one field is required');const availabilitySchema=z.object({status:z.enum(AVAILABILITY_VALUES)}).strict();
module.exports={createProfileSchema,updateProfileSchema,availabilitySchema};
