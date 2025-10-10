'use strict'

const { expect } = require('chai')
const {
  getDocUpdaterCompatibleRanges,
} = require('../../lib/doc_updater_compatible_ranges.js')
const StringFileData = require('../../lib/file_data/string_file_data.js')
const File = require('../../lib/file.js')

describe('getDocUpdaterCompatibleRanges', function () {
  describe('with tracked deletes', function () {
    beforeEach(function () {
      this.content = 'the quick brown fox jumps over the lazy dog'
      this.trackedChanges = [
        {
          range: { pos: 4, length: 6 }, // 'quick '
          tracking: {
            type: 'delete',
            userId: '31',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
        {
          range: { pos: 16, length: 4 }, // 'fox '
          tracking: {
            type: 'delete',
            userId: '31',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
        {
          range: { pos: 35, length: 5 }, // 'lazy '
          tracking: {
            type: 'insert',
            userId: '31',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
        {
          range: { pos: 40, length: 3 }, // 'dog'
          tracking: {
            type: 'delete',
            userId: '31',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
      ]
    })

    it("doesn't shift the tracked delete by itself", function () {
      const fileData = new StringFileData(this.content, [], this.trackedChanges)
      const file = new File(fileData)

      const result = getDocUpdaterCompatibleRanges(file)

      expect(result.changes[0].op.p).to.eq(4)
    })

    it('should move subsequent tracked changes by the length of previous deletes', function () {
      const fileData = new StringFileData(this.content, [], this.trackedChanges)
      const file = new File(fileData)

      const result = getDocUpdaterCompatibleRanges(file)

      expect(result.changes[1].op.p).to.eq(16 - 6)
      expect(result.changes[2].op.p).to.eq(35 - 6 - 4)
    })

    it("shouldn't move subsequent tracked changes by previous inserts", function () {
      const fileData = new StringFileData(this.content, [], this.trackedChanges)
      const file = new File(fileData)

      const result = getDocUpdaterCompatibleRanges(file)

      expect(result.changes[3].op.p).to.eq(40 - 6 - 4)
    })
  })

  describe('with comments and tracked deletes', function () {
    beforeEach(function () {
      this.content = 'the quick brown fox jumps over the lazy dog'
      this.trackedChanges = [
        {
          range: { pos: 2, length: 5 }, // 'e qui'
          tracking: {
            type: 'delete',
            userId: '31',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
        {
          range: { pos: 11, length: 1 }, // 'r'
          tracking: {
            type: 'delete',
            userId: '31',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
        {
          range: { pos: 28, length: 9 }, // 'er the la'
          tracking: {
            type: 'delete',
            userId: '31',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
      ]
    })

    it('should move the comment to the start of the tracked delete and remove overlapping text', function () {
      const comments = [
        {
          id: 'comment-1',
          ranges: [
            { pos: 4, length: 5 }, // 'quick'
            { pos: 10, length: 5 }, // 'brown'
            { pos: 26, length: 4 }, // 'over'
            { pos: 35, length: 4 }, // 'lazy'
          ],
          resolved: false,
        },
      ]

      const fileData = new StringFileData(
        this.content,
        comments,
        this.trackedChanges
      )
      const file = new File(fileData)

      const result = getDocUpdaterCompatibleRanges(file)

      expect(result.comments[0].op.p).to.eq(2)
      expect(result.comments[0].op.c).to.eq('ck bown fox jumps ovzy')
    })

    it('should put resolved status in op', function () {
      const comments = [
        {
          id: 'comment-1',
          ranges: [
            { pos: 4, length: 5 }, // 'quick'
            { pos: 10, length: 5 }, // 'brown'
            { pos: 26, length: 4 }, // 'over'
            { pos: 35, length: 4 }, // 'lazy'
          ],
          resolved: false,
        },
        { id: 'comment-2', ranges: [], resolved: true },
        {
          id: 'comment-3',
          ranges: [{ pos: 4, length: 1 }], // 'q'
          resolved: true,
        },
      ]

      const fileData = new StringFileData(
        this.content,
        comments,
        this.trackedChanges
      )
      const file = new File(fileData)

      const result = getDocUpdaterCompatibleRanges(file)

      expect(result.comments[0].op.resolved).to.be.false
      expect(result.comments[1].op.resolved).to.be.true
      expect(result.comments[2].op.resolved).to.be.true
    })

    it('should include thread id', function () {
      const comments = [
        {
          id: 'comment-1',
          ranges: [
            { pos: 4, length: 5 }, // 'quick'
            { pos: 10, length: 5 }, // 'brown'
            { pos: 26, length: 4 }, // 'over'
            { pos: 35, length: 4 }, // 'lazy'
          ],
          resolved: false,
        },
        { id: 'comment-2', ranges: [], resolved: true },
        {
          id: 'comment-3',
          ranges: [{ pos: 4, length: 1 }], // 'q'
          resolved: true,
        },
      ]

      const fileData = new StringFileData(
        this.content,
        comments,
        this.trackedChanges
      )
      const file = new File(fileData)

      const result = getDocUpdaterCompatibleRanges(file)

      expect(result.comments[0].op.t).to.eq('comment-1')
      expect(result.comments[1].op.t).to.eq('comment-2')
      expect(result.comments[2].op.t).to.eq('comment-3')
    })

    it('should translate detached comment to zero length op', function () {
      const comments = [
        {
          id: 'comment-1',
          ranges: [
            { pos: 4, length: 5 }, // 'quick'
            { pos: 10, length: 5 }, // 'brown'
            { pos: 26, length: 4 }, // 'over'
            { pos: 35, length: 4 }, // 'lazy'
          ],
          resolved: false,
        },
        { id: 'comment-2', ranges: [], resolved: true }, // detached comment
        {
          id: 'comment-3',
          ranges: [{ pos: 4, length: 1 }], // 'q'
          resolved: true,
        },
      ]

      const fileData = new StringFileData(
        this.content,
        comments,
        this.trackedChanges
      )
      const file = new File(fileData)

      const result = getDocUpdaterCompatibleRanges(file)

      expect(result.comments[1].op.p).to.eq(0)
      expect(result.comments[1].op.c).to.eq('')
    })

    it('should position a comment entirely in a tracked delete next to the tracked delete', function () {
      const comments = [
        {
          id: 'comment-1',
          ranges: [
            { pos: 4, length: 5 }, // 'quick'
            { pos: 10, length: 5 }, // 'brown'
            { pos: 26, length: 4 }, // 'over'
            { pos: 35, length: 4 }, // 'lazy'
          ],
          resolved: false,
        },
        { id: 'comment-2', ranges: [], resolved: true },
        {
          id: 'comment-3',
          ranges: [{ pos: 4, length: 1 }], // 'q' - entirely in tracked delete
          resolved: true,
        },
      ]

      const fileData = new StringFileData(
        this.content,
        comments,
        this.trackedChanges
      )
      const file = new File(fileData)

      const result = getDocUpdaterCompatibleRanges(file)

      expect(result.comments[2].op.p).to.eq(2)
      expect(result.comments[2].op.c).to.eq('')
    })
  })

  describe('with multiple tracked changes and comments', function () {
    it('returns the ranges with content and adjusted positions to ignore tracked deletes', function () {
      const content = 'the quick brown fox jumps over the lazy dog'
      const trackedChanges = [
        {
          range: { pos: 4, length: 6 }, // 'quick '
          tracking: {
            type: 'delete',
            userId: '31',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
        {
          range: { pos: 10, length: 6 }, // 'brown '
          tracking: {
            type: 'insert',
            userId: '31',
            ts: '2024-01-01T00:00:00.000Z',
          },
        },
        {
          range: { pos: 35, length: 5 }, // 'lazy '
          tracking: {
            type: 'delete',
            userId: '31',
            ts: '2024-01-01T00:00:00.000Z',
          },
        },
      ]

      const comments = [
        {
          id: 'comment-1',
          ranges: [
            { pos: 4, length: 5 }, // 'quick'
            { pos: 10, length: 5 }, // 'brown'
            { pos: 35, length: 4 }, // 'lazy'
          ],
          resolved: false,
        },
        {
          id: 'comment-2',
          ranges: [
            { pos: 0, length: 3 }, // 'the'
            { pos: 31, length: 3 }, // 'the'
          ],
          resolved: true,
        },
      ]

      const fileData = new StringFileData(content, comments, trackedChanges)
      const file = new File(fileData)

      const result = getDocUpdaterCompatibleRanges(file)

      expect(result).to.deep.equal({
        changes: [
          {
            metadata: {
              ts: '2023-01-01T00:00:00.000Z',
              user_id: '31',
            },
            op: {
              d: 'quick ',
              p: 4,
            },
          },
          {
            metadata: {
              ts: '2024-01-01T00:00:00.000Z',
              user_id: '31',
            },
            op: {
              i: 'brown ',
              p: 4,
            },
          },
          {
            metadata: {
              ts: '2024-01-01T00:00:00.000Z',
              user_id: '31',
            },
            op: {
              d: 'lazy ',
              p: 29,
            },
          },
        ],
        comments: [
          {
            op: {
              c: 'brown fox jumps over the ',
              p: 4,
              t: 'comment-1',
              resolved: false,
            },
            id: 'comment-1',
          },
          {
            op: {
              c: 'the brown fox jumps over the',
              p: 0,
              t: 'comment-2',
              resolved: true,
            },
            id: 'comment-2',
          },
        ],
      })
    })
  })

  describe('with an empty file', function () {
    it('should return empty comments and changes', function () {
      const fileData = new StringFileData('', [])
      const file = new File(fileData)

      const result = getDocUpdaterCompatibleRanges(file)

      expect(result).to.deep.equal({
        changes: [],
        comments: [],
      })
    })
  })
})
