// @ts-check
const { expect } = require('chai')
const { AddCommentOperation, DeleteCommentOperation } = require('../..')
const Comment = require('../../lib/comment')
const StringFileData = require('../../lib/file_data/string_file_data')
const Range = require('../../lib/range')

describe('DeleteCommentOperation', function () {
  it('constructs an DeleteCommentOperation fromJSON', function () {
    const op = DeleteCommentOperation.fromJSON({
      deleteComment: '123',
    })
    expect(op).to.be.instanceOf(DeleteCommentOperation)
  })

  it('should convert to JSON', function () {
    const op = new DeleteCommentOperation('123')
    expect(op.toJSON()).to.eql({
      deleteComment: '123',
    })
  })

  it('should apply operation', function () {
    const fileData = new StringFileData('abc')
    const op = new DeleteCommentOperation('123')
    fileData.comments.add(new Comment('123', [new Range(0, 1)]))
    op.apply(fileData)
    expect(fileData.getComments().toRaw()).to.eql([])
  })

  it('should invert operation', function () {
    const fileData = new StringFileData('abc')
    const op = new DeleteCommentOperation('123')
    fileData.comments.add(new Comment('123', [new Range(0, 1)]))
    const invertedOp = /** @type {AddCommentOperation} */ (op.invert(fileData))
    expect(invertedOp).to.be.instanceOf(AddCommentOperation)
    expect(invertedOp.commentId).to.equal('123')
    expect(invertedOp.ranges).to.eql([new Range(0, 1)])
  })

  it('should not throw if comment not found', function () {
    const fileData = new StringFileData('abc')
    const op = new DeleteCommentOperation('123')
    expect(() => op.invert(fileData)).to.not.throw()
  })
})
