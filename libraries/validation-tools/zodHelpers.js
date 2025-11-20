const { z } = require('zod')
const mongodb = require('mongodb')

const { ObjectId } = mongodb

const dateWithTransform = (schema, allowNull = false) => {
  return schema.transform(dt => {
    if (allowNull && !dt) return null
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
  datetime: () => dateWithTransform(z.union([z.iso.datetime(), z.date()])),
  datetimeNullable: () =>
    dateWithTransform(z.union([z.iso.datetime(), z.date(), z.null()]), true),
  datetimeNullish: () =>
    dateWithTransform(
      z.union([z.iso.datetime(), z.date(), z.null(), z.undefined()]),
      true
    ),
}

module.exports = { zz }
