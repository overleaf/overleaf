// @ts-check
const { expect } = require('chai')
const { AddCommentOperation, DeleteCommentOperation } = require('..')
const Comment = require('../lib/comment')
const StringFileData = require('../lib/file_data/string_file_data')

describe('AddCommentOperation', function () {
  it('constructs an AddCommentOperation fromJSON', function () {
    const op = AddCommentOperation.fromJSON({
      commentId: '123',
      resolved: true,
      ranges: [{ pos: 0, length: 1 }],
    })
    expect(op).to.be.instanceOf(AddCommentOperation)
    expect(op.commentId).to.equal('123')
    expect(op.comment).to.be.instanceOf(Comment)
    expect(op.comment.resolved).to.be.true
  })

  it('should convert to JSON', function () {
    const op = new AddCommentOperation(
      '123',
      Comment.fromRaw({
        ranges: [
          {
            pos: 0,
            length: 1,
          },
        ],
      })
    )
    expect(op.toJSON()).to.eql({
      commentId: '123',
      resolved: false,
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
    const op = new AddCommentOperation(
      '123',
      Comment.fromRaw({ ranges: [{ pos: 0, length: 1 }] })
    )
    op.apply(fileData)
    expect(fileData.getComments()).to.eql([
      {
        id: '123',
        ranges: [{ pos: 0, length: 1 }],
        resolved: false,
      },
    ])
  })

  it('should invert operation', function () {
    const fileData = new StringFileData('abc')
    const op = new AddCommentOperation(
      '123',
      Comment.fromRaw({ ranges: [{ pos: 0, length: 1 }] })
    )
    op.apply(fileData)
    expect(fileData.getComments()).to.eql([
      {
        id: '123',
        ranges: [{ pos: 0, length: 1 }],
        resolved: false,
      },
    ])

    const invertedOp = op.invert()
    invertedOp.apply(fileData)
    expect(fileData.getComments()).to.eql([])
  })

  it('should compose with DeleteCommentOperation', function () {
    const addOp = new AddCommentOperation(
      '123',
      Comment.fromRaw({ ranges: [{ pos: 0, length: 1 }] })
    )
    const deleteOp = new DeleteCommentOperation('123')
    expect(addOp.canBeComposedWith(deleteOp)).to.be.true

    const composedOp = addOp.compose(deleteOp)
    expect(composedOp).to.be.instanceOf(DeleteCommentOperation)
  })
})
