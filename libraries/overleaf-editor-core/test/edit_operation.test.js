const { expect } = require('chai')
const EditOperationBuilder = require('../lib/operation/edit_operation_builder')
const TextOperation = require('../lib/operation/text_operation')
const EditOperationTransformer = require('../lib/operation/edit_operation_transformer')
const EditOperation = require('../lib/operation/edit_operation')
const randomTextOperation = require('./support/random_text_operation')
const random = require('./support/random')

describe('EditOperation', function () {
  it('Cannot be instantiated', function () {
    expect(() => new EditOperation()).to.throw(
      'Cannot instantiate abstract class'
    )
  })
})

describe('EditOperationTransformer', function () {
  it('Transforms two TextOperations', function () {
    const a = new TextOperation().insert('foo')
    const b = new TextOperation().insert('bar')
    const [aPrime, bPrime] = EditOperationTransformer.transform(a, b)
    expect(aPrime).to.be.an.instanceof(TextOperation)
    expect(bPrime).to.be.an.instanceof(TextOperation)
  })
})

describe('EditOperationBuilder', function () {
  it('Constructs TextOperation from JSON', function () {
    const raw = {
      textOperation: [1, 'foo', 3],
    }
    const op = EditOperationBuilder.fromJSON(raw)
    expect(op).to.be.an.instanceof(TextOperation)
    expect(op.toJSON()).to.deep.equal(raw)
  })

  it('Throws error for unsupported operation', function () {
    const raw = {
      unsupportedOperation: {
        op: 'foo',
      },
    }
    expect(() => EditOperationBuilder.fromJSON(raw)).to.throw(
      'Unsupported operation in EditOperationBuilder.fromJSON'
    )
  })

  it('Constructs TextOperation from JSON (randomised)', function () {
    const str = random.string(50)
    const randomOperation = randomTextOperation(str)
    const op = EditOperationBuilder.fromJSON(randomOperation.toJSON())
    expect(op).to.be.an.instanceof(TextOperation)
    expect(op.equals(randomOperation)).to.be.true
  })
})
