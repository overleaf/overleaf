// @ts-check
'use strict'

const { expect } = require('chai')

const StringFileData = require('../../lib/file_data/string_file_data')
const {
  diffAsTextOperation,
  diffsToTextOperation,
  ADDED,
  REMOVED,
  UNCHANGED,
} = require('../../lib/diff_as_text_operation')

/** @import { TrackedChangeRawData } from '../../lib/types' */

const TS = new Date('2026-07-10T00:00:00.000Z')
const OTHER_TS = new Date('2026-07-09T00:00:00.000Z')
const TRACKING = { userId: 'user-1', ts: TS }

/**
 * @param {'insert' | 'delete'} type
 * @param {number} pos
 * @param {number} length
 * @param {string} [userId]
 * @return {TrackedChangeRawData}
 */
function trackedChange(type, pos, length, userId = 'user-2') {
  return {
    range: { pos, length },
    tracking: { type, userId, ts: OTHER_TS.toISOString() },
  }
}

describe('diffAsTextOperation', function () {
  /**
   * @param {StringFileData} file
   * @param {string} after
   * @param {object} [opts]
   */
  function applyDiff(file, after, opts) {
    const operation = diffAsTextOperation(file, after, opts)
    file.edit(operation)
    return operation
  }

  it('returns a noop operation for unchanged content', function () {
    const file = new StringFileData('hello world')
    const operation = diffAsTextOperation(file, 'hello world')
    expect(operation.isNoop()).to.be.true
  })

  it('builds a minimal edit operation', function () {
    const file = new StringFileData('hello world')
    const operation = applyDiff(file, 'hello brave world')
    expect(file.getContent()).to.equal('hello brave world')
    expect(operation.toJSON()).to.eql({ textOperation: [6, 'brave ', 5] })
  })

  it('diffs against the content without tracked deletes and preserves them', function () {
    const file = StringFileData.fromRaw({
      content: 'hello cruel world',
      trackedChanges: [trackedChange('delete', 6, 6)],
    })
    applyDiff(file, 'hello brave world')
    expect(file.getContent()).to.equal('hello brave cruel world')
    expect(file.getContent({ filterTrackedDeletes: true })).to.equal(
      'hello brave world'
    )
    expect(file.trackedChanges.toRaw()).to.eql([trackedChange('delete', 12, 6)])
  })

  it('records an insertion as a tracked insert when tracking is given', function () {
    const file = new StringFileData('hello world')
    applyDiff(file, 'hello brave world', { tracking: TRACKING })
    expect(file.getContent()).to.equal('hello brave world')
    expect(file.trackedChanges.toRaw()).to.eql([
      {
        range: { pos: 6, length: 6 },
        tracking: { type: 'insert', userId: 'user-1', ts: TS.toISOString() },
      },
    ])
  })

  it('records a removal as a tracked delete when tracking is given', function () {
    const file = new StringFileData('hello cruel world')
    applyDiff(file, 'hello world', { tracking: TRACKING })
    expect(file.getContent()).to.equal('hello cruel world')
    expect(file.getContent({ filterTrackedDeletes: true })).to.equal(
      'hello world'
    )
    expect(file.trackedChanges.toRaw()).to.eql([
      {
        range: { pos: 6, length: 6 },
        tracking: { type: 'delete', userId: 'user-1', ts: TS.toISOString() },
      },
    ])
  })
})

describe('diffsToTextOperation', function () {
  /**
   * @param {StringFileData} file
   * @param {[number, string][]} diffs
   * @param {object} [opts]
   */
  function applyDiffs(file, diffs, opts) {
    const operation = diffsToTextOperation(file, diffs, opts)
    file.edit(operation)
    return operation
  }

  describe('without tracked changes in the file', function () {
    it('converts an insertion', function () {
      const file = new StringFileData('hello world')
      applyDiffs(file, [
        [UNCHANGED, 'hello '],
        [ADDED, 'brave '],
        [UNCHANGED, 'world'],
      ])
      expect(file.getContent()).to.equal('hello brave world')
      expect(file.trackedChanges.toRaw()).to.eql([])
    })

    it('converts a removal', function () {
      const file = new StringFileData('hello cruel world')
      applyDiffs(file, [
        [UNCHANGED, 'hello '],
        [REMOVED, 'cruel '],
        [UNCHANGED, 'world'],
      ])
      expect(file.getContent()).to.equal('hello world')
    })

    it('returns a noop operation for identical content', function () {
      const file = new StringFileData('hello world')
      const operation = diffsToTextOperation(file, [[UNCHANGED, 'hello world']])
      expect(operation.isNoop()).to.be.true
    })

    it('throws on unknown diff types', function () {
      const file = new StringFileData('hello')
      expect(() => diffsToTextOperation(file, [[2, 'hello']])).to.throw(
        'Unknown type'
      )
    })
  })

  describe('with tracked deletes in the file', function () {
    it('retains a tracked delete inside an unchanged region', function () {
      const file = new StringFileData('hello XXXworld', undefined, [
        trackedChange('delete', 6, 3),
      ])
      applyDiffs(file, [
        [UNCHANGED, 'hello '],
        [ADDED, 'brave '],
        [UNCHANGED, 'world'],
      ])
      expect(file.getContent()).to.equal('hello brave XXXworld')
      expect(file.getContent({ filterTrackedDeletes: true })).to.equal(
        'hello brave world'
      )
      expect(file.trackedChanges.toRaw()).to.eql([
        trackedChange('delete', 12, 3),
      ])
    })

    it('retains a tracked delete inside a removed region', function () {
      const file = new StringFileData('abCCCcdef', undefined, [
        trackedChange('delete', 2, 3),
      ])
      applyDiffs(file, [
        [UNCHANGED, 'a'],
        [REMOVED, 'bc'],
        [UNCHANGED, 'def'],
      ])
      expect(file.getContent()).to.equal('aCCCdef')
      expect(file.trackedChanges.toRaw()).to.eql([
        trackedChange('delete', 1, 3),
      ])
    })

    it('retains tracked deletes after the end of the diff', function () {
      const file = new StringFileData('abcDDD', undefined, [
        trackedChange('delete', 3, 3),
      ])
      const operation = applyDiffs(file, [[UNCHANGED, 'abc']])
      expect(operation.baseLength).to.equal(6)
      expect(file.getContent()).to.equal('abcDDD')
      expect(file.trackedChanges.toRaw()).to.eql([
        trackedChange('delete', 3, 3),
      ])
    })

    it('throws when the tracked changes are out of sync', function () {
      const file = new StringFileData('abcDE', undefined, [
        trackedChange('delete', 4, 1),
      ])
      expect(() => diffsToTextOperation(file, [[UNCHANGED, 'abc']])).to.throw(
        'StringFileData.trackedChanges out of sync'
      )
    })
  })

  describe('recording the edit as tracked changes', function () {
    it('records insertions as tracked inserts', function () {
      const file = new StringFileData('hello world')
      applyDiffs(
        file,
        [
          [UNCHANGED, 'hello '],
          [ADDED, 'brave '],
          [UNCHANGED, 'world'],
        ],
        { tracking: TRACKING }
      )
      expect(file.getContent()).to.equal('hello brave world')
      expect(file.trackedChanges.toRaw()).to.eql([
        {
          range: { pos: 6, length: 6 },
          tracking: { type: 'insert', userId: 'user-1', ts: TS.toISOString() },
        },
      ])
    })

    it('records removals as tracked deletes', function () {
      const file = new StringFileData('hello cruel world')
      applyDiffs(
        file,
        [
          [UNCHANGED, 'hello '],
          [REMOVED, 'cruel '],
          [UNCHANGED, 'world'],
        ],
        { tracking: TRACKING }
      )
      expect(file.getContent()).to.equal('hello cruel world')
      expect(file.getContent({ filterTrackedDeletes: true })).to.equal(
        'hello world'
      )
      expect(file.trackedChanges.toRaw()).to.eql([
        {
          range: { pos: 6, length: 6 },
          tracking: { type: 'delete', userId: 'user-1', ts: TS.toISOString() },
        },
      ])
    })

    it('records a whole-document removal as a tracked delete', function () {
      const file = new StringFileData('abc')
      const operation = diffsToTextOperation(file, [[REMOVED, 'abc']], {
        tracking: TRACKING,
      })
      file.edit(operation)
      expect(file.getContent({ filterTrackedDeletes: true })).to.equal('')
      expect(file.trackedChanges.toRaw()).to.eql([
        {
          range: { pos: 0, length: 3 },
          tracking: { type: 'delete', userId: 'user-1', ts: TS.toISOString() },
        },
      ])
    })

    it('leaves existing tracked deletes untouched', function () {
      const file = new StringFileData('hello CCCworld', undefined, [
        trackedChange('delete', 6, 3),
      ])
      applyDiffs(
        file,
        [
          [UNCHANGED, 'hello '],
          [REMOVED, 'wor'],
          [UNCHANGED, 'ld'],
        ],
        { tracking: TRACKING }
      )
      expect(file.getContent()).to.equal('hello CCCworld')
      expect(file.getContent({ filterTrackedDeletes: true })).to.equal(
        'hello ld'
      )
      expect(file.trackedChanges.toRaw()).to.eql([
        trackedChange('delete', 6, 3),
        {
          range: { pos: 9, length: 3 },
          tracking: { type: 'delete', userId: 'user-1', ts: TS.toISOString() },
        },
      ])
    })

    it('removes content inside existing tracked inserts as a regular delete', function () {
      const file = new StringFileData('hello INSworld', undefined, [
        trackedChange('insert', 6, 3),
      ])
      applyDiffs(
        file,
        [
          [UNCHANGED, 'hello '],
          [REMOVED, 'INS'],
          [UNCHANGED, 'world'],
        ],
        { tracking: TRACKING }
      )
      expect(file.getContent()).to.equal('hello world')
      expect(file.trackedChanges.toRaw()).to.eql([])
    })

    it('splits a removal spanning an existing tracked insert', function () {
      const file = new StringFileData('abXYcd', undefined, [
        trackedChange('insert', 2, 2),
      ])
      applyDiffs(
        file,
        [
          [UNCHANGED, 'a'],
          [REMOVED, 'bXYc'],
          [UNCHANGED, 'd'],
        ],
        { tracking: TRACKING }
      )
      // The tracked insert is removed for real; b and c become tracked deletes
      expect(file.getContent()).to.equal('abcd')
      expect(file.getContent({ filterTrackedDeletes: true })).to.equal('ad')
      expect(file.trackedChanges.toRaw()).to.eql([
        {
          range: { pos: 1, length: 2 },
          tracking: { type: 'delete', userId: 'user-1', ts: TS.toISOString() },
        },
      ])
    })

    it('handles a tracked insert straddling removed and unchanged regions', function () {
      const file = new StringFileData('hello INSins', undefined, [
        trackedChange('insert', 6, 6),
      ])
      applyDiffs(
        file,
        [
          [UNCHANGED, 'hello '],
          [REMOVED, 'INS'],
          [UNCHANGED, 'ins'],
        ],
        { tracking: TRACKING }
      )
      expect(file.getContent()).to.equal('hello ins')
      expect(file.trackedChanges.toRaw()).to.eql([
        trackedChange('insert', 6, 3),
      ])
    })

    it('keeps identical content a noop', function () {
      const file = new StringFileData('hello world')
      const operation = diffsToTextOperation(
        file,
        [[UNCHANGED, 'hello world']],
        { tracking: TRACKING }
      )
      expect(operation.isNoop()).to.be.true
      file.edit(operation)
      expect(file.trackedChanges.toRaw()).to.eql([])
    })
  })
})
