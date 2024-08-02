const { Joi } = require('../../../../app/src/infrastructure/Validation')
const { ObjectId } = require('mongodb-legacy')
const { expect } = require('chai')
const { ValidationError } = require('joi')

describe('Validation', function () {
  const validObjectId = '123456781234567812345678'
  const invalidObjectId = '12345678-1234-1234-12345678'

  it('accepts valid ObjectId strings', async function () {
    const schema = Joi.object({
      test: Joi.objectId(),
    })

    const value = await schema.validateAsync({
      test: validObjectId,
    })

    expect(value.test).to.be.instanceof(ObjectId)
    expect(value.test.toHexString()).to.equal(validObjectId)
  })

  it('rejects invalid ObjectId strings', async function () {
    const schema = Joi.object({
      test: Joi.objectId(),
    })

    const promise = schema.validateAsync({
      test: invalidObjectId,
    })

    expect(promise).to.be.rejectedWith(ValidationError)
  })

  it('accepts valid ObjectId objects', async function () {
    const schema = Joi.object({
      test: Joi.objectId(),
    })

    const value = await schema.validateAsync({
      test: new ObjectId(validObjectId),
    })

    expect(value.test).to.be.instanceof(ObjectId)
    expect(value.test.toHexString()).to.equal(validObjectId)
  })
})
