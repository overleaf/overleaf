import { expect } from 'chai'
import { createRangeBlobDataFromUpdate } from '../../../../app/js/HistoryBlobTranslator.js'

/**
 * @import { AddDocUpdate } from "../../../../app/js/types"
 */

/**
 *
 * @param {string} pathname s
 * @param {string} docLines
 * @param {AddDocUpdate["ranges"]} ranges
 * @returns {AddDocUpdate}
 */
const update = (pathname, docLines, ranges) => {
  return {
    pathname,
    docLines,
    ranges,
    version: 'version-1',
    projectHistoryId: 'project-id',
    doc: 'doc',
    meta: {
      user_id: 'user-id',
      ts: 0,
    },
  }
}

describe('HistoryBlobTranslator', function () {
  describe('createBlobDataFromUpdate', function () {
    beforeEach(function () {
      this.text = 'the quick brown fox jumps over the lazy dog'
    })
    describe('for update with no ranges', function () {
      beforeEach(function () {
        this.result = createRangeBlobDataFromUpdate(
          update('pathname', this.text, undefined)
        )
      })

      it('should not return ranges', function () {
        expect(this.result).to.be.undefined
      })
    })

    describe('for update with empty ranges object', function () {
      beforeEach(function () {
        this.result = createRangeBlobDataFromUpdate(
          update('pathname', this.text, {})
        )
      })

      it('should not return ranges', function () {
        expect(this.result).to.be.undefined
      })
    })

    describe('for update with ranges object with empty lists', function () {
      beforeEach(function () {
        this.result = createRangeBlobDataFromUpdate(
          update('pathname', this.text, { changes: [], comments: [] })
        )
      })

      it('should not return ranges', function () {
        expect(this.result).to.be.undefined
      })
    })

    describe('for update with zero length comments', function () {
      beforeEach(function () {
        this.result = createRangeBlobDataFromUpdate(
          update('pathname', this.text, {
            changes: [],
            comments: [
              { op: { c: '', p: 4, t: 'comment-1', resolved: false } },
            ],
          })
        )
      })
      it('should treat them as detached comments', function () {
        expect(this.result).to.deep.equal({
          comments: [{ id: 'comment-1', ranges: [] }],
          trackedChanges: [],
        })
      })
    })

    describe('for update with ranges object with only comments', function () {
      it('should return unmoved ranges', function () {
        const result = createRangeBlobDataFromUpdate(
          update('pathname', this.text, {
            comments: [
              {
                op: { c: 'quick', p: 4, t: 'comment-1', resolved: false },
              },
            ],
          })
        )
        expect(result).to.deep.equal({
          comments: [
            {
              id: 'comment-1',
              ranges: [{ pos: 4, length: 5 }],
            },
          ],
          trackedChanges: [],
        })
      })

      it('should merge comments ranges into a single comment by id', function () {
        const result = createRangeBlobDataFromUpdate(
          update('pathname', this.text, {
            comments: [
              {
                op: { c: 'quick', p: 4, t: 'comment-1', resolved: false },
              },
              {
                op: { c: 'jumps', p: 20, t: 'comment-1', resolved: false },
              },
            ],
          })
        )
        expect(result).to.deep.equal({
          comments: [
            {
              id: 'comment-1',
              ranges: [
                { pos: 4, length: 5 },
                { pos: 20, length: 5 },
              ],
            },
          ],
          trackedChanges: [],
        })
      })

      it('should not merge ranges into a single comment if id differs', function () {
        const result = createRangeBlobDataFromUpdate(
          update('pathname', this.text, {
            comments: [
              {
                op: { c: 'quick', p: 4, t: 'comment-1', resolved: false },
              },
              {
                op: { c: 'jumps', p: 20, t: 'comment-2', resolved: false },
              },
            ],
          })
        )
        expect(result).to.deep.equal({
          comments: [
            {
              id: 'comment-1',
              ranges: [{ pos: 4, length: 5 }],
            },
            {
              id: 'comment-2',
              ranges: [{ pos: 20, length: 5 }],
            },
          ],
          trackedChanges: [],
        })
      })
    })

    describe('for update with ranges object with only tracked insertions', function () {
      it('should translate into history tracked insertions', function () {
        const result = createRangeBlobDataFromUpdate(
          update('pathname', this.text, {
            changes: [
              {
                op: { p: 4, i: 'quick' },
                metadata: {
                  ts: '2024-01-01T00:00:00.000Z',
                  user_id: 'user-1',
                },
              },
              {
                op: { p: 10, i: 'brown' },
                metadata: {
                  ts: '2023-01-01T00:00:00.000Z',
                  user_id: 'user-2',
                },
              },
            ],
          })
        )
        expect(result).to.deep.equal({
          comments: [],
          trackedChanges: [
            {
              range: { pos: 4, length: 5 },
              tracking: {
                type: 'insert',
                userId: 'user-1',
                ts: '2024-01-01T00:00:00.000Z',
              },
            },
            {
              range: { pos: 10, length: 5 },
              tracking: {
                type: 'insert',
                userId: 'user-2',
                ts: '2023-01-01T00:00:00.000Z',
              },
            },
          ],
        })
      })
    })

    describe('for update with ranges object with mixed tracked changes', function () {
      describe('with tracked deletions before insertions', function () {
        it('should insert tracked deletions before insertions', function () {
          const text = 'the quickrapid brown fox jumps over the lazy dog'
          const result = createRangeBlobDataFromUpdate(
            update('pathname', text, {
              changes: [
                {
                  op: { p: 4, d: 'quick' },
                  metadata: {
                    ts: '2024-01-01T00:00:00.000Z',
                    user_id: 'user-1',
                  },
                },
                {
                  op: { p: 4, hpos: 9, i: 'rapid' },
                  metadata: {
                    ts: '2023-01-01T00:00:00.000Z',
                    user_id: 'user-2',
                  },
                },
              ],
            })
          )

          expect(result).to.deep.equal({
            comments: [],
            trackedChanges: [
              {
                range: { pos: 4, length: 5 },
                tracking: {
                  type: 'delete',
                  userId: 'user-1',
                  ts: '2024-01-01T00:00:00.000Z',
                },
              },
              {
                range: { pos: 9, length: 5 },
                tracking: {
                  type: 'insert',
                  userId: 'user-2',
                  ts: '2023-01-01T00:00:00.000Z',
                },
              },
            ],
          })
        })
      })

      describe('with tracked insertions before deletions', function () {
        it('should insert tracked deletions before insertions', function () {
          const text = 'the quickrapid brown fox jumps over the lazy dog'
          const result = createRangeBlobDataFromUpdate(
            update('pathname', text, {
              changes: [
                {
                  op: { p: 4, hpos: 9, i: 'rapid' },
                  metadata: {
                    ts: '2023-01-01T00:00:00.000Z',
                    user_id: 'user-2',
                  },
                },
                {
                  op: { p: 4, d: 'quick' },
                  metadata: {
                    ts: '2024-01-01T00:00:00.000Z',
                    user_id: 'user-1',
                  },
                },
              ],
            })
          )

          expect(result).to.deep.equal({
            comments: [],
            trackedChanges: [
              {
                range: { pos: 4, length: 5 },
                tracking: {
                  type: 'delete',
                  userId: 'user-1',
                  ts: '2024-01-01T00:00:00.000Z',
                },
              },
              {
                range: { pos: 9, length: 5 },
                tracking: {
                  type: 'insert',
                  userId: 'user-2',
                  ts: '2023-01-01T00:00:00.000Z',
                },
              },
            ],
          })
        })
      })

      it('should adjust positions', function () {
        const text = 'the quick brown fox jumps over the lazy dog'
        const result = createRangeBlobDataFromUpdate(
          update('pathname', text, {
            changes: [
              {
                op: { p: 4, i: 'quick' },
                metadata: {
                  ts: '2024-01-01T00:00:00.000Z',
                  user_id: 'user-1',
                },
              },
              {
                op: { p: 10, d: 'brown' },
                metadata: {
                  ts: '2023-01-01T00:00:00.000Z',
                  user_id: 'user-2',
                },
              },
              {
                op: { p: 30, hpos: 35, i: 'lazy' },
                metadata: {
                  ts: '2022-01-01T00:00:00.000Z',
                  user_id: 'user-2',
                },
              },
            ],
          })
        )
        expect(result).to.deep.equal({
          comments: [],
          trackedChanges: [
            {
              range: { pos: 4, length: 5 },
              tracking: {
                type: 'insert',
                userId: 'user-1',
                ts: '2024-01-01T00:00:00.000Z',
              },
            },
            {
              range: { pos: 10, length: 5 },
              tracking: {
                type: 'delete',
                userId: 'user-2',
                ts: '2023-01-01T00:00:00.000Z',
              },
            },
            {
              range: { pos: 35, length: 4 },
              tracking: {
                type: 'insert',
                userId: 'user-2',
                ts: '2022-01-01T00:00:00.000Z',
              },
            },
          ],
        })
      })
    })

    describe('for update with ranges object with mixed tracked changes and comments', function () {
      it('should adjust positions', function () {
        const text = 'the quick brown fox jumps over the lazy dog'
        const result = createRangeBlobDataFromUpdate(
          update('pathname', text, {
            comments: [
              {
                op: { c: 'quick', p: 4, t: 'comment-1', resolved: false },
              },
              {
                op: {
                  c: 'fox',
                  p: 11,
                  hpos: 16,
                  t: 'comment-2',
                  resolved: false,
                },
              },
            ],
            changes: [
              {
                op: { p: 4, i: 'quick' },
                metadata: {
                  ts: '2024-01-01T00:00:00.000Z',
                  user_id: 'user-1',
                },
              },
              {
                op: { p: 10, d: 'brown' },
                metadata: {
                  ts: '2023-01-01T00:00:00.000Z',
                  user_id: 'user-2',
                },
              },
              {
                op: { p: 30, hpos: 35, i: 'lazy' },
                metadata: {
                  ts: '2022-01-01T00:00:00.000Z',
                  user_id: 'user-2',
                },
              },
            ],
          })
        )
        expect(result).to.deep.equal({
          comments: [
            {
              ranges: [{ pos: 4, length: 5 }],
              id: 'comment-1',
            },
            {
              ranges: [{ pos: 16, length: 3 }],
              id: 'comment-2',
            },
          ],
          trackedChanges: [
            {
              range: { pos: 4, length: 5 },
              tracking: {
                type: 'insert',
                userId: 'user-1',
                ts: '2024-01-01T00:00:00.000Z',
              },
            },
            {
              range: { pos: 10, length: 5 },
              tracking: {
                type: 'delete',
                userId: 'user-2',
                ts: '2023-01-01T00:00:00.000Z',
              },
            },
            {
              range: { pos: 35, length: 4 },
              tracking: {
                type: 'insert',
                userId: 'user-2',
                ts: '2022-01-01T00:00:00.000Z',
              },
            },
          ],
        })
      })

      it('should adjust comment length', function () {
        const text = 'the quick brown fox jumps over the lazy dog'
        const result = createRangeBlobDataFromUpdate(
          update('pathname', text, {
            comments: [
              {
                op: { c: 'quick fox', p: 4, t: 'comment-1', resolved: false },
              },
            ],
            changes: [
              {
                op: { p: 10, d: 'brown ' },
                metadata: {
                  ts: '2023-01-01T00:00:00.000Z',
                  user_id: 'user-2',
                },
              },
            ],
          })
        )
        expect(result).to.deep.equal({
          comments: [
            {
              ranges: [{ pos: 4, length: 9 }],
              id: 'comment-1',
            },
          ],
          trackedChanges: [
            {
              range: { pos: 10, length: 6 },
              tracking: {
                type: 'delete',
                userId: 'user-2',
                ts: '2023-01-01T00:00:00.000Z',
              },
            },
          ],
        })
      })
    })
  })
})
