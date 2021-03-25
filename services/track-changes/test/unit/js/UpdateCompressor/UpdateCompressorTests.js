/* eslint-disable
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = '../../../../app/js/UpdateCompressor.js'
const SandboxedModule = require('sandboxed-module')

const bigstring = __range__(0, 2 * 1024 * 1024, true)
  .map((i) => 'a')
  .join('')
const mediumstring = __range__(0, 1024 * 1024, true)
  .map((j) => 'a')
  .join('')

describe('UpdateCompressor', function () {
  beforeEach(function () {
    this.UpdateCompressor = SandboxedModule.require(modulePath, {
      requires: {
        '../lib/diff_match_patch': require('../../../../app/lib/diff_match_patch')
      }
    })
    this.user_id = 'user-id-1'
    this.other_user_id = 'user-id-2'
    this.ts1 = Date.now()
    return (this.ts2 = Date.now() + 1000)
  })

  describe('convertToSingleOpUpdates', function () {
    it('should split grouped updates into individual updates', function () {
      return expect(
        this.UpdateCompressor.convertToSingleOpUpdates([
          {
            op: [
              (this.op1 = { p: 0, i: 'Foo' }),
              (this.op2 = { p: 6, i: 'bar' })
            ],
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 42
          },
          {
            op: [(this.op3 = { p: 10, i: 'baz' })],
            meta: { ts: this.ts2, user_id: this.other_user_id },
            v: 43
          }
        ])
      ).to.deep.equal([
        {
          op: this.op1,
          meta: { start_ts: this.ts1, end_ts: this.ts1, user_id: this.user_id },
          v: 42
        },
        {
          op: this.op2,
          meta: { start_ts: this.ts1, end_ts: this.ts1, user_id: this.user_id },
          v: 42
        },
        {
          op: this.op3,
          meta: {
            start_ts: this.ts2,
            end_ts: this.ts2,
            user_id: this.other_user_id
          },
          v: 43
        }
      ])
    })

    it('should return no-op updates when the op list is empty', function () {
      return expect(
        this.UpdateCompressor.convertToSingleOpUpdates([
          {
            op: [],
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 42
          }
        ])
      ).to.deep.equal([
        {
          op: this.UpdateCompressor.NOOP,
          meta: { start_ts: this.ts1, end_ts: this.ts1, user_id: this.user_id },
          v: 42
        }
      ])
    })

    return it('should ignore comment ops', function () {
      return expect(
        this.UpdateCompressor.convertToSingleOpUpdates([
          {
            op: [
              (this.op1 = { p: 0, i: 'Foo' }),
              (this.op2 = { p: 9, c: 'baz' }),
              (this.op3 = { p: 6, i: 'bar' })
            ],
            meta: { ts: this.ts1, user_id: this.user_id },
            v: 42
          }
        ])
      ).to.deep.equal([
        {
          op: this.op1,
          meta: { start_ts: this.ts1, end_ts: this.ts1, user_id: this.user_id },
          v: 42
        },
        {
          op: this.op3,
          meta: { start_ts: this.ts1, end_ts: this.ts1, user_id: this.user_id },
          v: 42
        }
      ])
    })
  })

  describe('concatUpdatesWithSameVersion', function () {
    it('should concat updates with the same version', function () {
      return expect(
        this.UpdateCompressor.concatUpdatesWithSameVersion([
          {
            op: (this.op1 = { p: 0, i: 'Foo' }),
            meta: {
              start_ts: this.ts1,
              end_ts: this.ts1,
              user_id: this.user_id
            },
            v: 42
          },
          {
            op: (this.op2 = { p: 6, i: 'bar' }),
            meta: {
              start_ts: this.ts1,
              end_ts: this.ts1,
              user_id: this.user_id
            },
            v: 42
          },
          {
            op: (this.op3 = { p: 10, i: 'baz' }),
            meta: {
              start_ts: this.ts2,
              end_ts: this.ts2,
              user_id: this.other_user_id
            },
            v: 43
          }
        ])
      ).to.deep.equal([
        {
          op: [this.op1, this.op2],
          meta: { start_ts: this.ts1, end_ts: this.ts1, user_id: this.user_id },
          v: 42
        },
        {
          op: [this.op3],
          meta: {
            start_ts: this.ts2,
            end_ts: this.ts2,
            user_id: this.other_user_id
          },
          v: 43
        }
      ])
    })

    return it('should turn a noop into an empty op', function () {
      return expect(
        this.UpdateCompressor.concatUpdatesWithSameVersion([
          {
            op: this.UpdateCompressor.NOOP,
            meta: {
              start_ts: this.ts1,
              end_ts: this.ts1,
              user_id: this.user_id
            },
            v: 42
          }
        ])
      ).to.deep.equal([
        {
          op: [],
          meta: { start_ts: this.ts1, end_ts: this.ts1, user_id: this.user_id },
          v: 42
        }
      ])
    })
  })

  describe('compress', function () {
    describe('insert - insert', function () {
      it('should append one insert to the other', function () {
        return expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42
            },
            {
              op: { p: 6, i: 'bar' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43
            }
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: 'foobar' },
            meta: {
              start_ts: this.ts1,
              end_ts: this.ts2,
              user_id: this.user_id
            },
            v: 43
          }
        ])
      })

      it('should insert one insert inside the other', function () {
        return expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42
            },
            {
              op: { p: 5, i: 'bar' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43
            }
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: 'fobaro' },
            meta: {
              start_ts: this.ts1,
              end_ts: this.ts2,
              user_id: this.user_id
            },
            v: 43
          }
        ])
      })

      it('should not append separated inserts', function () {
        return expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42
            },
            {
              op: { p: 9, i: 'bar' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43
            }
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: 'foo' },
            meta: {
              start_ts: this.ts1,
              end_ts: this.ts1,
              user_id: this.user_id
            },
            v: 42
          },
          {
            op: { p: 9, i: 'bar' },
            meta: {
              start_ts: this.ts2,
              end_ts: this.ts2,
              user_id: this.user_id
            },
            v: 43
          }
        ])
      })

      it('should not append inserts that are too big (second op)', function () {
        return expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42
            },
            {
              op: { p: 6, i: bigstring },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43
            }
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: 'foo' },
            meta: {
              start_ts: this.ts1,
              end_ts: this.ts1,
              user_id: this.user_id
            },
            v: 42
          },
          {
            op: { p: 6, i: bigstring },
            meta: {
              start_ts: this.ts2,
              end_ts: this.ts2,
              user_id: this.user_id
            },
            v: 43
          }
        ])
      })

      it('should not append inserts that are too big (first op)', function () {
        return expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: bigstring },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42
            },
            {
              op: { p: 3 + bigstring.length, i: 'bar' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43
            }
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: bigstring },
            meta: {
              start_ts: this.ts1,
              end_ts: this.ts1,
              user_id: this.user_id
            },
            v: 42
          },
          {
            op: { p: 3 + bigstring.length, i: 'bar' },
            meta: {
              start_ts: this.ts2,
              end_ts: this.ts2,
              user_id: this.user_id
            },
            v: 43
          }
        ])
      })

      return it('should not append inserts that are too big (first and second op)', function () {
        return expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: mediumstring },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42
            },
            {
              op: { p: 3 + mediumstring.length, i: mediumstring },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43
            }
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: mediumstring },
            meta: {
              start_ts: this.ts1,
              end_ts: this.ts1,
              user_id: this.user_id
            },
            v: 42
          },
          {
            op: { p: 3 + mediumstring.length, i: mediumstring },
            meta: {
              start_ts: this.ts2,
              end_ts: this.ts2,
              user_id: this.user_id
            },
            v: 43
          }
        ])
      })
    })

    describe('delete - delete', function () {
      it('should append one delete to the other', function () {
        return expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, d: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42
            },
            {
              op: { p: 3, d: 'bar' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43
            }
          ])
        ).to.deep.equal([
          {
            op: { p: 3, d: 'foobar' },
            meta: {
              start_ts: this.ts1,
              end_ts: this.ts2,
              user_id: this.user_id
            },
            v: 43
          }
        ])
      })

      it('should insert one delete inside the other', function () {
        return expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, d: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42
            },
            {
              op: { p: 1, d: 'bar' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43
            }
          ])
        ).to.deep.equal([
          {
            op: { p: 1, d: 'bafoor' },
            meta: {
              start_ts: this.ts1,
              end_ts: this.ts2,
              user_id: this.user_id
            },
            v: 43
          }
        ])
      })

      return it('should not append separated deletes', function () {
        return expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, d: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42
            },
            {
              op: { p: 9, d: 'bar' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43
            }
          ])
        ).to.deep.equal([
          {
            op: { p: 3, d: 'foo' },
            meta: {
              start_ts: this.ts1,
              end_ts: this.ts1,
              user_id: this.user_id
            },
            v: 42
          },
          {
            op: { p: 9, d: 'bar' },
            meta: {
              start_ts: this.ts2,
              end_ts: this.ts2,
              user_id: this.user_id
            },
            v: 43
          }
        ])
      })
    })

    describe('insert - delete', function () {
      it('should undo a previous insert', function () {
        return expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42
            },
            {
              op: { p: 5, d: 'o' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43
            }
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: 'fo' },
            meta: {
              start_ts: this.ts1,
              end_ts: this.ts2,
              user_id: this.user_id
            },
            v: 43
          }
        ])
      })

      it('should remove part of an insert from the middle', function () {
        return expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: 'fobaro' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42
            },
            {
              op: { p: 5, d: 'bar' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43
            }
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: 'foo' },
            meta: {
              start_ts: this.ts1,
              end_ts: this.ts2,
              user_id: this.user_id
            },
            v: 43
          }
        ])
      })

      it('should cancel out two opposite updates', function () {
        return expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42
            },
            {
              op: { p: 3, d: 'foo' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43
            }
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: '' },
            meta: {
              start_ts: this.ts1,
              end_ts: this.ts2,
              user_id: this.user_id
            },
            v: 43
          }
        ])
      })

      it('should not combine separated updates', function () {
        return expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: 'foo' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42
            },
            {
              op: { p: 9, d: 'bar' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43
            }
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: 'foo' },
            meta: {
              start_ts: this.ts1,
              end_ts: this.ts1,
              user_id: this.user_id
            },
            v: 42
          },
          {
            op: { p: 9, d: 'bar' },
            meta: {
              start_ts: this.ts2,
              end_ts: this.ts2,
              user_id: this.user_id
            },
            v: 43
          }
        ])
      })

      return it('should not combine updates with overlap beyond the end', function () {
        return expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, i: 'foobar' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42
            },
            {
              op: { p: 6, d: 'bardle' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43
            }
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: 'foobar' },
            meta: {
              start_ts: this.ts1,
              end_ts: this.ts1,
              user_id: this.user_id
            },
            v: 42
          },
          {
            op: { p: 6, d: 'bardle' },
            meta: {
              start_ts: this.ts2,
              end_ts: this.ts2,
              user_id: this.user_id
            },
            v: 43
          }
        ])
      })
    })

    describe('delete - insert', function () {
      it('should do a diff of the content', function () {
        return expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, d: 'one two three four five six seven eight' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42
            },
            {
              op: { p: 3, i: 'one 2 three four five six seven eight' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43
            }
          ])
        ).to.deep.equal([
          {
            op: { p: 7, d: 'two' },
            meta: {
              start_ts: this.ts1,
              end_ts: this.ts2,
              user_id: this.user_id
            },
            v: 43
          },
          {
            op: { p: 7, i: '2' },
            meta: {
              start_ts: this.ts1,
              end_ts: this.ts2,
              user_id: this.user_id
            },
            v: 43
          }
        ])
      })

      return it('should return a no-op if the delete and insert are the same', function () {
        return expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: { p: 3, d: 'one two three four five six seven eight' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42
            },
            {
              op: { p: 3, i: 'one two three four five six seven eight' },
              meta: { ts: this.ts2, user_id: this.user_id },
              v: 43
            }
          ])
        ).to.deep.equal([
          {
            op: { p: 3, i: '' },
            meta: {
              start_ts: this.ts1,
              end_ts: this.ts2,
              user_id: this.user_id
            },
            v: 43
          }
        ])
      })
    })

    describe('noop - insert', function () {
      return it('should leave them untouched', function () {
        return expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: this.UpdateCompressor.NOOP,
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42
            },
            {
              op: { p: 6, i: 'bar' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 43
            }
          ])
        ).to.deep.equal([
          {
            op: this.UpdateCompressor.NOOP,
            meta: {
              start_ts: this.ts1,
              end_ts: this.ts1,
              user_id: this.user_id
            },
            v: 42
          },
          {
            op: { p: 6, i: 'bar' },
            meta: {
              start_ts: this.ts1,
              end_ts: this.ts1,
              user_id: this.user_id
            },
            v: 43
          }
        ])
      })
    })

    return describe('noop - delete', function () {
      return it('should leave them untouched', function () {
        return expect(
          this.UpdateCompressor.compressUpdates([
            {
              op: this.UpdateCompressor.NOOP,
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 42
            },
            {
              op: { p: 6, d: 'bar' },
              meta: { ts: this.ts1, user_id: this.user_id },
              v: 43
            }
          ])
        ).to.deep.equal([
          {
            op: this.UpdateCompressor.NOOP,
            meta: {
              start_ts: this.ts1,
              end_ts: this.ts1,
              user_id: this.user_id
            },
            v: 42
          },
          {
            op: { p: 6, d: 'bar' },
            meta: {
              start_ts: this.ts1,
              end_ts: this.ts1,
              user_id: this.user_id
            },
            v: 43
          }
        ])
      })
    })
  })

  return describe('compressRawUpdates', function () {
    return describe('merging in-place with an array op', function () {
      return it('should not change the existing last updates', function () {
        return expect(
          this.UpdateCompressor.compressRawUpdates(
            {
              op: [
                { p: 1000, d: 'hello' },
                { p: 1000, i: 'HELLO()' }
              ],
              meta: {
                start_ts: this.ts1,
                end_ts: this.ts1,
                user_id: this.user_id
              },
              v: 42
            },
            [
              {
                op: [{ p: 1006, i: 'WORLD' }],
                meta: { ts: this.ts2, user_id: this.user_id },
                v: 43
              }
            ]
          )
        ).to.deep.equal([
          {
            op: [
              { p: 1000, d: 'hello' },
              { p: 1000, i: 'HELLO()' }
            ],
            meta: {
              start_ts: this.ts1,
              end_ts: this.ts1,
              user_id: this.user_id
            },
            v: 42
          },
          {
            op: [{ p: 1006, i: 'WORLD' }],
            meta: {
              start_ts: this.ts2,
              end_ts: this.ts2,
              user_id: this.user_id
            },
            v: 43
          }
        ])
      })
    })
  })
})

function __range__(left, right, inclusive) {
  const range = []
  const ascending = left < right
  const end = !inclusive ? right : ascending ? right + 1 : right - 1
  for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
    range.push(i)
  }
  return range
}
