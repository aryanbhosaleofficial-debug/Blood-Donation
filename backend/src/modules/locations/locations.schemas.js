'use strict';

const { z } = require('zod');

const pledgeIdParamSchema = z.object({ pledgeId: z.coerce.number().int().positive() }).strict();
const locationSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
}).strict();

module.exports = { pledgeIdParamSchema, locationSchema };
