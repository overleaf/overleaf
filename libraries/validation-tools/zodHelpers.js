const { z } = require('zod')
const mongodb = require('mongodb')

const { ObjectId } = mongodb

/**
 * @import { DatetimeSchemaOptions } from './types'
 */

/**
 * @param {DatetimeSchemaOptions} options
 */
const datetimeSchema = ({ allowNull, allowUndefined, ...zodOptions } = {}) => {
  const union = [z.date(), z.iso.datetime(zodOptions)]
  if (allowNull) union.push(z.null())
  if (allowUndefined) union.push(z.undefined())
  return z.union(union).transform(dt => {
    if (allowNull && !dt) return dt === null ? null : undefined
    return dt instanceof Date ? dt : new Date(dt)
  })
}

const zz = {
  objectId: () =>
    z.string().refine(ObjectId.isValid, { message: 'invalid Mongo ObjectId' }),
  coercedObjectId: () =>
    z
      .string()
      .refine(ObjectId.isValid, { message: 'invalid Mongo ObjectId' })
      .transform(val => new ObjectId(val)),
  hex: () => z.string().regex(/^[0-9a-f]*$/),
  datetime: options => datetimeSchema(options),
  datetimeNullable: options => datetimeSchema({ ...options, allowNull: true }),
  datetimeNullish: options =>
    datetimeSchema({ ...options, allowNull: true, allowUndefined: true }),
}

module.exports = { zz }
