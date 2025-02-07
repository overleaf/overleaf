import { expect } from 'chai'
import { strict as esmock } from 'esmock'

const MODULE_PATH = '../../../../app/js/UpdateCompressor.js'

const bigstring = 'a'.repeat(2 * 1024 * 1024)
const mediumstring = 'a'.repeat(1024 * 1024)

describe('UpdateCompressor', function () {
  beforeEach(async function () {
    this.UpdateCompressor = await esmock(MODULE_PATH)
    this.user_id = 'user-id-1'
    this.other_user_id = 'user-id-2'
    this.doc_id = 'mock-doc-id'
    this.doc_hash = 'doc-hash'
    this.ts1 = Date.now()
    this.ts2 = Date.now() + 1000
  })

  describe('convertToSingleOpUpdates', function () {
    it('should split grouped updates into individual updates', function () {
      expect(
        this.UpdateCompressor.convertToSingleOpUpdates([
          {
            op: [
              (this.op1 = { p: 0, i: 'Foo' }),
              (this.op2 = { p: 6, i: 'bar' }),
            ],
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 42,
          },
          {
            op: [(this.op3 = { p: 10, i: 'baz' })],
            meta: { ts: this.ts2, user_id: this.other_user_id },
            v: 43,
          },
        ])
      ).to.deep.equal([
        {
          op: this.op1,
          meta: { ts: this.ts1, user_id: this.user_id },
          v: 42,
        },
        {
          op: this.op2,
          meta: { ts: this.ts1, user_id: this.user_id },
          v: 42,
        },
        {
          op: this.op3,
          meta: { ts: this.ts2, user_id: this.other_user_id },
          v: 43,
        },
      ])
    })

    it('should return no-op updates when the op list is empty', function () {
      expect(
        this.UpdateCompressor.convertToSingleOpUpdates([
          {
            op: [],
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 42,
          },
        ])
      ).to.deep.equal([])
    })

    it('should not ignore comment ops', function () {
      expect(
        this.UpdateCompressor.convertToSingleOpUpdates([
          {
            op: [
              (this.op1 = { p: 0, i: 'Foo' }),
              (this.op2 = { p: 9, c: 'baz' }),
              (this.op3 = { p: 6, i: 'bar' }),
            ],
            meta: { ts: this.ts1, user_id: this.user_id, doc_length: 10 },
            v: 42,
          },
        ])
      ).to.deep.equal([
        {
          op: this.op1,
          meta: { ts: this.ts1, user_id: this.user_id, doc_length: 10 },
          v: 42,
        },
        {
          op: this.op2,
          meta: { ts: this.ts1, user_id: this.user_id, doc_length: 13 },
          v: 42,
        },
        {
          op: this.op3,
          meta: { ts: this.ts1, user_id: this.user_id, doc_length: 13 },
          v: 42,
        },
      ])
    })

    it('should not ignore retain ops with tracking data', function () {
      expect(
        this.UpdateCompressor.convertToSingleOpUpdates([
          {
            op: [
              (this.op1 = { p: 0, i: 'Foo' }),
              (this.op2 = {
                p: 9,
                r: 'baz',
                tracking: { type: 'none' },
              }),
              (this.op3 = { p: 6, i: 'bar' }),
            ],
            meta: { ts: this.ts1, user_id: this.user_id, doc_length: 10 },
            v: 42,
          },
        ])
      ).to.deep.equal([
        {
          op: this.op1,
          meta: { ts: this.ts1, user_id: this.user_id, doc_length: 10 },
          v: 42,
        },
        {
          op: this.op2,
          meta: { ts: this.ts1, user_id: this.user_id, doc_length: 13 },
          v: 42,
        },
        {
          op: this.op3,
          meta: { ts: this.ts1, user_id: this.user_id, doc_length: 13 },
          v: 42,
        },
      ])
    })

    it('should update doc_length when splitting after an insert', function () {
      expect(
        this.UpdateCompressor.convertToSingleOpUpdates([
          {
            op: [
              (this.op1 = { p: 0, i: 'foo' }),
              (this.op2 = { p: 6, d: 'bar' }),
            ],
            meta: { ts: this.ts1, user_id: this.user_id, doc_length: 20 },
            v: 42,
          },
        ])
      ).to.deep.equal([
        {
          op: this.op1,
          meta: { ts: this.ts1, user_id: this.user_id, doc_length: 20 },
          v: 42,
        },
        {
          op: this.op2,
          meta: { ts: this.ts1, user_id: this.user_id, doc_length: 23 },
          v: 42,
        },
      ])
    })

    it('should update doc_length when splitting after a delete', function () {
      expect(
        this.UpdateCompressor.convertToSingleOpUpdates([
          {
            op: [
              (this.op1 = { p: 0, d: 'foo' }),
              (this.op2 = { p: 6, i: 'bar' }),
            ],
            meta: { ts: this.ts1, user_id: this.user_id, doc_length: 20 },
            v: 42,
          },
        ])
      ).to.deep.equal([
        {
          op: this.op1,
          meta: { ts: this.ts1, user_id: this.user_id, doc_length: 20 },
          v: 42,
        },
        {
          op: this.op2,
          meta: { ts: this.ts1, user_id: this.user_id, doc_length: 17 },
          v: 42,
        },
      ])
    })

    it('should take tracked changes into account when calculating the doc length', function () {
      const meta = {
        ts: this.ts1,
        user_id: this.user_id,
        tc: 'tracked-change-id',
      }
      expect(
        this.UpdateCompressor.convertToSingleOpUpdates([
          {
            op: [
              { p: 6, i: 'orange' }, // doc_length += 6
              { p: 22, d: 'apple' }, // doc_length doesn't change
              { p: 12, i: 'melon', u: true }, // doc_length += 5
              { p: 18, i: 'banana', u: true, trackedDeleteRejection: true }, // doc_length doesn't change
              {
                p: 8,
                d: 'pineapple',
                trackedChanges: [{ type: 'insert', offset: 0, length: 9 }],
              }, // doc_length -= 9
              { p: 11, i: 'fruit salad' },
            ],
            meta: { ...meta, doc_length: 20, history_doc_length: 30 },
            v: 42,
          },
        ])
      ).to.deep.equal([
        {
          op: { p: 6, i: 'orange' },
          meta: { ...meta, doc_length: 30 },
          v: 42,
        },
        {
          op: { p: 22, d: 'apple' },
          meta: { ...meta, doc_length: 36 },
          v: 42,
        },
        {
          op: { p: 12, i: 'melon', u: true },
          meta: { ...meta, doc_length: 36 },
          v: 42,
        },
        {
          op: { p: 18, i: 'banana', u: true, trackedDeleteRejection: true },
          meta: { ...meta, doc_length: 41 },
          v: 42,
        },
        {
          op: {
            p: 8,
            d: 'pineapple',
            trackedChanges: [{ type: 'insert', offset: 0, length: 9 }],
          },
          meta: { ...meta, doc_length: 41 },
          v: 42,
        },
        {
          op: { p: 11, i: 'fruit salad' },
          meta: { ...meta, doc_length: 32 },
          v: 42,
        },
      ])
    })

    it('should set the doc hash on the last split update only', function () {
      const meta = {
        ts: this.ts1,
        user_id: this.user_id,
      }
      expect(
        this.UpdateCompressor.convertToSingleOpUpdates([
          {
            op: [
              { p: 0, i: 'foo' },
              { p: 6, i: 'bar' },
            ],
            meta: { ...meta, doc_hash: 'hash1' },
            v: 42,
          },
          {
            op: [{ p: 10, i: 'baz' }],
            meta: { ...meta, doc_hash: 'hash2' },
            v: 43,
          },
          {
            op: [
              { p: 0, d: 'foo' },
              { p: 20, i: 'quux' },
              { p: 3, d: 'bar' },
            ],
            meta: { ...meta, doc_hash: 'hash3' },
            v: 44,
          },
        ])
      ).to.deep.equal([
        { op: { p: 0, i: 'foo' }, meta, v: 42 },
        { op: { p: 6, i: 'bar' }, meta: { ...meta, doc_hash: 'hash1' }, v: 42 },
        {
          op: { p: 10, i: 'baz' },
          meta: { ...meta, doc_hash: 'hash2' },
          v: 43,
        },
        { op: { p: 0, d: 'foo' }, meta, v: 44 },
        { op: { p: 20, i: 'quux' }, meta, v: 44 },
        { op: { p: 3, d: 'bar' }, meta: { ...meta, doc_hash: 'hash3' }, v: 44 },
      ])
    })
  })

  describe('concatUpdatesWithSameVersion', function () {
    it('should concat updates with the same version, doc and pathname', function () {
      expect(
        this.UpdateCompressor.concatUpdatesWithSameVersion([
          {
            doc: this.doc_id,
            pathname: 'main.tex',
            op: (this.op1 = { p: 0, i: 'Foo' }),
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 42,
          },
          {
            doc: this.doc_id,
            pathname: 'main.tex',
            op: (this.op2 = { p: 6, i: 'bar' }),
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 42,
          },
          {
            doc: this.doc_id,
            pathname: 'main.tex',
            op: (this.op3 = { p: 10, i: 'baz' }),
            meta: { ts: this.ts2, user_id: this.other_user_id },
            v: 43,
          },
        ])
      ).to.deep.equal([
        {
          doc: this.doc_id,
          pathname: 'main.tex',
          op: [this.op1, this.op2],
          meta: { ts: this.ts1, user_id: this.user_id },
          v: 42,
        },
        {
          doc: this.doc_id,
          pathname: 'main.tex',
          op: [this.op3],
          meta: { ts: this.ts2, user_id: this.other_user_id },
          v: 43,
        },
      ])
    })

    it('should not concat updates with different doc id', function () {
      expect(
        this.UpdateCompressor.concatUpdatesWithSameVersion([
          {
            doc: this.doc_id,
            pathname: 'main.tex',
            op: (this.op1 = { p: 0, i: 'Foo' }),
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 42,
          },
          {
            doc: 'other',
            pathname: 'main.tex',
            op: (this.op2 = { p: 6, i: 'bar' }),
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 42,
          },
          {
            doc: this.doc_id,
            pathname: 'main.tex',
            op: (this.op3 = { p: 10, i: 'baz' }),
            meta: { ts: this.ts2, user_id: this.other_user_id },
            v: 43,
          },
        ])
      ).to.deep.equal([
        {
          doc: this.doc_id,
          pathname: 'main.tex',
          op: [this.op1],
          meta: { ts: this.ts1, user_id: this.user_id },
          v: 42,
        },
        {
          doc: 'other',
          pathname: 'main.tex',
          op: [this.op2],
          meta: { ts: this.ts1, user_id: this.user_id },
          v: 42,
        },
        {
          doc: this.doc_id,
          pathname: 'main.tex',
          op: [this.op3],
          meta: { ts: this.ts2, user_id: this.other_user_id },
          v: 43,
        },
      ])
    })

    it('should not concat text updates with project structure ops', function () {
      expect(
        this.UpdateCompressor.concatUpdatesWithSameVersion([
          {
            doc: this.doc_id,
            pathname: 'main.tex',
            op: (this.op1 = { p: 0, i: 'Foo' }),
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 42,
          },
          {
            pathname: 'main.tex',
            new_pathname: 'new.tex',
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 42,
          },
        ])
      ).to.deep.equal([
        {
          doc: this.doc_id,
          pathname: 'main.tex',
          op: [this.op1],
          meta: { ts: this.ts1, user_id: this.user_id },
          v: 42,
        },
        {
          pathname: 'main.tex',
          new_pathname: 'new.tex',
          meta: { ts: this.ts1, user_id: this.user_id },
          v: 42,
        },
      ])
    })

    it("should keep the doc hash only when it's on the last update", function () {
      const meta = { ts: this.ts1, user_id: this.user_id }
      const baseUpdate = { doc: this.doc_id, pathname: 'main.tex', meta }
      const updates = [
        { ...baseUpdate, op: { p: 0, i: 'foo' }, v: 1 },
        {
          ...baseUpdate,
          op: { p: 10, i: 'bar' },
          meta: { ...meta, doc_hash: 'hash1' },
          v: 1,
        },
        {
          ...baseUpdate,
          op: { p: 20, i: 'baz' },
          meta: { ...meta, doc_hash: 'hash2' },
          v: 2,
        },
        { ...baseUpdate, op: { p: 30, i: 'quux' }, v: 2 },
      ]
      expect(
        this.UpdateCompressor.concatUpdatesWithSameVersion(updates)
      ).to.deep.equal([
        {
          ...baseUpdate,
          op: [
            { p: 0, i: 'foo' },
            { p: 10, i: 'bar' },
          ],
          meta: { ...meta, doc_hash: 'hash1' },
          v: 1,
        },
        {
          ...baseUpdate,
          op: [
            { p: 20, i: 'baz' },
            { p: 30, i: 'quux' },
          ],
          v: 2,
        },
      ])
    })
  })

  describe('compress', function () {
    describe('insert - insert', function () {
      it('should append one insert to the other', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              op: { p: 6, i: 'bar' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: 'foobar' },
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 43,
          },
        ])
      })

      it('should insert one insert inside the other', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              op: { p: 5, i: 'bar' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: 'fobaro' },
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 43,
          },
        ])
      })

      it('should not append separated inserts', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              op: { p: 9, i: 'bar' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: 'foo' },
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 42,
          },
          {
            op: { p: 9, i: 'bar' },
            meta: { ts: this.ts2, user_id: this.user_id },
            v: 43,
          },
        ])
      })

      it('should not append inserts that are too big (second op)', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              op: { p: 6, i: bigstring },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: 'foo' },
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 42,
          },
          {
            op: { p: 6, i: bigstring },
            meta: { ts: this.ts2, user_id: this.user_id },
            v: 43,
          },
        ])
      })

      it('should not append inserts that are too big (first op)', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: bigstring },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              op: { p: 3 + bigstring.length, i: 'bar' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: bigstring },
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 42,
          },
          {
            op: { p: 3 + bigstring.length, i: 'bar' },
            meta: { ts: this.ts2, user_id: this.user_id },
            v: 43,
          },
        ])
      })

      it('should not append inserts that are too big (first and second op)', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: mediumstring },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              op: { p: 3 + mediumstring.length, i: mediumstring },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: mediumstring },
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 42,
          },
          {
            op: { p: 3 + mediumstring.length, i: mediumstring },
            meta: { ts: this.ts2, user_id: this.user_id },
            v: 43,
          },
        ])
      })

      it('should not append inserts that are a long time appart', function () {
        this.ts3 = this.ts1 + 120000 // 2 minutes
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              op: { p: 6, i: 'bar' },
              meta: { ts: this.ts3, user_id: this.user_id },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: 'foo' },
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 42,
          },
          {
            op: { p: 6, i: 'bar' },
            meta: { ts: this.ts3, user_id: this.user_id },
            v: 43,
          },
        ])
      })

      it('should not append inserts separated by project structure ops', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              pathname: '/old.tex',
              new_pathname: '/new.tex',
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 43,
            },
            {
              op: { p: 6, i: 'bar' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 44,
            },
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: 'foo' },
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 42,
          },
          {
            pathname: '/old.tex',
            new_pathname: '/new.tex',
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 43,
          },
          {
            op: { p: 6, i: 'bar' },
            meta: { ts: this.ts2, user_id: this.user_id },
            v: 44,
          },
        ])
      })

      it('should not append ops from different doc ids', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              doc: 'doc-one',
              op: { p: 3, i: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              doc: 'doc-two',
              op: { p: 6, i: 'bar' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            doc: 'doc-one',
            op: { p: 3, i: 'foo' },
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 42,
          },
          {
            doc: 'doc-two',
            op: { p: 6, i: 'bar' },
            meta: { ts: this.ts2, user_id: this.user_id },
            v: 43,
          },
        ])
      })

      it('should not append ops from different doc pathnames', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              pathname: 'doc-one',
              op: { p: 3, i: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              pathname: 'doc-two',
              op: { p: 6, i: 'bar' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            pathname: 'doc-one',
            op: { p: 3, i: 'foo' },
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 42,
          },
          {
            pathname: 'doc-two',
            op: { p: 6, i: 'bar' },
            meta: { ts: this.ts2, user_id: this.user_id },
            v: 43,
          },
        ])
      })

      it("should not merge updates that track changes and updates that don't", function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              pathname: 'main.tex',
              op: { p: 3, i: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              pathname: 'main.tex',
              op: { p: 6, i: 'bar' },
              meta: { ts: this.ts2, user_id: this.user_id, tc: 'tracking-id' },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            pathname: 'main.tex',
            op: { p: 3, i: 'foo' },
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 42,
          },
          {
            pathname: 'main.tex',
            op: { p: 6, i: 'bar' },
            meta: { ts: this.ts2, user_id: this.user_id, tc: 'tracking-id' },
            v: 43,
          },
        ])
      })

      it('should not merge undos with regular ops', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              pathname: 'main.tex',
              op: { p: 3, i: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              pathname: 'main.tex',
              op: { p: 6, i: 'bar', u: true },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            pathname: 'main.tex',
            op: { p: 3, i: 'foo' },
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 42,
          },
          {
            pathname: 'main.tex',
            op: { p: 6, i: 'bar', u: true },
            meta: { ts: this.ts2, user_id: this.user_id },
            v: 43,
          },
        ])
      })

      it('should not merge tracked delete rejections', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              pathname: 'main.tex',
              op: { p: 3, i: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              pathname: 'main.tex',
              op: { p: 6, i: 'bar', trackedDeleteRejection: true },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            pathname: 'main.tex',
            op: { p: 3, i: 'foo' },
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 42,
          },
          {
            pathname: 'main.tex',
            op: { p: 6, i: 'bar', trackedDeleteRejection: true },
            meta: { ts: this.ts2, user_id: this.user_id },
            v: 43,
          },
        ])
      })

      it('should preserve history metadata', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: 'foo', hpos: 13 },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              op: { p: 6, i: 'bar', hpos: 16 },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: 'foobar', hpos: 13 },
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 43,
          },
        ])
      })

      it('should not merge updates from different users', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: 'foo', hpos: 13 },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              op: { p: 6, i: 'bar', hpos: 16 },
              meta: { ts: this.ts2, user_id: this.other_user_id },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: 'foo', hpos: 13 },
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 42,
          },
          {
            op: { p: 6, i: 'bar', hpos: 16 },
            meta: { ts: this.ts2, user_id: this.other_user_id },
            v: 43,
          },
        ])
      })

      it('should not merge inserts inside different comments', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: 'foo', hpos: 13, commentIds: ['comment-id-1'] },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              op: { p: 6, i: 'bar', hpos: 16 },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: 'foo', hpos: 13, commentIds: ['comment-id-1'] },
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 42,
          },
          {
            op: { p: 6, i: 'bar', hpos: 16 },
            meta: { ts: this.ts2, user_id: this.user_id },
            v: 43,
          },
        ])
      })

      it('should propagate the commentIds property', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: 'foo', hpos: 13, commentIds: ['comment-id-1'] },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              op: { p: 6, i: 'bar', hpos: 16, commentIds: ['comment-id-1'] },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: 'foobar', hpos: 13, commentIds: ['comment-id-1'] },
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 43,
          },
        ])
      })
    })

    describe('delete - delete', function () {
      it('should append one delete to the other', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, d: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              op: { p: 3, d: 'bar' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            op: { p: 3, d: 'foobar' },
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 43,
          },
        ])
      })

      it('should insert one delete inside the other', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, d: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              op: { p: 1, d: 'bar' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            op: { p: 1, d: 'bafoor' },
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 43,
          },
        ])
      })

      it('should not append separated deletes', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, d: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              op: { p: 9, d: 'bar' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            op: { p: 3, d: 'foo' },
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 42,
          },
          {
            op: { p: 9, d: 'bar' },
            meta: { ts: this.ts2, user_id: this.user_id },
            v: 43,
          },
        ])
      })

      it('should not merge deletes over tracked changes', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, d: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              op: {
                p: 3,
                d: 'bar',
                trackedChanges: [{ type: 'delete', pos: 2, length: 10 }],
              },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            op: { p: 3, d: 'foo' },
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 42,
          },
          {
            op: {
              p: 3,
              d: 'bar',
              trackedChanges: [{ type: 'delete', pos: 2, length: 10 }],
            },
            meta: { ts: this.ts2, user_id: this.user_id },
            v: 43,
          },
        ])
      })

      it('should preserve history metadata', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, d: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              op: { p: 3, d: 'bar' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            op: { p: 3, d: 'foobar' },
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 43,
          },
        ])
      })

      it('should not merge when the deletes are tracked', function () {
        // TODO: We should be able to lift that constraint, but it would
        // require recalculating the hpos on the second op.
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, d: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id, tc: 'tracking-id' },
              v: 42,
            },
            {
              op: { p: 3, d: 'bar' },
              meta: { ts: this.ts2, user_id: this.user_id, tc: 'tracking-id' },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            op: { p: 3, d: 'foo' },
            meta: { ts: this.ts1, user_id: this.user_id, tc: 'tracking-id' },
            v: 42,
          },
          {
            op: { p: 3, d: 'bar' },
            meta: { ts: this.ts2, user_id: this.user_id, tc: 'tracking-id' },
            v: 43,
          },
        ])
      })
    })

    describe('insert - delete', function () {
      it('should undo a previous insert', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              op: { p: 5, d: 'o' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: 'fo' },
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 43,
          },
        ])
      })

      it('should remove part of an insert from the middle', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: 'fobaro' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              op: { p: 5, d: 'bar' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: 'foo' },
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 43,
          },
        ])
      })

      it('should cancel out two opposite updates', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              op: { p: 3, d: 'foo' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43,
            },
          ])
        ).to.deep.equal([])
      })

      it('should not combine separated updates', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              op: { p: 9, d: 'bar' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: 'foo' },
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 42,
          },
          {
            op: { p: 9, d: 'bar' },
            meta: { ts: this.ts2, user_id: this.user_id },
            v: 43,
          },
        ])
      })

      it('should not combine updates with overlap beyond the end', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: 'foobar' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              op: { p: 6, d: 'bardle' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: 'foobar' },
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 42,
          },
          {
            op: { p: 6, d: 'bardle' },
            meta: { ts: this.ts2, user_id: this.user_id },
            v: 43,
          },
        ])
      })

      it('should preserver history metadata', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: 'foo', hpos: 13 },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              op: { p: 5, d: 'o', hpos: 15 },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: 'fo', hpos: 13 },
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 43,
          },
        ])
      })
    })

    describe('delete - insert', function () {
      it('should do a diff of the content', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, d: 'one two three four five six seven eight' },
              meta: { ts: this.ts1, user_id: this.user_id, doc_length: 100 },
              v: 42,
            },
            {
              op: { p: 3, i: 'one 2 three four five six seven eight' },
              meta: { ts: this.ts2, user_id: this.user_id, doc_length: 100 },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            op: { p: 7, d: 'two' },
            meta: { ts: this.ts1, user_id: this.user_id, doc_length: 100 },
            v: 43,
          },
          {
            op: { p: 7, i: '2' },
            meta: { ts: this.ts1, user_id: this.user_id, doc_length: 97 },
            v: 43,
          },
        ])
      })

      it('should return a no-op if the delete and insert are the same', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, d: 'one two three four five six seven eight' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              op: { p: 3, i: 'one two three four five six seven eight' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43,
            },
          ])
        ).to.deep.equal([])
      })

      it('should preserve history metadata', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: {
                p: 3,
                d: 'one two three four five six seven eight',
                hpos: 13,
              },
              meta: { ts: this.ts1, user_id: this.user_id, doc_length: 100 },
              v: 42,
            },
            {
              op: {
                p: 3,
                i: 'one 2 three four five six seven eight',
                hpos: 13,
                commentIds: ['comment-1'],
              },
              meta: { ts: this.ts2, user_id: this.user_id, doc_length: 100 },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            op: { p: 7, d: 'two', hpos: 17 },
            meta: { ts: this.ts1, user_id: this.user_id, doc_length: 100 },
            v: 43,
          },
          {
            op: { p: 7, i: '2', hpos: 17, commentIds: ['comment-1'] },
            meta: { ts: this.ts1, user_id: this.user_id, doc_length: 97 },
            v: 43,
          },
        ])
      })

      it('should not merge when tracking changes', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, d: 'one two three four five six seven eight' },
              meta: {
                ts: this.ts1,
                user_id: this.user_id,
                doc_length: 100,
                tc: 'tracking-id',
              },
              v: 42,
            },
            {
              op: { p: 3, i: 'one 2 three four five six seven eight' },
              meta: {
                ts: this.ts2,
                user_id: this.user_id,
                doc_length: 100,
                tc: 'tracking-id',
              },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            op: { p: 3, d: 'one two three four five six seven eight' },
            meta: {
              ts: this.ts1,
              user_id: this.user_id,
              doc_length: 100,
              tc: 'tracking-id',
            },
            v: 42,
          },
          {
            op: { p: 3, i: 'one 2 three four five six seven eight' },
            meta: {
              ts: this.ts2,
              user_id: this.user_id,
              doc_length: 100,
              tc: 'tracking-id',
            },
            v: 43,
          },
        ])
      })
    })

    describe('a long chain of ops', function () {
      it('should always split after 60 seconds', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42,
            },
            {
              op: { p: 6, i: 'bar' },
              meta: { ts: this.ts1 + 20000, user_id: this.user_id },
              v: 43,
            },
            {
              op: { p: 9, i: 'baz' },
              meta: { ts: this.ts1 + 40000, user_id: this.user_id },
              v: 44,
            },
            {
              op: { p: 12, i: 'qux' },
              meta: { ts: this.ts1 + 80000, user_id: this.user_id },
              v: 45,
            },
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: 'foobarbaz' },
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 44,
          },
          {
            op: { p: 12, i: 'qux' },
            meta: { ts: this.ts1 + 80000, user_id: this.user_id },
            v: 45,
          },
        ])
      })
    })

    describe('external updates', function () {
      it('should be split from editor updates and from other sources', function () {
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: 'foo' },
              meta: {
                ts: this.ts1,
                user_id: this.user_id,
                source: 'some-editor-id',
              },
              v: 42,
            },
            {
              op: { p: 6, i: 'bar' },
              meta: {
                ts: this.ts1,
                user_id: this.user_id,
                source: 'some-other-editor-id',
              },
              v: 43,
            },
            {
              op: { p: 9, i: 'baz' },
              meta: {
                ts: this.ts1,
                user_id: this.user_id,
                type: 'external',
                source: 'dropbox',
              },
              v: 44,
            },
            {
              op: { p: 12, i: 'qux' },
              meta: {
                ts: this.ts1,
                user_id: this.user_id,
                type: 'external',
                source: 'dropbox',
              },
              v: 45,
            },
            {
              op: { p: 15, i: 'quux' },
              meta: {
                ts: this.ts1,
                user_id: this.user_id,
                type: 'external',
                source: 'upload',
              },
              v: 46,
            },
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: 'foobar' },
            meta: {
              ts: this.ts1,
              user_id: this.user_id,
              source: 'some-editor-id',
            },
            v: 43,
          },
          {
            op: { p: 9, i: 'bazqux' },
            meta: {
              ts: this.ts1,
              user_id: this.user_id,
              type: 'external',
              source: 'dropbox',
            },
            v: 45,
          },
          {
            op: { p: 15, i: 'quux' },
            meta: {
              ts: this.ts1,
              user_id: this.user_id,
              type: 'external',
              source: 'upload',
            },
            v: 46,
          },
        ])
      })
    })

    describe('doc hash', function () {
      it("should keep the doc hash if it's on the last update", function () {
        const meta = { ts: this.ts1, user_id: this.user_id }
        expect(
          this.UpdateCompressor.compressUpdates([
            { op: { p: 3, i: 'foo' }, meta, v: 42 },
            {
              op: { p: 6, i: 'bar' },
              meta: { ...meta, doc_hash: 'hash1' },
              v: 43,
            },
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: 'foobar' },
            meta: { ...meta, doc_hash: 'hash1' },
            v: 43,
          },
        ])
      })

      it("should not keep the doc hash if it's not on the last update", function () {
        const meta = { ts: this.ts1, user_id: this.user_id }
        expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: 'foo' },
              meta: { ...meta, doc_hash: 'hash1' },
              v: 42,
            },
            { op: { p: 6, i: 'bar' }, meta, v: 43 },
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: 'foobar' },
            meta,
            v: 43,
          },
        ])
      })

      it('special case for delete + insert triggering diff', function () {
        const meta = { ts: this.ts1, user_id: this.user_id, doc_length: 10 }
        expect(
          this.UpdateCompressor.compressUpdates([
            { op: { p: 3, d: 'foo' }, meta, v: 42 },
            {
              op: { p: 3, i: 'bar' },
              meta: { ...meta, doc_hash: 'hash1' },
              v: 43,
            },
          ])
        ).to.deep.equal([
          { op: { p: 3, d: 'foo' }, meta, v: 43 },
          {
            op: { p: 3, i: 'bar' },
            meta: { ...meta, doc_length: 7, doc_hash: 'hash1' },
            v: 43,
          },
        ])
      })
    })
  })
})
