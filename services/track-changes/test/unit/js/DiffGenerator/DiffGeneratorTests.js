/* eslint-disable
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const chai = require('chai')
const should = chai.should()
const { expect } = chai
const modulePath = '../../../../app/js/DiffGenerator.js'
const SandboxedModule = require('sandboxed-module')

describe('DiffGenerator', function () {
  beforeEach(function () {
    this.DiffGenerator = SandboxedModule.require(modulePath, {
      requires: {
        'logger-sharelatex': { warn: sinon.stub() }
      }
    })
    this.ts = Date.now()
    this.user_id = 'mock-user-id'
    this.user_id_2 = 'mock-user-id-2'
    return (this.meta = {
      start_ts: this.ts,
      end_ts: this.ts,
      user_id: this.user_id
    })
  })

  describe('rewindOp', function () {
    describe('rewinding an insert', function () {
      return it('should undo the insert', function () {
        const content = 'hello world'
        const rewoundContent = this.DiffGenerator.rewindOp(content, {
          p: 6,
          i: 'wo'
        })
        return rewoundContent.should.equal('hello rld')
      })
    })

    describe('rewinding a delete', function () {
      return it('should undo the delete', function () {
        const content = 'hello rld'
        const rewoundContent = this.DiffGenerator.rewindOp(content, {
          p: 6,
          d: 'wo'
        })
        return rewoundContent.should.equal('hello world')
      })
    })

    describe('with an inconsistent update', function () {
      return it('should throw an error', function () {
        const content = 'hello world'
        return expect(() => {
          return this.DiffGenerator.rewindOp(content, { p: 6, i: 'foo' })
        }).to.throw(this.DiffGenerator.ConsistencyError)
      })
    })

    return describe('with an update which is beyond the length of the content', function () {
      return it('should undo the insert as if it were at the end of the content', function () {
        const content = 'foobar'
        const rewoundContent = this.DiffGenerator.rewindOp(content, {
          p: 4,
          i: 'bar'
        })
        return rewoundContent.should.equal('foo')
      })
    })
  })

  describe('rewindUpdate', function () {
    return it('should rewind ops in reverse', function () {
      const content = 'aaabbbccc'
      const update = {
        op: [
          { p: 3, i: 'bbb' },
          { p: 6, i: 'ccc' }
        ]
      }
      const rewoundContent = this.DiffGenerator.rewindUpdate(content, update)
      return rewoundContent.should.equal('aaa')
    })
  })

  describe('rewindUpdates', function () {
    return it('should rewind updates in reverse', function () {
      const content = 'aaabbbccc'
      const updates = [
        { op: [{ p: 3, i: 'bbb' }] },
        { op: [{ p: 6, i: 'ccc' }] }
      ]
      const rewoundContent = this.DiffGenerator.rewindUpdates(content, updates)
      return rewoundContent.should.equal('aaa')
    })
  })

  describe('buildDiff', function () {
    beforeEach(function () {
      this.diff = [{ u: 'mock-diff' }]
      this.content = 'Hello world'
      this.updates = [
        { i: 'mock-update-1' },
        { i: 'mock-update-2' },
        { i: 'mock-update-3' }
      ]
      this.DiffGenerator.applyUpdateToDiff = sinon.stub().returns(this.diff)
      this.DiffGenerator.compressDiff = sinon.stub().returns(this.diff)
      return (this.result = this.DiffGenerator.buildDiff(
        this.content,
        this.updates
      ))
    })

    it('should return the diff', function () {
      return this.result.should.deep.equal(this.diff)
    })

    it('should build the content into an initial diff', function () {
      return this.DiffGenerator.applyUpdateToDiff
        .calledWith(
          [
            {
              u: this.content
            }
          ],
          this.updates[0]
        )
        .should.equal(true)
    })

    it('should apply each update', function () {
      return Array.from(this.updates).map((update) =>
        this.DiffGenerator.applyUpdateToDiff
          .calledWith(sinon.match.any, update)
          .should.equal(true)
      )
    })

    return it('should compress the diff', function () {
      return this.DiffGenerator.compressDiff
        .calledWith(this.diff)
        .should.equal(true)
    })
  })

  describe('compressDiff', function () {
    describe('with adjacent inserts with the same user_id', function () {
      return it('should create one update with combined meta data and min/max timestamps', function () {
        const diff = this.DiffGenerator.compressDiff([
          {
            i: 'foo',
            meta: { start_ts: 10, end_ts: 20, user: { id: this.user_id } }
          },
          {
            i: 'bar',
            meta: { start_ts: 5, end_ts: 15, user: { id: this.user_id } }
          }
        ])
        return expect(diff).to.deep.equal([
          {
            i: 'foobar',
            meta: { start_ts: 5, end_ts: 20, user: { id: this.user_id } }
          }
        ])
      })
    })

    describe('with adjacent inserts with different user_ids', function () {
      return it('should leave the inserts unchanged', function () {
        const input = [
          {
            i: 'foo',
            meta: { start_ts: 10, end_ts: 20, user: { id: this.user_id } }
          },
          {
            i: 'bar',
            meta: { start_ts: 5, end_ts: 15, user: { id: this.user_id_2 } }
          }
        ]
        const output = this.DiffGenerator.compressDiff(input)
        return expect(output).to.deep.equal(input)
      })
    })

    describe('with adjacent deletes with the same user_id', function () {
      return it('should create one update with combined meta data and min/max timestamps', function () {
        const diff = this.DiffGenerator.compressDiff([
          {
            d: 'foo',
            meta: { start_ts: 10, end_ts: 20, user: { id: this.user_id } }
          },
          {
            d: 'bar',
            meta: { start_ts: 5, end_ts: 15, user: { id: this.user_id } }
          }
        ])
        return expect(diff).to.deep.equal([
          {
            d: 'foobar',
            meta: { start_ts: 5, end_ts: 20, user: { id: this.user_id } }
          }
        ])
      })
    })

    return describe('with adjacent deletes with different user_ids', function () {
      return it('should leave the deletes unchanged', function () {
        const input = [
          {
            d: 'foo',
            meta: { start_ts: 10, end_ts: 20, user: { id: this.user_id } }
          },
          {
            d: 'bar',
            meta: { start_ts: 5, end_ts: 15, user: { id: this.user_id_2 } }
          }
        ]
        const output = this.DiffGenerator.compressDiff(input)
        return expect(output).to.deep.equal(input)
      })
    })
  })

  return describe('applyUpdateToDiff', function () {
    describe('an insert', function () {
      it('should insert into the middle of (u)nchanged text', function () {
        const diff = this.DiffGenerator.applyUpdateToDiff([{ u: 'foobar' }], {
          op: [{ p: 3, i: 'baz' }],
          meta: this.meta
        })
        return expect(diff).to.deep.equal([
          { u: 'foo' },
          { i: 'baz', meta: this.meta },
          { u: 'bar' }
        ])
      })

      it('should insert into the start of (u)changed text', function () {
        const diff = this.DiffGenerator.applyUpdateToDiff([{ u: 'foobar' }], {
          op: [{ p: 0, i: 'baz' }],
          meta: this.meta
        })
        return expect(diff).to.deep.equal([
          { i: 'baz', meta: this.meta },
          { u: 'foobar' }
        ])
      })

      it('should insert into the end of (u)changed text', function () {
        const diff = this.DiffGenerator.applyUpdateToDiff([{ u: 'foobar' }], {
          op: [{ p: 6, i: 'baz' }],
          meta: this.meta
        })
        return expect(diff).to.deep.equal([
          { u: 'foobar' },
          { i: 'baz', meta: this.meta }
        ])
      })

      it('should insert into the middle of (i)inserted text', function () {
        const diff = this.DiffGenerator.applyUpdateToDiff(
          [{ i: 'foobar', meta: this.meta }],
          { op: [{ p: 3, i: 'baz' }], meta: this.meta }
        )
        return expect(diff).to.deep.equal([
          { i: 'foo', meta: this.meta },
          { i: 'baz', meta: this.meta },
          { i: 'bar', meta: this.meta }
        ])
      })

      return it('should not count deletes in the running length total', function () {
        const diff = this.DiffGenerator.applyUpdateToDiff(
          [{ d: 'deleted', meta: this.meta }, { u: 'foobar' }],
          { op: [{ p: 3, i: 'baz' }], meta: this.meta }
        )
        return expect(diff).to.deep.equal([
          { d: 'deleted', meta: this.meta },
          { u: 'foo' },
          { i: 'baz', meta: this.meta },
          { u: 'bar' }
        ])
      })
    })

    return describe('a delete', function () {
      describe('deleting unchanged text', function () {
        it('should delete from the middle of (u)nchanged text', function () {
          const diff = this.DiffGenerator.applyUpdateToDiff(
            [{ u: 'foobazbar' }],
            { op: [{ p: 3, d: 'baz' }], meta: this.meta }
          )
          return expect(diff).to.deep.equal([
            { u: 'foo' },
            { d: 'baz', meta: this.meta },
            { u: 'bar' }
          ])
        })

        it('should delete from the start of (u)nchanged text', function () {
          const diff = this.DiffGenerator.applyUpdateToDiff(
            [{ u: 'foobazbar' }],
            { op: [{ p: 0, d: 'foo' }], meta: this.meta }
          )
          return expect(diff).to.deep.equal([
            { d: 'foo', meta: this.meta },
            { u: 'bazbar' }
          ])
        })

        it('should delete from the end of (u)nchanged text', function () {
          const diff = this.DiffGenerator.applyUpdateToDiff(
            [{ u: 'foobazbar' }],
            { op: [{ p: 6, d: 'bar' }], meta: this.meta }
          )
          return expect(diff).to.deep.equal([
            { u: 'foobaz' },
            { d: 'bar', meta: this.meta }
          ])
        })

        return it('should delete across multiple (u)changed text parts', function () {
          const diff = this.DiffGenerator.applyUpdateToDiff(
            [{ u: 'foo' }, { u: 'baz' }, { u: 'bar' }],
            { op: [{ p: 2, d: 'obazb' }], meta: this.meta }
          )
          return expect(diff).to.deep.equal([
            { u: 'fo' },
            { d: 'o', meta: this.meta },
            { d: 'baz', meta: this.meta },
            { d: 'b', meta: this.meta },
            { u: 'ar' }
          ])
        })
      })

      describe('deleting inserts', function () {
        it('should delete from the middle of (i)nserted text', function () {
          const diff = this.DiffGenerator.applyUpdateToDiff(
            [{ i: 'foobazbar', meta: this.meta }],
            { op: [{ p: 3, d: 'baz' }], meta: this.meta }
          )
          return expect(diff).to.deep.equal([
            { i: 'foo', meta: this.meta },
            { i: 'bar', meta: this.meta }
          ])
        })

        it('should delete from the start of (u)nchanged text', function () {
          const diff = this.DiffGenerator.applyUpdateToDiff(
            [{ i: 'foobazbar', meta: this.meta }],
            { op: [{ p: 0, d: 'foo' }], meta: this.meta }
          )
          return expect(diff).to.deep.equal([{ i: 'bazbar', meta: this.meta }])
        })

        it('should delete from the end of (u)nchanged text', function () {
          const diff = this.DiffGenerator.applyUpdateToDiff(
            [{ i: 'foobazbar', meta: this.meta }],
            { op: [{ p: 6, d: 'bar' }], meta: this.meta }
          )
          return expect(diff).to.deep.equal([{ i: 'foobaz', meta: this.meta }])
        })

        return it('should delete across multiple (u)changed and (i)nserted text parts', function () {
          const diff = this.DiffGenerator.applyUpdateToDiff(
            [{ u: 'foo' }, { i: 'baz', meta: this.meta }, { u: 'bar' }],
            { op: [{ p: 2, d: 'obazb' }], meta: this.meta }
          )
          return expect(diff).to.deep.equal([
            { u: 'fo' },
            { d: 'o', meta: this.meta },
            { d: 'b', meta: this.meta },
            { u: 'ar' }
          ])
        })
      })

      describe('deleting over existing deletes', function () {
        return it('should delete across multiple (u)changed and (d)deleted text parts', function () {
          const diff = this.DiffGenerator.applyUpdateToDiff(
            [{ u: 'foo' }, { d: 'baz', meta: this.meta }, { u: 'bar' }],
            { op: [{ p: 2, d: 'ob' }], meta: this.meta }
          )
          return expect(diff).to.deep.equal([
            { u: 'fo' },
            { d: 'o', meta: this.meta },
            { d: 'baz', meta: this.meta },
            { d: 'b', meta: this.meta },
            { u: 'ar' }
          ])
        })
      })

      describe("deleting when the text doesn't match", function () {
        it('should throw an error when deleting from the middle of (u)nchanged text', function () {
          return expect(() =>
            this.DiffGenerator.applyUpdateToDiff([{ u: 'foobazbar' }], {
              op: [{ p: 3, d: 'xxx' }],
              meta: this.meta
            })
          ).to.throw(this.DiffGenerator.ConsistencyError)
        })

        it('should throw an error when deleting from the start of (u)nchanged text', function () {
          return expect(() =>
            this.DiffGenerator.applyUpdateToDiff([{ u: 'foobazbar' }], {
              op: [{ p: 0, d: 'xxx' }],
              meta: this.meta
            })
          ).to.throw(this.DiffGenerator.ConsistencyError)
        })

        return it('should throw an error when deleting from the end of (u)nchanged text', function () {
          return expect(() =>
            this.DiffGenerator.applyUpdateToDiff([{ u: 'foobazbar' }], {
              op: [{ p: 6, d: 'xxx' }],
              meta: this.meta
            })
          ).to.throw(this.DiffGenerator.ConsistencyError)
        })
      })

      describe('when the last update in the existing diff is a delete', function () {
        return it('should insert the new update before the delete', function () {
          const diff = this.DiffGenerator.applyUpdateToDiff(
            [{ u: 'foo' }, { d: 'bar', meta: this.meta }],
            { op: [{ p: 3, i: 'baz' }], meta: this.meta }
          )
          return expect(diff).to.deep.equal([
            { u: 'foo' },
            { i: 'baz', meta: this.meta },
            { d: 'bar', meta: this.meta }
          ])
        })
      })

      return describe('when the only update in the existing diff is a delete', function () {
        return it('should insert the new update after the delete', function () {
          const diff = this.DiffGenerator.applyUpdateToDiff(
            [{ d: 'bar', meta: this.meta }],
            { op: [{ p: 0, i: 'baz' }], meta: this.meta }
          )
          return expect(diff).to.deep.equal([
            { d: 'bar', meta: this.meta },
            { i: 'baz', meta: this.meta }
          ])
        })
      })
    })
  })
})
