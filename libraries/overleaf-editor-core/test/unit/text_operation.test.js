// @ts-check
//
// These tests are based on the OT.js tests:
// https://github.com/Operational-Transformation/ot.js/blob/
//   8873b7e28e83f9adbf6c3a28ec639c9151a838ae/test/lib/test-text-operation.js
//
'use strict'

const { expect } = require('chai')
const random = require('./support/random')
const randomOperation = require('./support/random_text_operation')

const ot = require('../..')
const TextOperation = ot.TextOperation
const StringFileData = require('../../lib/file_data/string_file_data')
const { RetainOp, InsertOp, RemoveOp } = require('../../lib/operation/scan_op')
const TrackingProps = require('../../lib/file_data/tracking_props')
const ClearTrackingProps = require('../../lib/file_data/clear_tracking_props')

describe('TextOperation', function () {
  const numTrials = 500

  it('tracks base and target lengths', function () {
    const o = new TextOperation()
    expect(o.baseLength).to.equal(0)
    expect(o.targetLength).to.equal(0)
    o.retain(5)
    expect(o.baseLength).to.equal(5)
    expect(o.targetLength).to.equal(5)
    o.insert('abc')
    expect(o.baseLength).to.equal(5)
    expect(o.targetLength).to.equal(8)
    o.retain(2)
    expect(o.baseLength).to.equal(7)
    expect(o.targetLength).to.equal(10)
    o.remove(2)
    expect(o.baseLength).to.equal(9)
    expect(o.targetLength).to.equal(10)
  })

  it('supports chaining', function () {
    const o = new TextOperation()
      .retain(5)
      .retain(0)
      .insert('lorem')
      .insert('')
      .remove('abc')
      .remove(3)
      .remove(0)
      .remove('')
    expect(o.ops.length).to.equal(3)
  })

  it('ignores empty operations', function () {
    const o = new TextOperation()
    o.retain(0)
    o.insert('')
    o.remove('')
    expect(o.ops.length).to.equal(0)
  })

  it('checks for equality', function () {
    const op1 = new TextOperation().remove(1).insert('lo').retain(2).retain(3)
    const op2 = new TextOperation().remove(-1).insert('l').insert('o').retain(5)
    expect(op1.equals(op2)).to.be.true
    op1.remove(1)
    op2.retain(1)
    expect(op1.equals(op2)).to.be.false
  })

  it('merges ops', function () {
    function last(arr) {
      return arr[arr.length - 1]
    }
    const o = new TextOperation()
    expect(o.ops.length).to.equal(0)
    o.retain(2)
    expect(o.ops.length).to.equal(1)
    expect(last(o.ops).equals(new RetainOp(2))).to.be.true
    o.retain(3)
    expect(o.ops.length).to.equal(1)
    expect(last(o.ops).equals(new RetainOp(5))).to.be.true
    o.insert('abc')
    expect(o.ops.length).to.equal(2)
    expect(last(o.ops).equals(new InsertOp('abc'))).to.be.true
    o.insert('xyz')
    expect(o.ops.length).to.equal(2)
    expect(last(o.ops).equals(new InsertOp('abcxyz'))).to.be.true
    o.remove('d')
    expect(o.ops.length).to.equal(3)
    expect(last(o.ops).equals(new RemoveOp(1))).to.be.true
    o.remove('d')
    expect(o.ops.length).to.equal(3)
    expect(last(o.ops).equals(new RemoveOp(2))).to.be.true
  })

  it('checks for no-ops', function () {
    const o = new TextOperation()
    expect(o.isNoop()).to.be.true
    o.retain(5)
    expect(o.isNoop()).to.be.true
    o.retain(3)
    expect(o.isNoop()).to.be.true
    o.insert('lorem')
    expect(o.isNoop()).to.be.false
  })

  it('converts to string', function () {
    const o = new TextOperation()
    o.retain(2)
    o.insert('lorem')
    o.remove('ipsum')
    o.retain(5)
    expect(o.toString()).to.equal(
      "retain 2, insert 'lorem', remove 5, retain 5"
    )
  })

  it('converts from JSON', function () {
    const ops = [2, -1, -1, 'cde']
    const o = TextOperation.fromJSON({ textOperation: ops })
    expect(o.ops.length).to.equal(3)
    expect(o.baseLength).to.equal(4)
    expect(o.targetLength).to.equal(5)

    function assertIncorrectAfter(fn) {
      const ops2 = ops.slice(0)
      fn(ops2)
      expect(() => {
        TextOperation.fromJSON({ textOperation: ops2 })
      }).to.throw
    }

    assertIncorrectAfter(ops2 => {
      ops2.push({ insert: 'x' })
    })
    assertIncorrectAfter(ops2 => {
      ops2.push(null)
    })
  })

  it(
    'applies (randomised)',
    random.test(numTrials, () => {
      const str = random.string(50)
      const comments = random.comments(6)
      const o = randomOperation(str, comments.ids)
      expect(str.length).to.equal(o.baseLength)
      const file = new StringFileData(str, comments.comments)
      o.apply(file)
      const result = file.getContent()
      expect(result.length).to.equal(o.targetLength)
    })
  )

  it(
    'converts to/from JSON (randomised)',
    random.test(numTrials, () => {
      const doc = random.string(50)
      const comments = random.comments(2)
      const operation = randomOperation(doc, comments.ids)
      const roundTripOperation = TextOperation.fromJSON(operation.toJSON())
      expect(operation.equals(roundTripOperation)).to.be.true
    })
  )

  it('throws when invalid operations are applied', function () {
    const operation = new TextOperation().retain(1)
    expect(() => {
      operation.apply(new StringFileData(''))
    }).to.throw(TextOperation.ApplyError)
    expect(() => {
      operation.apply(new StringFileData(' '))
    }).not.to.throw
  })

  it('throws when insert text contains non BMP chars', function () {
    const operation = new TextOperation()
    const str = '𝌆\n'
    expect(() => {
      operation.insert(str)
    }).to.throw(
      TextOperation.UnprocessableError,
      /inserted text contains non BMP characters/
    )
  })

  it('throws when base string contains non BMP chars', function () {
    const operation = new TextOperation()
    const str = '𝌆\n'
    expect(() => {
      operation.apply(new StringFileData(str))
    }).to.throw(
      TextOperation.UnprocessableError,
      /string contains non BMP characters/
    )
  })

  it('throws at from JSON when it contains non BMP chars', function () {
    const operation = ['𝌆\n']
    expect(() => {
      TextOperation.fromJSON({ textOperation: operation })
    }).to.throw(
      TextOperation.UnprocessableError,
      /inserted text contains non BMP characters/
    )
  })

  describe('invert', function () {
    it(
      'inverts (randomised)',
      random.test(numTrials, () => {
        const str = random.string(50)
        const comments = random.comments(6)
        const o = randomOperation(str, comments.ids)
        const originalFile = new StringFileData(str, comments.comments)
        const p = o.invert(originalFile)
        expect(o.baseLength).to.equal(p.targetLength)
        expect(o.targetLength).to.equal(p.baseLength)
        const file = new StringFileData(str, comments.comments)
        o.apply(file)
        p.apply(file)
        const result = file.toRaw()
        expect(result).to.deep.equal(originalFile.toRaw())
      })
    )

    it('re-inserts removed range and comment when inverting', function () {
      expectInverseToLeadToInitialState(
        new StringFileData(
          'foo bar baz',
          [{ id: 'comment1', ranges: [{ pos: 4, length: 3 }] }],
          [
            {
              range: { pos: 4, length: 3 },
              tracking: {
                ts: '2024-01-01T00:00:00.000Z',
                type: 'insert',
                userId: 'user1',
              },
            },
          ]
        ),
        new TextOperation().retain(4).remove(4).retain(3)
      )
    })

    it('deletes inserted range and comment when inverting', function () {
      expectInverseToLeadToInitialState(
        new StringFileData('foo baz', [
          { id: 'comment1', ranges: [], resolved: false },
        ]),
        new TextOperation()
          .retain(4)
          .insert('bar', {
            commentIds: ['comment1'],
            tracking: TrackingProps.fromRaw({
              ts: '2024-01-01T00:00:00.000Z',
              type: 'insert',
              userId: 'user1',
            }),
          })
          .insert(' ')
          .retain(3)
      )
    })

    it('removes a tracked delete', function () {
      expectInverseToLeadToInitialState(
        new StringFileData('foo bar baz'),
        new TextOperation()
          .retain(4)
          .retain(4, {
            tracking: TrackingProps.fromRaw({
              ts: '2023-01-01T00:00:00.000Z',
              type: 'delete',
              userId: 'user1',
            }),
          })
          .retain(3)
      )
    })

    it('restores comments that were removed', function () {
      expectInverseToLeadToInitialState(
        new StringFileData('foo bar baz', [
          {
            id: 'comment1',
            ranges: [{ pos: 4, length: 3 }],
            resolved: false,
          },
        ]),
        new TextOperation().retain(4).remove(4).retain(3)
      )
    })

    it('re-inserting removed part of comment restores original comment range', function () {
      expectInverseToLeadToInitialState(
        new StringFileData('foo bar baz', [
          {
            id: 'comment1',
            ranges: [{ pos: 0, length: 11 }],
            resolved: false,
          },
        ]),
        new TextOperation().retain(4).remove(4).retain(3)
      )
    })

    it('re-inserting removed part of tracked change restores tracked change range', function () {
      expectInverseToLeadToInitialState(
        new StringFileData('foo bar baz', undefined, [
          {
            range: { pos: 0, length: 11 },
            tracking: {
              ts: '2023-01-01T00:00:00.000Z',
              type: 'delete',
              userId: 'user1',
            },
          },
        ]),
        new TextOperation().retain(4).remove(4).retain(3)
      )
    })

    it('undoing a tracked delete restores the tracked changes', function () {
      expectInverseToLeadToInitialState(
        new StringFileData(
          'the quick brown fox jumps over the lazy dog',
          undefined,
          [
            {
              range: { pos: 5, length: 5 },
              tracking: {
                ts: '2023-01-01T00:00:00.000Z',
                type: 'insert',
                userId: 'user1',
              },
            },
            {
              range: { pos: 12, length: 3 },
              tracking: {
                ts: '2023-01-01T00:00:00.000Z',
                type: 'delete',
                userId: 'user1',
              },
            },
            {
              range: { pos: 18, length: 5 },
              tracking: {
                ts: '2023-01-01T00:00:00.000Z',
                type: 'insert',
                userId: 'user1',
              },
            },
          ]
        ),
        new TextOperation()
          .retain(7)
          .retain(13, {
            tracking: new TrackingProps('delete', 'user1', new Date()),
          })
          .retain(23)
      )
    })
  })

  describe('compose', function () {
    it(
      'composes (randomised)',
      random.test(numTrials, () => {
        // invariant: apply(str, compose(a, b)) === apply(apply(str, a), b)
        const str = random.string(20)
        const comments = random.comments(6)
        const a = randomOperation(str, comments.ids)
        const file = new StringFileData(str, comments.comments)
        a.apply(file)
        const afterA = file.toRaw()
        expect(afterA.content.length).to.equal(a.targetLength)
        const b = randomOperation(afterA.content, comments.ids)
        b.apply(file)
        const afterB = file.toRaw()
        expect(afterB.content.length).to.equal(b.targetLength)
        const ab = a.compose(b)
        expect(ab.targetLength).to.equal(b.targetLength)
        ab.apply(new StringFileData(str, comments.comments))
        const afterAB = file.toRaw()
        expect(afterAB).to.deep.equal(afterB)
      })
    )

    it('composes two operations with comments', function () {
      expect(
        compose(
          new StringFileData('foo baz', [
            { id: 'comment1', ranges: [], resolved: false },
          ]),
          new TextOperation()
            .retain(4)
            .insert('bar', {
              commentIds: ['comment1'],
              tracking: TrackingProps.fromRaw({
                ts: '2024-01-01T00:00:00.000Z',
                type: 'insert',
                userId: 'user1',
              }),
            })
            .insert(' ')
            .retain(3),
          new TextOperation().retain(4).remove(4).retain(3)
        )
      ).to.deep.equal({
        content: 'foo baz',
        comments: [{ id: 'comment1', ranges: [] }],
      })
    })

    it('prioritizes tracked changes info from the latter operation', function () {
      expect(
        compose(
          new StringFileData('foo bar baz'),
          new TextOperation()
            .retain(4)
            .retain(4, {
              tracking: TrackingProps.fromRaw({
                ts: '2023-01-01T00:00:00.000Z',
                type: 'delete',
                userId: 'user1',
              }),
            })
            .retain(3),
          new TextOperation()
            .retain(4)
            .retain(4, {
              tracking: TrackingProps.fromRaw({
                ts: '2024-01-01T00:00:00.000Z',
                type: 'delete',
                userId: 'user2',
              }),
            })
            .retain(3)
        )
      ).to.deep.equal({
        content: 'foo bar baz',
        trackedChanges: [
          {
            range: { pos: 4, length: 4 },
            tracking: {
              ts: '2024-01-01T00:00:00.000Z',
              type: 'delete',
              userId: 'user2',
            },
          },
        ],
      })
    })

    it('does not remove tracked change if not overriden by operation 2', function () {
      expect(
        compose(
          new StringFileData('foo bar baz'),
          new TextOperation()
            .retain(4)
            .retain(4, {
              tracking: TrackingProps.fromRaw({
                ts: '2023-01-01T00:00:00.000Z',
                type: 'delete',
                userId: 'user1',
              }),
            })
            .retain(3),
          new TextOperation().retain(11)
        )
      ).to.deep.equal({
        content: 'foo bar baz',
        trackedChanges: [
          {
            range: { pos: 4, length: 4 },
            tracking: {
              ts: '2023-01-01T00:00:00.000Z',
              type: 'delete',
              userId: 'user1',
            },
          },
        ],
      })
    })

    it('adds comment ranges from both operations', function () {
      expect(
        compose(
          new StringFileData('foo bar baz', [
            {
              id: 'comment1',
              ranges: [{ pos: 4, length: 3 }],
              resolved: false,
            },
            {
              id: 'comment2',
              ranges: [{ pos: 8, length: 3 }],
              resolved: false,
            },
          ]),
          new TextOperation()
            .retain(5)
            .insert('aa', {
              commentIds: ['comment1'],
            })
            .retain(6),
          new TextOperation()
            .retain(11)
            .insert('bb', { commentIds: ['comment2'] })
            .retain(2)
        )
      ).to.deep.equal({
        content: 'foo baaar bbbaz',
        comments: [
          { id: 'comment1', ranges: [{ pos: 4, length: 5 }] },
          { id: 'comment2', ranges: [{ pos: 10, length: 5 }] },
        ],
      })
    })

    it('it removes the tracking range from a tracked delete if operation 2 resolves it', function () {
      expect(
        compose(
          new StringFileData('foo bar baz'),
          new TextOperation()
            .retain(4)
            .retain(4, {
              tracking: TrackingProps.fromRaw({
                ts: '2023-01-01T00:00:00.000Z',
                type: 'delete',
                userId: 'user1',
              }),
            })
            .retain(3),
          new TextOperation()
            .retain(4)
            .retain(4, {
              tracking: new ClearTrackingProps(),
            })
            .retain(3)
        )
      ).to.deep.equal({
        content: 'foo bar baz',
      })
    })

    it('it removes the tracking from an insert if operation 2 resolves it', function () {
      expect(
        compose(
          new StringFileData('foo bar baz'),
          new TextOperation()
            .retain(4)
            .insert('quux ', {
              tracking: TrackingProps.fromRaw({
                ts: '2023-01-01T00:00:00.000Z',
                type: 'insert',
                userId: 'user1',
              }),
            })
            .retain(7),
          new TextOperation()
            .retain(6)
            .retain(5, {
              tracking: new ClearTrackingProps(),
            })
            .retain(5)
        )
      ).to.deep.equal({
        content: 'foo quux bar baz',
        trackedChanges: [
          {
            range: { pos: 4, length: 2 },
            tracking: {
              ts: '2023-01-01T00:00:00.000Z',
              type: 'insert',
              userId: 'user1',
            },
          },
        ],
      })
    })
  })

  describe('transform', function () {
    it(
      'transforms (randomised)',
      random.test(numTrials, () => {
        // invariant: compose(a, b') = compose(b, a')
        // where (a', b') = transform(a, b)
        const str = random.string(20)
        const comments = random.comments(6)
        const a = randomOperation(str, comments.ids)
        const b = randomOperation(str, comments.ids)
        const primes = TextOperation.transform(a, b)
        const aPrime = primes[0]
        const bPrime = primes[1]
        const abPrime = a.compose(bPrime)
        const baPrime = b.compose(aPrime)
        const abFile = new StringFileData(str, comments.comments)
        const baFile = new StringFileData(str, comments.comments)
        abPrime.apply(abFile)
        baPrime.apply(baFile)
        expect(abPrime.equals(baPrime)).to.be.true
        expect(abFile.toRaw()).to.deep.equal(baFile.toRaw())
      })
    )

    it('adds a tracked change from operation 1', function () {
      expect(
        transform(
          new StringFileData('foo baz'),
          new TextOperation()
            .retain(4)
            .insert('bar', {
              tracking: TrackingProps.fromRaw({
                ts: '2024-01-01T00:00:00.000Z',
                type: 'insert',
                userId: 'user1',
              }),
            })
            .insert(' ')
            .retain(3),
          new TextOperation().retain(7).insert(' qux')
        )
      ).to.deep.equal({
        content: 'foo bar baz qux',
        trackedChanges: [
          {
            range: { pos: 4, length: 3 },
            tracking: {
              ts: '2024-01-01T00:00:00.000Z',
              type: 'insert',
              userId: 'user1',
            },
          },
        ],
      })
    })

    it('prioritizes tracked change from the first operation', function () {
      expect(
        transform(
          new StringFileData('foo bar baz'),
          new TextOperation()
            .retain(4)
            .retain(4, {
              tracking: TrackingProps.fromRaw({
                ts: '2023-01-01T00:00:00.000Z',
                type: 'delete',
                userId: 'user1',
              }),
            })
            .retain(3),
          new TextOperation()
            .retain(4)
            .retain(4, {
              tracking: TrackingProps.fromRaw({
                ts: '2024-01-01T00:00:00.000Z',
                type: 'delete',
                userId: 'user2',
              }),
            })
            .retain(3)
        )
      ).to.deep.equal({
        content: 'foo bar baz',
        trackedChanges: [
          {
            range: { pos: 4, length: 4 },
            tracking: {
              ts: '2023-01-01T00:00:00.000Z',
              type: 'delete',
              userId: 'user1',
            },
          },
        ],
      })
    })

    it('splits a tracked change in two to resolve conflicts', function () {
      expect(
        transform(
          new StringFileData('foo bar baz'),
          new TextOperation()
            .retain(4)
            .retain(4, {
              tracking: TrackingProps.fromRaw({
                ts: '2023-01-01T00:00:00.000Z',
                type: 'delete',
                userId: 'user1',
              }),
            })
            .retain(3),
          new TextOperation()
            .retain(4)
            .retain(5, {
              tracking: TrackingProps.fromRaw({
                ts: '2024-01-01T00:00:00.000Z',
                type: 'delete',
                userId: 'user2',
              }),
            })
            .retain(2)
        )
      ).to.deep.equal({
        content: 'foo bar baz',
        trackedChanges: [
          {
            range: { pos: 4, length: 4 },
            tracking: {
              ts: '2023-01-01T00:00:00.000Z',
              type: 'delete',
              userId: 'user1',
            },
          },
          {
            range: { pos: 8, length: 1 },
            tracking: {
              ts: '2024-01-01T00:00:00.000Z',
              type: 'delete',
              userId: 'user2',
            },
          },
        ],
      })
    })

    it('inserts a tracked change from operation 2 after a tracked change from operation 1', function () {
      expect(
        transform(
          new StringFileData('aaabbbccc'),
          new TextOperation()
            .retain(3)
            .insert('xxx', {
              tracking: TrackingProps.fromRaw({
                ts: '2023-01-01T00:00:00.000Z',
                type: 'insert',
                userId: 'user1',
              }),
            })
            .retain(6),
          new TextOperation()
            .retain(3)
            .insert('yyy', {
              tracking: TrackingProps.fromRaw({
                ts: '2024-01-01T00:00:00.000Z',
                type: 'insert',
                userId: 'user2',
              }),
            })
            .retain(6)
        )
      ).to.deep.equal({
        content: 'aaaxxxyyybbbccc',
        trackedChanges: [
          {
            range: { pos: 3, length: 3 },
            tracking: {
              ts: '2023-01-01T00:00:00.000Z',
              type: 'insert',
              userId: 'user1',
            },
          },
          {
            range: { pos: 6, length: 3 },
            tracking: {
              ts: '2024-01-01T00:00:00.000Z',
              type: 'insert',
              userId: 'user2',
            },
          },
        ],
      })
    })

    it('preserves a comment even if it is completely removed in one operation', function () {
      expect(
        transform(
          new StringFileData('foo bar baz', [
            {
              id: 'comment1',
              ranges: [{ pos: 4, length: 3 }],
              resolved: false,
            },
          ]),
          new TextOperation().retain(4).remove(4).retain(3),
          new TextOperation()
            .retain(7)
            .insert('qux ', {
              commentIds: ['comment1'],
            })
            .retain(4)
        )
      ).to.deep.equal({
        content: 'foo qux baz',
        comments: [{ id: 'comment1', ranges: [{ pos: 4, length: 4 }] }],
      })
    })

    it('extends a comment to both ranges if both operations add text in it', function () {
      expect(
        transform(
          new StringFileData('foo bar baz', [
            {
              id: 'comment1',
              ranges: [{ pos: 4, length: 3 }],
              resolved: false,
            },
          ]),
          new TextOperation()
            .retain(4)
            .insert('qux ', {
              commentIds: ['comment1'],
            })
            .retain(7),
          new TextOperation()
            .retain(4)
            .insert('corge ', { commentIds: ['comment1'] })
            .retain(7)
        )
      ).to.deep.equal({
        content: 'foo qux corge bar baz',
        comments: [{ id: 'comment1', ranges: [{ pos: 4, length: 13 }] }],
      })
    })

    it('adds a tracked change from both operations at different places', function () {
      expect(
        transform(
          new StringFileData('foo bar baz'),
          new TextOperation()
            .retain(4)
            .insert('qux ', {
              tracking: TrackingProps.fromRaw({
                ts: '2023-01-01T00:00:00.000Z',
                type: 'insert',
                userId: 'user1',
              }),
            })
            .retain(7),
          new TextOperation()
            .retain(8)
            .insert('corge ', {
              tracking: TrackingProps.fromRaw({
                ts: '2024-01-01T00:00:00.000Z',
                type: 'insert',
                userId: 'user2',
              }),
            })
            .retain(3)
        )
      ).to.deep.equal({
        content: 'foo qux bar corge baz',
        trackedChanges: [
          {
            range: { pos: 4, length: 4 },
            tracking: {
              ts: '2023-01-01T00:00:00.000Z',
              type: 'insert',
              userId: 'user1',
            },
          },
          {
            range: { pos: 12, length: 6 },
            tracking: {
              ts: '2024-01-01T00:00:00.000Z',
              type: 'insert',
              userId: 'user2',
            },
          },
        ],
      })
    })
  })
})

function expectInverseToLeadToInitialState(fileData, operation) {
  const initialState = fileData
  const result = initialState.toRaw()
  const invertedOperation = operation.invert(initialState)
  operation.apply(initialState)
  invertedOperation.apply(initialState)
  const invertedResult = initialState.toRaw()
  expect(invertedResult).to.deep.equal(result)
}

function compose(fileData, op1, op2) {
  const copy = StringFileData.fromRaw(fileData.toRaw())
  op1.apply(fileData)
  op2.apply(fileData)
  const result1 = fileData.toRaw()

  const composed = op1.compose(op2)
  composed.apply(copy)
  const result2 = copy.toRaw()

  expect(result1).to.deep.equal(result2)
  return fileData.toRaw()
}

function transform(fileData, a, b) {
  const initialState = fileData
  const aFileData = StringFileData.fromRaw(initialState.toRaw())
  const bFileData = StringFileData.fromRaw(initialState.toRaw())

  const [aPrime, bPrime] = TextOperation.transform(a, b)
  a.apply(aFileData)
  bPrime.apply(aFileData)
  b.apply(bFileData)
  aPrime.apply(bFileData)

  const resultA = aFileData.toRaw()
  const resultB = bFileData.toRaw()
  expect(resultA).to.deep.equal(resultB)

  return aFileData.toRaw()
}
