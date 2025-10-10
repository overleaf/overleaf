const { expect } = require('chai')
const EditOperationBuilder = require('../../lib/operation/edit_operation_builder')
const TextOperation = require('../../lib/operation/text_operation')
const EditOperationTransformer = require('../../lib/operation/edit_operation_transformer')
const EditOperation = require('../../lib/operation/edit_operation')
const randomTextOperation = require('./support/random_text_operation')
const random = require('./support/random')
const AddCommentOperation = require('../../lib/operation/add_comment_operation')
const DeleteCommentOperation = require('../../lib/operation/delete_comment_operation')
const SetCommentStateOperation = require('../../lib/operation/set_comment_state_operation')
const Range = require('../../lib/range')
const EditNoOperation = require('../../lib/operation/edit_no_operation')

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

  it('Transforms TextOperation and EditNoOperation', function () {
    const a = new TextOperation().insert('foo')
    const b = new EditNoOperation()
    const [aPrime, bPrime] = EditOperationTransformer.transform(a, b)
    expect(aPrime).to.be.an.instanceof(TextOperation)
    expect(bPrime).to.be.an.instanceof(EditNoOperation)
  })

  it('Transforms two AddCommentOperations with same commentId', function () {
    const a = new AddCommentOperation('comm1', [new Range(0, 1)])
    const b = new AddCommentOperation('comm1', [new Range(2, 3)])
    const [aPrime, bPrime] = EditOperationTransformer.transform(a, b)
    expect(aPrime).to.be.an.instanceof(EditNoOperation)
    expect(bPrime).to.be.an.instanceof(AddCommentOperation)
  })

  it('Transforms two AddCommentOperations with different commentId', function () {
    const a = new AddCommentOperation('comm1', [new Range(0, 1)])
    const b = new AddCommentOperation('comm2', [new Range(2, 3)])
    const [aPrime, bPrime] = EditOperationTransformer.transform(a, b)
    expect(aPrime).to.be.an.instanceof(AddCommentOperation)
    expect(aPrime.toJSON()).to.eql(a.toJSON())
    expect(bPrime).to.be.an.instanceof(AddCommentOperation)
    expect(bPrime.toJSON()).to.eql(b.toJSON())
  })

  it('Transforms two DeleteCommentOperations with same commentId', function () {
    const a = new DeleteCommentOperation('comm1')
    const b = new DeleteCommentOperation('comm1')
    const [aPrime, bPrime] = EditOperationTransformer.transform(a, b)
    expect(aPrime).to.be.an.instanceof(EditNoOperation)
    expect(bPrime).to.be.an.instanceof(EditNoOperation)
  })

  it('Transforms two DeleteCommentOperations with different commentId', function () {
    const a = new DeleteCommentOperation('comm1')
    const b = new DeleteCommentOperation('comm2')
    const [aPrime, bPrime] = EditOperationTransformer.transform(a, b)
    expect(aPrime).to.be.an.instanceof(DeleteCommentOperation)
    expect(aPrime.toJSON()).to.eql(a.toJSON())
    expect(bPrime).to.be.an.instanceof(DeleteCommentOperation)
    expect(bPrime.toJSON()).to.eql(b.toJSON())
  })

  it('Transforms AddCommentOperation and DeleteCommentOperation with same commentId', function () {
    const a = new AddCommentOperation('comm1', [new Range(0, 1)])
    const b = new DeleteCommentOperation('comm1')
    const [aPrime, bPrime] = EditOperationTransformer.transform(a, b)
    expect(aPrime).to.be.an.instanceof(EditNoOperation)
    expect(bPrime).to.be.an.instanceof(DeleteCommentOperation)
    expect(bPrime.toJSON()).to.eql(b.toJSON())
  })

  it('Transforms DeleteCommentOperation and AddCommentOperation with same commentId', function () {
    const a = new DeleteCommentOperation('comm1')
    const b = new AddCommentOperation('comm1', [new Range(0, 1)])
    const [aPrime, bPrime] = EditOperationTransformer.transform(a, b)
    expect(aPrime).to.be.an.instanceof(DeleteCommentOperation)
    expect(aPrime.toJSON()).to.eql(a.toJSON())
    expect(bPrime).to.be.an.instanceof(EditNoOperation)
  })

  it('Transforms AddCommentOperation and TextOperation', function () {
    // abc hello[ world] xyz - insert(9, " world")
    // abc hello |xyz| -   addComment(10, 3, "comment_id")

    const a = new TextOperation().retain(9).insert(' world')
    const b = new AddCommentOperation('comm1', [new Range(10, 3)])

    const [aPrime, bPrime] = EditOperationTransformer.transform(a, b)
    expect(aPrime).to.be.an.instanceof(TextOperation)
    expect(aPrime.toJSON()).to.eql(a.toJSON())
    expect(bPrime).to.be.an.instanceof(AddCommentOperation)
    expect(bPrime.toJSON()).to.eql({
      commentId: 'comm1',
      ranges: [{ pos: 16, length: 3 }],
    })
  })

  it('Transforms TextOperation and AddCommentOperation', function () {
    // abc hello |xyz| -   addComment(10, 3, "comment_id")
    // abc hello[ world] xyz - insert(9, " world")

    const a = new AddCommentOperation('comm1', [new Range(10, 3)])
    const b = new TextOperation().retain(9).insert(' world')

    const [aPrime, bPrime] = EditOperationTransformer.transform(a, b)
    expect(bPrime).to.be.an.instanceof(TextOperation)
    expect(bPrime.toJSON()).to.eql(b.toJSON())
    expect(aPrime).to.be.an.instanceof(AddCommentOperation)
    expect(aPrime.toJSON()).to.eql({
      commentId: 'comm1',
      ranges: [{ pos: 16, length: 3 }],
    })
  })

  it('Transforms AddCommentOperation and TextOperation that makes a detached comment', function () {
    // [abc hello xyz] - delete(0, 13)
    // abc |hello| xyz - addComment(5, 5, "comment_id")

    const a = new TextOperation().remove(13)
    const b = new AddCommentOperation('comm1', [new Range(5, 5)])

    const [aPrime, bPrime] = EditOperationTransformer.transform(a, b)
    expect(aPrime).to.be.an.instanceof(TextOperation)
    expect(aPrime.toJSON()).to.eql(a.toJSON())
    expect(bPrime).to.be.an.instanceof(AddCommentOperation)
    expect(bPrime.toJSON()).to.eql({
      commentId: 'comm1',
      ranges: [],
    })
  })

  it('Transforms AddCommentOperation and deletion TextOperation', function () {
    // abc hell{o xy}z - retain(8).delete(4)
    // abc hello |xyz| -   addComment(10, 3, "comment_id")
    // abc hell|z|

    const a = new TextOperation().retain(8).remove(4)
    const b = new AddCommentOperation('comm1', [new Range(10, 3)])

    const [aPrime, bPrime] = EditOperationTransformer.transform(a, b)
    expect(aPrime).to.be.an.instanceof(TextOperation)
    expect(aPrime.toJSON()).to.eql(a.toJSON())
    expect(bPrime).to.be.an.instanceof(AddCommentOperation)
    expect(bPrime.toJSON()).to.eql({
      commentId: 'comm1',
      ranges: [{ pos: 8, length: 1 }],
    })
  })

  it('Transforms AddCommentOperation and complex TextOperation', function () {
    // [foo ]abc hell{o xy}z - insert(0, "foo ").retain(8).delete(4)
    // abc hello |xyz| -   addComment(10, 3, "comment_id")
    // foo abc hell|z|

    const a = new TextOperation().insert('foo ').retain(8).remove(4)
    const b = new AddCommentOperation('comm1', [new Range(10, 3)])

    const [aPrime, bPrime] = EditOperationTransformer.transform(a, b)
    expect(aPrime).to.be.an.instanceof(TextOperation)
    expect(aPrime.toJSON()).to.eql(a.toJSON())
    expect(bPrime).to.be.an.instanceof(AddCommentOperation)
    expect(bPrime.toJSON()).to.eql({
      commentId: 'comm1',
      ranges: [{ pos: 12, length: 1 }],
    })
  })

  it('Transforms DeleteCommentOperation and TextOperation', function () {
    const a = new TextOperation().retain(9).insert(' world')
    const b = new DeleteCommentOperation('comm1')

    const [aPrime, bPrime] = EditOperationTransformer.transform(a, b)
    expect(aPrime).to.be.an.instanceof(TextOperation)
    expect(aPrime.toJSON()).to.eql(a.toJSON())
    expect(bPrime).to.be.an.instanceof(DeleteCommentOperation)
    expect(bPrime.toJSON()).to.eql(b.toJSON())
  })

  it('Transforms SetCommentStateOperation and TextOperation', function () {
    const a = new TextOperation().retain(9).insert(' world')
    const b = new SetCommentStateOperation('comm1', true)

    const [aPrime, bPrime] = EditOperationTransformer.transform(a, b)
    expect(aPrime).to.be.an.instanceof(TextOperation)
    expect(aPrime.toJSON()).to.eql(a.toJSON())
    expect(bPrime).to.be.an.instanceof(SetCommentStateOperation)
    expect(bPrime.toJSON()).to.eql(b.toJSON())
  })

  it('Transforms SetCommentStateOperation and AddCommentOperation', function () {
    const a = new AddCommentOperation('comm1', [new Range(0, 1)])
    const b = new SetCommentStateOperation('comm1', true)

    const [aPrime, bPrime] = EditOperationTransformer.transform(a, b)
    expect(aPrime).to.be.an.instanceof(AddCommentOperation)
    expect(aPrime.toJSON()).to.deep.eql({
      commentId: 'comm1',
      ranges: [{ pos: 0, length: 1 }],
      resolved: true,
    })
    expect(bPrime).to.be.an.instanceof(SetCommentStateOperation)
    expect(bPrime.toJSON()).to.deep.eql(b.toJSON())
  })

  it('Transforms SetCommentStateOperation and DeleteCommentOperation', function () {
    const a = new DeleteCommentOperation('comm1')
    const b = new SetCommentStateOperation('comm1', true)

    const [aPrime, bPrime] = EditOperationTransformer.transform(a, b)
    expect(aPrime).to.be.an.instanceof(DeleteCommentOperation)
    expect(aPrime.toJSON()).to.deep.eql(a.toJSON())
    expect(bPrime).to.be.an.instanceof(EditNoOperation)
  })

  it('Transforms SetCommentStateOperation and SetCommentStateOperation', function () {
    const a = new SetCommentStateOperation('comm1', false)
    const b = new SetCommentStateOperation('comm1', true)

    const [aPrime, bPrime] = EditOperationTransformer.transform(a, b)
    expect(aPrime.toJSON()).to.deep.eql({
      commentId: 'comm1',
      resolved: false,
    })
    expect(bPrime).to.be.an.instanceof(EditNoOperation)
  })

  it('Transforms two SetCommentStateOperation with different commentId', function () {
    const a = new SetCommentStateOperation('comm1', false)
    const b = new SetCommentStateOperation('comm2', true)

    const [aPrime, bPrime] = EditOperationTransformer.transform(a, b)
    expect(aPrime).to.be.an.instanceof(SetCommentStateOperation)
    expect(aPrime.toJSON()).to.deep.eql(a.toJSON())
    expect(bPrime).to.be.an.instanceof(SetCommentStateOperation)
    expect(bPrime.toJSON()).to.deep.eql(b.toJSON())
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

  it('Constructs AddCommentOperation from JSON', function () {
    const raw = {
      commentId: 'comm1',
      ranges: [{ pos: 0, length: 1 }],
    }
    const op = EditOperationBuilder.fromJSON(raw)
    expect(op).to.be.an.instanceof(AddCommentOperation)
    expect(op.toJSON()).to.deep.equal(raw)
  })

  it('Constructs DeleteCommentOperation from JSON', function () {
    const raw = {
      deleteComment: 'comm1',
    }
    const op = EditOperationBuilder.fromJSON(raw)
    expect(op).to.be.an.instanceof(DeleteCommentOperation)
    expect(op.toJSON()).to.deep.equal(raw)
  })

  it('Constructs SetCommentStateOperation from JSON', function () {
    const raw = {
      commentId: 'comm1',
      resolved: true,
    }
    const op = EditOperationBuilder.fromJSON(raw)
    expect(op).to.be.an.instanceof(SetCommentStateOperation)
    expect(op.toJSON()).to.deep.equal(raw)
  })

  it('Constructs EditNoOperation from JSON', function () {
    const raw = { noOp: true }
    const op = EditOperationBuilder.fromJSON(raw)
    expect(op).to.be.an.instanceof(EditNoOperation)
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
