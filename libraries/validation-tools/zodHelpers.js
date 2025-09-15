const { z } = require('zod')
const mongodb = require('mongodb')

const { ObjectId } = mongodb

const zz = {
  objectId: () =>
    z.string().refine(ObjectId.isValid, { message: 'invalid Mongo ObjectId' }),
  coercedObjectId: () =>
    z
      .string()
      .refine(ObjectId.isValid, { message: 'invalid Mongo ObjectId' })
      .transform(val => new ObjectId(val)),
  hex: () => z.string().regex(/^[0-9a-f]*$/),
}

module.exports = { zz }
