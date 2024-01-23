'use strict'

const { expect } = require('chai')
const CommentList = require('../lib/file_data/comment_list')
const Comment = require('../lib/file_data/comment')
const Range = require('../lib/file_data/range')

describe('commentList', function () {
  it('checks if toRaw() returns a correct comment list', function () {
    const commentList = new CommentList(
      new Map([
        ['comm1', new Comment([new Range(5, 10)])],
        ['comm2', new Comment([new Range(20, 5)])],
        ['comm3', new Comment([new Range(30, 15)])],
      ])
    )

    expect(commentList.getComments()).to.eql([
      { id: 'comm1', ranges: [{ pos: 5, length: 10 }], resolved: false },
      { id: 'comm2', ranges: [{ pos: 20, length: 5 }], resolved: false },
      {
        id: 'comm3',
        ranges: [{ pos: 30, length: 15 }],
        resolved: false,
      },
    ])
  })

  it('should get a comment by id', function () {
    const commentList = new CommentList(
      new Map([
        ['comm1', new Comment([new Range(5, 10)])],
        ['comm3', new Comment([new Range(30, 15)])],
        ['comm2', new Comment([new Range(20, 5)])],
      ])
    )

    const comment = commentList.getComment('comm2')
    expect(comment?.toRaw()).to.eql({
      ranges: [
        {
          pos: 20,
          length: 5,
        },
      ],
      resolved: false,
    })
  })

  it('should add new comment to the list', function () {
    const commentList = new CommentList(
      new Map([
        ['comm1', new Comment([new Range(5, 10)])],
        ['comm2', new Comment([new Range(20, 5)])],
        ['comm3', new Comment([new Range(30, 15)])],
      ])
    )

    commentList.add('comm4', new Comment([new Range(40, 10)]))
    expect(commentList.getComments()).to.eql([
      { id: 'comm1', ranges: [{ pos: 5, length: 10 }], resolved: false },
      { id: 'comm2', ranges: [{ pos: 20, length: 5 }], resolved: false },
      {
        id: 'comm3',
        ranges: [{ pos: 30, length: 15 }],
        resolved: false,
      },
      {
        id: 'comm4',
        ranges: [{ pos: 40, length: 10 }],
        resolved: false,
      },
    ])
  })

  it('should override existing if a new comment has the same id', function () {
    const commentList = new CommentList(
      new Map([
        ['comm1', new Comment([new Range(5, 10)])],
        ['comm2', new Comment([new Range(20, 5)])],
        ['comm3', new Comment([new Range(30, 15)])],
      ])
    )

    commentList.add('comm2', new Comment([new Range(40, 10)]))
    expect(commentList.getComments()).to.eql([
      { id: 'comm1', ranges: [{ pos: 5, length: 10 }], resolved: false },
      {
        id: 'comm2',
        ranges: [{ pos: 40, length: 10 }],
        resolved: false,
      },
      {
        id: 'comm3',
        ranges: [{ pos: 30, length: 15 }],
        resolved: false,
      },
    ])
  })

  it('should delete a comment from the list', function () {
    const commentList = new CommentList(
      new Map([
        ['comm1', new Comment([new Range(5, 10)])],
        ['comm2', new Comment([new Range(20, 5)])],
        ['comm3', new Comment([new Range(30, 15)])],
      ])
    )

    commentList.delete('comm3')
    expect(commentList.getComments()).to.eql([
      { id: 'comm1', ranges: [{ pos: 5, length: 10 }], resolved: false },
      { id: 'comm2', ranges: [{ pos: 20, length: 5 }], resolved: false },
    ])
  })

  it('should not throw an error if comment id does not exist', function () {
    const commentList = new CommentList(
      new Map([
        ['comm1', new Comment([new Range(5, 10)])],
        ['comm2', new Comment([new Range(20, 5)])],
        ['comm3', new Comment([new Range(30, 15)])],
      ])
    )

    commentList.delete('comm5')

    expect(commentList.getComments()).to.eql([
      { id: 'comm1', ranges: [{ pos: 5, length: 10 }], resolved: false },
      { id: 'comm2', ranges: [{ pos: 20, length: 5 }], resolved: false },
      {
        id: 'comm3',
        ranges: [{ pos: 30, length: 15 }],
        resolved: false,
      },
    ])
  })
})
