// @ts-check
const { expect } = require('chai')
const { AddCommentOperation, DeleteCommentOperation } = require('../..')
const Range = require('../../lib/range')
const StringFileData = require('../../lib/file_data/string_file_data')

describe('AddCommentOperation', function () {
  it('constructs an AddCommentOperation fromJSON', function () {
    const op = AddCommentOperation.fromJSON({
      commentId: '123',
      resolved: true,
      ranges: [{ pos: 0, length: 1 }],
    })
    expect(op).to.be.instanceOf(AddCommentOperation)
    expect(op.commentId).to.equal('123')
    expect(op.ranges[0]).to.be.instanceOf(Range)
    expect(op.resolved).to.be.true
  })

  it('should convert to JSON', function () {
    const op = new AddCommentOperation('123', [new Range(0, 1)])
    expect(op.toJSON()).to.eql({
      commentId: '123',
      ranges: [
        {
          pos: 0,
          length: 1,
        },
      ],
    })
  })

  it('should apply operation', function () {
    const fileData = new StringFileData('abc')
    const op = new AddCommentOperation('123', [new Range(0, 1)])
    op.apply(fileData)
    expect(fileData.getComments().toRaw()).to.eql([
      {
        id: '123',
        ranges: [{ pos: 0, length: 1 }],
      },
    ])
  })

  describe('invert', function () {
    it('should delete added comment', function () {
      const initialFileData = new StringFileData('abc')
      const fileData = StringFileData.fromRaw(initialFileData.toRaw())
      const op = new AddCommentOperation('123', [new Range(0, 1)])
      op.apply(fileData)
      expect(fileData.getComments().toRaw()).to.eql([
        {
          id: '123',
          ranges: [{ pos: 0, length: 1 }],
        },
      ])
      const invertedOp = op.invert(initialFileData)
      invertedOp.apply(fileData)
      expect(fileData.getComments().toRaw()).to.eql([])
    })

    it('should restore previous comment ranges', function () {
      const initialComments = [
        {
          id: '123',
          ranges: [{ pos: 0, length: 1 }],
        },
      ]

      const initialFileData = new StringFileData(
        'the quick brown fox jumps over the lazy dog',
        initialComments
      )
      const fileData = StringFileData.fromRaw(initialFileData.toRaw())
      const op = new AddCommentOperation('123', [new Range(12, 7)], true)
      op.apply(fileData)
      expect(fileData.getComments().toRaw()).to.eql([
        {
          id: '123',
          ranges: [{ pos: 12, length: 7 }],
          resolved: true,
        },
      ])

      const invertedOp = op.invert(initialFileData)
      invertedOp.apply(fileData)
      expect(fileData.getComments().toRaw()).to.deep.equal(initialComments)
    })

    it('should restore previous comment resolution status', function () {
      const initialComments = [
        {
          id: '123',
          ranges: [{ pos: 0, length: 1 }],
        },
      ]

      const initialFileData = new StringFileData(
        'the quick brown fox jumps over the lazy dog',
        initialComments
      )
      const fileData = StringFileData.fromRaw(initialFileData.toRaw())
      const op = new AddCommentOperation('123', [new Range(0, 1)], true)
      op.apply(fileData)
      expect(fileData.getComments().toRaw()).to.eql([
        {
          id: '123',
          ranges: [{ pos: 0, length: 1 }],
          resolved: true,
        },
      ])

      const invertedOp = op.invert(initialFileData)
      invertedOp.apply(fileData)
      expect(fileData.getComments().toRaw()).to.deep.equal(initialComments)
    })
  })

  it('should compose with DeleteCommentOperation', function () {
    const addOp = new AddCommentOperation('123', [new Range(0, 1)])
    const deleteOp = new DeleteCommentOperation('123')
    expect(addOp.canBeComposedWith(deleteOp)).to.be.true

    const composedOp = addOp.compose(deleteOp)
    expect(composedOp).to.be.instanceOf(DeleteCommentOperation)
  })
})
