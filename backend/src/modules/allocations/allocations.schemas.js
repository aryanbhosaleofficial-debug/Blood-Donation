'use strict';

const { z } = require('zod');

const requestIdParamSchema = z.object({ requestId: z.coerce.number().int().positive() }).strict();
const allocationIdParamSchema = z.object({ allocationId: z.coerce.number().int().positive() }).strict();
const emptyBodySchema = z.object({}).strict();

module.exports = { requestIdParamSchema, allocationIdParamSchema, emptyBodySchema };
