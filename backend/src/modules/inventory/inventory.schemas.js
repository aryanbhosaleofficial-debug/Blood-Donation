'use strict'; const {z}=require('zod');const config=require('../../core/config');
const inventoryIdSchema=z.object({inventoryId:z.coerce.number().int().positive()}).strict();
const updateInventorySchema=z.object({unitsAvailable:z.number().int().min(0).max(config.inventoryMaxUnits),expectedVersion:z.number().int().min(0),reason:z.string().trim().min(1).max(300),component:z.literal('RED_CELLS').optional()}).strict();module.exports={inventoryIdSchema,updateInventorySchema};
