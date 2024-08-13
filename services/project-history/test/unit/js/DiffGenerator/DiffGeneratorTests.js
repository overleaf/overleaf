import sinon from 'sinon'
import { expect } from 'chai'
import { strict as esmock } from 'esmock'

const MODULE_PATH = '../../../../app/js/DiffGenerator.js'

describe('DiffGenerator', function () {
  beforeEach(async function () {
    this.DiffGenerator = await esmock(MODULE_PATH, {})
    this.ts = Date.now()
    this.user_id = 'mock-user-id'
    this.user_id_2 = 'mock-user-id-2'
    this.meta = {
      start_ts: this.ts,
      end_ts: this.ts,
      user_id: this.user_id,
    }
  })

  describe('buildDiff', function () {
    beforeEach(function () {
      this.diff = [{ u: 'mock-diff' }]
      this.content = 'Hello world'
      this.updates = [
        { i: 'mock-update-1' },
        { i: 'mock-update-2' },
        { i: 'mock-update-3' },
      ]
      this.DiffGenerator._mocks.applyUpdateToDiff = sinon
        .stub()
        .returns(this.diff)
      this.DiffGenerator._mocks.compressDiff = sinon.stub().returns(this.diff)
      this.result = this.DiffGenerator.buildDiff(this.content, this.updates)
    })

    it('should return the diff', function () {
      this.result.should.deep.equal(this.diff)
    })

    it('should build the content into an initial diff', function () {
      this.DiffGenerator._mocks.applyUpdateToDiff
        .calledWith(
          [
            {
              u: this.content,
            },
          ],
          this.updates[0]
        )
        .should.equal(true)
    })

    it('should apply each update', function () {
      this.updates.map(update =>
        this.DiffGenerator._mocks.applyUpdateToDiff
          .calledWith(sinon.match.any, update)
          .should.equal(true)
      )
    })

    it('should compress the diff', function () {
      this.DiffGenerator._mocks.compressDiff
        .calledWith(this.diff)
        .should.equal(true)
    })
  })

  describe('compressDiff', function () {
    describe('with adjacent inserts with the same user id', function () {
      it('should create one update with combined meta data and min/max timestamps', function () {
        const diff = this.DiffGenerator.compressDiff([
          {
            i: 'foo',
            meta: { start_ts: 10, end_ts: 20, users: [this.user_id] },
          },
          {
            i: 'bar',
            meta: { start_ts: 5, end_ts: 15, users: [this.user_id] },
          },
        ])
        expect(diff).to.deep.equal([
          {
            i: 'foobar',
            meta: { start_ts: 5, end_ts: 20, users: [this.user_id] },
          },
        ])
      })
    })

    describe('with adjacent inserts with different user ids', function () {
      it('should leave the inserts unchanged', function () {
        const input = [
          {
            i: 'foo',
            meta: { start_ts: 10, end_ts: 20, users: [this.user_id] },
          },
          {
            i: 'bar',
            meta: { start_ts: 5, end_ts: 15, users: [this.user_id_2] },
          },
        ]
        const output = this.DiffGenerator.compressDiff(input)
        expect(output).to.deep.equal(input)
      })
    })

    describe('with adjacent deletes with the same user id', function () {
      it('should create one update with combined meta data and min/max timestamps', function () {
        const diff = this.DiffGenerator.compressDiff([
          {
            d: 'foo',
            meta: { start_ts: 10, end_ts: 20, users: [this.user_id] },
          },
          {
            d: 'bar',
            meta: { start_ts: 5, end_ts: 15, users: [this.user_id] },
          },
        ])
        expect(diff).to.deep.equal([
          {
            d: 'foobar',
            meta: { start_ts: 5, end_ts: 20, users: [this.user_id] },
          },
        ])
      })
    })

    describe('with adjacent deletes with different user ids', function () {
      it('should leave the deletes unchanged', function () {
        const input = [
          {
            d: 'foo',
            meta: { start_ts: 10, end_ts: 20, users: [this.user_id] },
          },
          {
            d: 'bar',
            meta: { start_ts: 5, end_ts: 15, users: [this.user_id_2] },
          },
        ]
        const output = this.DiffGenerator.compressDiff(input)
        expect(output).to.deep.equal(input)
      })
    })

    describe('with history resync updates', function () {
      it('should keep only inserts and mark them as unchanged text', function () {
        const input = [
          { u: 'untracked text' },
          {
            i: 'inserted anonymously',
            meta: { origin: { kind: 'history-resync' } },
          },
          {
            d: 'deleted anonymously',
            meta: { origin: { kind: 'history-resync' } },
          },
        ]
        const output = this.DiffGenerator.compressDiff(input)
        expect(output).to.deep.equal([
          { u: 'untracked text' },
          { u: 'inserted anonymously' },
        ])
      })
    })
  })

  describe('applyUpdateToDiff', function () {
    describe('an insert', function () {
      it('should insert into the middle of (u)nchanged text', function () {
        const diff = this.DiffGenerator.applyUpdateToDiff([{ u: 'foobar' }], {
          op: [{ p: 3, i: 'baz' }],
          meta: this.meta,
        })
        expect(diff).to.deep.equal([
          { u: 'foo' },
          { i: 'baz', meta: this.meta },
          { u: 'bar' },
        ])
      })

      it('should insert into the start of (u)changed text', function () {
        const diff = this.DiffGenerator.applyUpdateToDiff([{ u: 'foobar' }], {
          op: [{ p: 0, i: 'baz' }],
          meta: this.meta,
        })
        expect(diff).to.deep.equal([
          { i: 'baz', meta: this.meta },
          { u: 'foobar' },
        ])
      })

      it('should insert into the end of (u)changed text', function () {
        const diff = this.DiffGenerator.applyUpdateToDiff([{ u: 'foobar' }], {
          op: [{ p: 6, i: 'baz' }],
          meta: this.meta,
        })
        expect(diff).to.deep.equal([
          { u: 'foobar' },
          { i: 'baz', meta: this.meta },
        ])
      })

      it('should insert into the middle of (i)inserted text', function () {
        const diff = this.DiffGenerator.applyUpdateToDiff(
          [{ i: 'foobar', meta: this.meta }],
          { op: [{ p: 3, i: 'baz' }], meta: this.meta }
        )
        expect(diff).to.deep.equal([
          { i: 'foo', meta: this.meta },
          { i: 'baz', meta: this.meta },
          { i: 'bar', meta: this.meta },
        ])
      })

      it('should not count deletes in the running length total', function () {
        const diff = this.DiffGenerator.applyUpdateToDiff(
          [{ d: 'deleted', meta: this.meta }, { u: 'foobar' }],
          { op: [{ p: 3, i: 'baz' }], meta: this.meta }
        )
        expect(diff).to.deep.equal([
          { d: 'deleted', meta: this.meta },
          { u: 'foo' },
          { i: 'baz', meta: this.meta },
          { u: 'bar' },
        ])
      })
    })

    describe('a delete', function () {
      describe('deleting unchanged text', function () {
        it('should delete from the middle of (u)nchanged text', function () {
          const diff = this.DiffGenerator.applyUpdateToDiff(
            [{ u: 'foobazbar' }],
            { op: [{ p: 3, d: 'baz' }], meta: this.meta }
          )
          expect(diff).to.deep.equal([
            { u: 'foo' },
            { d: 'baz', meta: this.meta },
            { u: 'bar' },
          ])
        })

        it('should delete from the start of (u)nchanged text', function () {
          const diff = this.DiffGenerator.applyUpdateToDiff(
            [{ u: 'foobazbar' }],
            { op: [{ p: 0, d: 'foo' }], meta: this.meta }
          )
          expect(diff).to.deep.equal([
            { d: 'foo', meta: this.meta },
            { u: 'bazbar' },
          ])
        })

        it('should delete from the end of (u)nchanged text', function () {
          const diff = this.DiffGenerator.applyUpdateToDiff(
            [{ u: 'foobazbar' }],
            { op: [{ p: 6, d: 'bar' }], meta: this.meta }
          )
          expect(diff).to.deep.equal([
            { u: 'foobaz' },
            { d: 'bar', meta: this.meta },
          ])
        })

        it('should delete across multiple (u)changed text parts', function () {
          const diff = this.DiffGenerator.applyUpdateToDiff(
            [{ u: 'foo' }, { u: 'baz' }, { u: 'bar' }],
            { op: [{ p: 2, d: 'obazb' }], meta: this.meta }
          )
          expect(diff).to.deep.equal([
            { u: 'fo' },
            { d: 'o', meta: this.meta },
            { d: 'baz', meta: this.meta },
            { d: 'b', meta: this.meta },
            { u: 'ar' },
          ])
        })
      })

      describe('deleting inserts', function () {
        it('should delete from the middle of (i)nserted text', function () {
          const diff = this.DiffGenerator.applyUpdateToDiff(
            [{ i: 'foobazbar', meta: this.meta }],
            { op: [{ p: 3, d: 'baz' }], meta: this.meta }
          )
          expect(diff).to.deep.equal([
            { i: 'foo', meta: this.meta },
            { i: 'bar', meta: this.meta },
          ])
        })

        it('should delete from the start of (u)nchanged text', function () {
          const diff = this.DiffGenerator.applyUpdateToDiff(
            [{ i: 'foobazbar', meta: this.meta }],
            { op: [{ p: 0, d: 'foo' }], meta: this.meta }
          )
          expect(diff).to.deep.equal([{ i: 'bazbar', meta: this.meta }])
        })

        it('should delete from the end of (u)nchanged text', function () {
          const diff = this.DiffGenerator.applyUpdateToDiff(
            [{ i: 'foobazbar', meta: this.meta }],
            { op: [{ p: 6, d: 'bar' }], meta: this.meta }
          )
          expect(diff).to.deep.equal([{ i: 'foobaz', meta: this.meta }])
        })

        it('should delete across multiple (u)changed and (i)nserted text parts', function () {
          const diff = this.DiffGenerator.applyUpdateToDiff(
            [{ u: 'foo' }, { i: 'baz', meta: this.meta }, { u: 'bar' }],
            { op: [{ p: 2, d: 'obazb' }], meta: this.meta }
          )
          expect(diff).to.deep.equal([
            { u: 'fo' },
            { d: 'o', meta: this.meta },
            { d: 'b', meta: this.meta },
            { u: 'ar' },
          ])
        })
      })

      describe('deleting over existing deletes', function () {
        it('should delete across multiple (u)changed and (d)deleted text parts', function () {
          const diff = this.DiffGenerator.applyUpdateToDiff(
            [{ u: 'foo' }, { d: 'baz', meta: this.meta }, { u: 'bar' }],
            { op: [{ p: 2, d: 'ob' }], meta: this.meta }
          )
          expect(diff).to.deep.equal([
            { u: 'fo' },
            { d: 'o', meta: this.meta },
            { d: 'baz', meta: this.meta },
            { d: 'b', meta: this.meta },
            { u: 'ar' },
          ])
        })
      })

      describe("deleting when the text doesn't match", function () {
        it('should throw an error when deleting from the middle of (u)nchanged text', function () {
          expect(() =>
            this.DiffGenerator.applyUpdateToDiff([{ u: 'foobazbar' }], {
              op: [{ p: 3, d: 'xxx' }],
              meta: this.meta,
            })
          ).to.throw(this.DiffGenerator.ConsistencyError)
        })

        it('should throw an error when deleting from the start of (u)nchanged text', function () {
          expect(() =>
            this.DiffGenerator.applyUpdateToDiff([{ u: 'foobazbar' }], {
              op: [{ p: 0, d: 'xxx' }],
              meta: this.meta,
            })
          ).to.throw(this.DiffGenerator.ConsistencyError)
        })

        it('should throw an error when deleting from the end of (u)nchanged text', function () {
          expect(() =>
            this.DiffGenerator.applyUpdateToDiff([{ u: 'foobazbar' }], {
              op: [{ p: 6, d: 'xxx' }],
              meta: this.meta,
            })
          ).to.throw(this.DiffGenerator.ConsistencyError)
        })
      })

      describe('when the last update in the existing diff is a delete', function () {
        it('should insert the new update before the delete', function () {
          const diff = this.DiffGenerator.applyUpdateToDiff(
            [{ u: 'foo' }, { d: 'bar', meta: this.meta }],
            { op: [{ p: 3, i: 'baz' }], meta: this.meta }
          )
          expect(diff).to.deep.equal([
            { u: 'foo' },
            { i: 'baz', meta: this.meta },
            { d: 'bar', meta: this.meta },
          ])
        })
      })

      describe('when the only update in the existing diff is a delete', function () {
        it('should insert the new update after the delete', function () {
          const diff = this.DiffGenerator.applyUpdateToDiff(
            [{ d: 'bar', meta: this.meta }],
            { op: [{ p: 0, i: 'baz' }], meta: this.meta }
          )
          expect(diff).to.deep.equal([
            { d: 'bar', meta: this.meta },
            { i: 'baz', meta: this.meta },
          ])
        })
      })
    })
  })
})
