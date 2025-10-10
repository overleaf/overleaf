// @ts-check
'use strict'

const { expect } = require('chai')
const CommentList = require('../../lib/file_data/comment_list')
const Comment = require('../../lib/comment')
const Range = require('../../lib/range')

describe('commentList', function () {
  it('checks if toRaw() returns a correct comment list', function () {
    const commentList = new CommentList([
      new Comment('comm1', [new Range(5, 10)]),
      new Comment('comm2', [new Range(20, 5)]),
      new Comment('comm3', [new Range(30, 15)]),
    ])

    expect(commentList.toRaw()).to.eql([
      { id: 'comm1', ranges: [{ pos: 5, length: 10 }] },
      { id: 'comm2', ranges: [{ pos: 20, length: 5 }] },
      {
        id: 'comm3',
        ranges: [{ pos: 30, length: 15 }],
      },
    ])
  })

  it('should get a comment by id', function () {
    const commentList = new CommentList([
      new Comment('comm1', [new Range(5, 10)]),
      new Comment('comm3', [new Range(30, 15)]),
      new Comment('comm2', [new Range(20, 5)]),
    ])

    const comment = commentList.getComment('comm2')
    expect(comment?.toRaw()).to.eql({
      id: 'comm2',
      ranges: [
        {
          pos: 20,
          length: 5,
        },
      ],
    })
  })

  it('should add new comment to the list', function () {
    const commentList = new CommentList([
      new Comment('comm1', [new Range(5, 10)]),
      new Comment('comm2', [new Range(20, 5)]),
      new Comment('comm3', [new Range(30, 15)]),
    ])

    commentList.add(new Comment('comm4', [new Range(40, 10)]))
    expect(commentList.toRaw()).to.eql([
      { id: 'comm1', ranges: [{ pos: 5, length: 10 }] },
      { id: 'comm2', ranges: [{ pos: 20, length: 5 }] },
      {
        id: 'comm3',
        ranges: [{ pos: 30, length: 15 }],
      },
      {
        id: 'comm4',
        ranges: [{ pos: 40, length: 10 }],
      },
    ])
  })

  it('should overwrite existing comment if new one is added', function () {
    const commentList = new CommentList([
      new Comment('comm1', [new Range(5, 10)], false),
      new Comment('comm2', [new Range(20, 5)], true),
      new Comment('comm3', [new Range(30, 15)]),
    ])

    commentList.add(new Comment('comm1', [new Range(5, 10)], true))
    commentList.add(new Comment('comm2', [new Range(40, 10)], true))

    expect(commentList.toRaw()).to.eql([
      { id: 'comm1', ranges: [{ pos: 5, length: 10 }], resolved: true },
      {
        id: 'comm2',
        ranges: [{ pos: 40, length: 10 }],
        resolved: true,
      },
      {
        id: 'comm3',
        ranges: [{ pos: 30, length: 15 }],
      },
    ])
  })

  it('should delete a comment from the list', function () {
    const commentList = new CommentList([
      new Comment('comm1', [new Range(5, 10)]),
      new Comment('comm2', [new Range(20, 5)]),
      new Comment('comm3', [new Range(30, 15)]),
    ])

    commentList.delete('comm3')
    expect(commentList.toRaw()).to.eql([
      { id: 'comm1', ranges: [{ pos: 5, length: 10 }] },
      { id: 'comm2', ranges: [{ pos: 20, length: 5 }] },
    ])
  })

  it('should not throw an error if comment id does not exist', function () {
    const commentList = new CommentList([
      new Comment('comm1', [new Range(5, 10)]),
      new Comment('comm2', [new Range(20, 5)]),
      new Comment('comm3', [new Range(30, 15)]),
    ])

    commentList.delete('comm5')

    expect(commentList.toRaw()).to.eql([
      { id: 'comm1', ranges: [{ pos: 5, length: 10 }] },
      { id: 'comm2', ranges: [{ pos: 20, length: 5 }] },
      {
        id: 'comm3',
        ranges: [{ pos: 30, length: 15 }],
      },
    ])
  })

  it('should be iterable', function () {
    const comment = new Comment('comm1', [new Range(5, 10)])
    const commentList = new CommentList([comment])
    expect(Array.from(commentList)).to.deep.equal([comment])
  })

  describe('inserting a comment between ranges', function () {
    it('should expand comment on the left', function () {
      const commentList = CommentList.fromRaw([
        {
          id: 'comm1',
          ranges: [{ pos: 5, length: 10 }],
        },
        {
          id: 'comm2',
          ranges: [{ pos: 15, length: 10 }],
        },
      ])

      commentList.applyInsert(new Range(15, 5), { commentIds: ['comm1'] })
      expect(commentList.toRaw()).to.eql([
        { id: 'comm1', ranges: [{ pos: 5, length: 15 }] },
        { id: 'comm2', ranges: [{ pos: 20, length: 10 }] },
      ])
    })

    it('should expand comment on the right', function () {
      const commentList = CommentList.fromRaw([
        {
          id: 'comm1',
          ranges: [{ pos: 5, length: 10 }],
        },
        {
          id: 'comm2',
          ranges: [{ pos: 15, length: 10 }],
        },
      ])

      commentList.applyInsert(new Range(15, 5), { commentIds: ['comm2'] })
      expect(commentList.toRaw()).to.eql([
        { id: 'comm1', ranges: [{ pos: 5, length: 10 }] },
        { id: 'comm2', ranges: [{ pos: 15, length: 15 }] },
      ])
    })
  })

  it('should delete a text overlapping two comments', function () {
    const commentList = CommentList.fromRaw([
      {
        id: 'comm1',
        ranges: [{ pos: 5, length: 10 }], // 5-14
      },
      {
        id: 'comm2',
        ranges: [{ pos: 15, length: 10 }], // 15-24
      },
    ])

    commentList.applyDelete(new Range(10, 10)) // 10-19
    expect(commentList.toRaw()).to.eql([
      { id: 'comm1', ranges: [{ pos: 5, length: 5 }] },
      { id: 'comm2', ranges: [{ pos: 10, length: 5 }] },
    ])
  })

  describe('move ranges after insert/delete operations', function () {
    it('expands comments inside inserted text', function () {
      const commentList = CommentList.fromRaw([
        {
          id: 'comm1',
          ranges: [{ pos: 5, length: 10 }],
        },
        {
          id: 'comm2',
          ranges: [{ pos: 20, length: 5 }],
        },
        {
          id: 'comm3',
          ranges: [{ pos: 30, length: 15 }],
        },
      ])

      commentList.applyInsert(new Range(7, 5), { commentIds: ['comm1'] })
      expect(commentList.toRaw()).to.eql([
        { id: 'comm1', ranges: [{ pos: 5, length: 15 }] },
        { id: 'comm2', ranges: [{ pos: 25, length: 5 }] },
        { id: 'comm3', ranges: [{ pos: 35, length: 15 }] },
      ])
    })

    it('should insert an overlapping comment without overlapped comment id', function () {
      const commentList = CommentList.fromRaw([
        {
          id: 'comm1',
          ranges: [{ pos: 5, length: 10 }],
        },
        {
          id: 'comm2',
          ranges: [{ pos: 20, length: 5 }],
        },
        {
          id: 'comm3',
          ranges: [{ pos: 30, length: 15 }],
        },
      ])

      commentList.applyInsert(new Range(7, 5), { commentIds: ['comm2'] })
      expect(commentList.toRaw()).to.eql([
        {
          id: 'comm1',
          ranges: [
            { pos: 5, length: 2 },
            { pos: 12, length: 8 },
          ],
        },
        {
          id: 'comm2',
          ranges: [
            { pos: 7, length: 5 },
            { pos: 25, length: 5 },
          ],
        },
        { id: 'comm3', ranges: [{ pos: 35, length: 15 }] },
      ])
    })

    it('should insert an overlapping comment with overlapped comment id', function () {
      const commentList = CommentList.fromRaw([
        {
          id: 'comm1',
          ranges: [{ pos: 5, length: 15 }],
        },
        {
          id: 'comm2',
          ranges: [{ pos: 20, length: 5 }],
        },
        {
          id: 'comm3',
          ranges: [{ pos: 30, length: 15 }],
        },
      ])

      commentList.applyInsert(new Range(7, 5), {
        commentIds: ['comm1', 'comm2'],
      })
      expect(commentList.toRaw()).to.eql([
        {
          id: 'comm1',
          ranges: [{ pos: 5, length: 20 }],
        },
        {
          id: 'comm2',
          ranges: [
            { pos: 7, length: 5 },
            { pos: 25, length: 5 },
          ],
        },
        { id: 'comm3', ranges: [{ pos: 35, length: 15 }] },
      ])
    })

    it('moves comments after inserted text', function () {
      const commentList = CommentList.fromRaw([
        {
          id: 'comm1',
          ranges: [{ pos: 5, length: 10 }],
        },
        {
          id: 'comm2',
          ranges: [{ pos: 20, length: 5 }],
        },
        {
          id: 'comm3',
          ranges: [{ pos: 30, length: 15 }],
        },
      ])

      commentList.applyInsert(new Range(16, 5))
      expect(commentList.toRaw()).to.eql([
        { id: 'comm1', ranges: [{ pos: 5, length: 10 }] },
        { id: 'comm2', ranges: [{ pos: 25, length: 5 }] },
        { id: 'comm3', ranges: [{ pos: 35, length: 15 }] },
      ])
    })

    it('does not affect comments outside of inserted text', function () {
      const commentList = CommentList.fromRaw([
        {
          id: 'comm1',
          ranges: [{ pos: 5, length: 10 }],
        },
        {
          id: 'comm2',
          ranges: [{ pos: 20, length: 5 }],
        },
        {
          id: 'comm3',
          ranges: [{ pos: 30, length: 15 }],
        },
      ])

      commentList.applyInsert(new Range(50, 5))
      expect(commentList.toRaw()).to.eql([
        { id: 'comm1', ranges: [{ pos: 5, length: 10 }] },
        { id: 'comm2', ranges: [{ pos: 20, length: 5 }] },
        { id: 'comm3', ranges: [{ pos: 30, length: 15 }] },
      ])
    })

    it('should move comments if delete happened before it', function () {
      const commentList = CommentList.fromRaw([
        {
          id: 'comm1',
          ranges: [{ pos: 5, length: 10 }],
        },
        {
          id: 'comm2',
          ranges: [{ pos: 20, length: 5 }],
        },
        {
          id: 'comm3',
          ranges: [{ pos: 30, length: 15 }],
        },
      ])

      commentList.applyDelete(new Range(0, 4))
      expect(commentList.toRaw()).to.eql([
        { id: 'comm1', ranges: [{ pos: 1, length: 10 }] },
        { id: 'comm2', ranges: [{ pos: 16, length: 5 }] },
        { id: 'comm3', ranges: [{ pos: 26, length: 15 }] },
      ])
    })

    describe('should remove part of a comment on delete overlapping', function () {
      it('should delete intersection from the left', function () {
        const commentList = CommentList.fromRaw([
          {
            id: 'comm1',
            ranges: [{ pos: 5, length: 10 }],
          },
        ])

        commentList.applyDelete(new Range(0, 6))
        expect(commentList.toRaw()).to.eql([
          { id: 'comm1', ranges: [{ pos: 0, length: 9 }] },
        ])
      })

      it('should delete intersection from the right', function () {
        const commentList = CommentList.fromRaw([
          {
            id: 'comm1',
            ranges: [{ pos: 5, length: 10 }],
          },
        ])
        commentList.applyDelete(new Range(7, 10))
        expect(commentList.toRaw()).to.eql([
          { id: 'comm1', ranges: [{ pos: 5, length: 2 }] },
        ])
      })

      it('should delete intersection in the middle', function () {
        const commentList = CommentList.fromRaw([
          {
            id: 'comm1',
            ranges: [{ pos: 5, length: 10 }],
          },
        ])
        commentList.applyDelete(new Range(6, 2))
        expect(commentList.toRaw()).to.eql([
          { id: 'comm1', ranges: [{ pos: 5, length: 8 }] },
        ])
      })
    })

    it('should leave comment without ranges', function () {
      const commentList = CommentList.fromRaw([
        {
          id: 'comm1',
          ranges: [{ pos: 5, length: 10 }],
        },
        {
          id: 'comm2',
          ranges: [{ pos: 20, length: 5 }],
        },
        {
          id: 'comm3',
          ranges: [{ pos: 30, length: 15 }],
        },
      ])

      commentList.applyDelete(new Range(19, 10))
      expect(commentList.toRaw()).to.eql([
        {
          id: 'comm1',
          ranges: [{ pos: 5, length: 10 }],
        },
        { id: 'comm2', ranges: [] },
        {
          id: 'comm3',
          ranges: [{ pos: 20, length: 15 }],
        },
      ])
    })
  })
})
