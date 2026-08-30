'use strict';

const { z } = require('zod');

const alertIdParamSchema = z.object({ alertId: z.coerce.number().int().positive() }).strict();
const pledgeIdParamSchema = z.object({ pledgeId: z.coerce.number().int().positive() }).strict();
const requestIdParamSchema = z.object({ requestId: z.coerce.number().int().positive() }).strict();
const emptyBodySchema = z.object({}).strict();

module.exports = { alertIdParamSchema, pledgeIdParamSchema, requestIdParamSchema, emptyBodySchema };
