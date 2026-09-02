'use strict'

const { expect } = require('chai')
const {
  Change,
  File,
  Operation,
  Origin,
  TextOperation,
  rebaseChanges,
  EDITOR_ORIGIN_KIND,
} = require('../..')

describe('rebaseChanges', function () {
  const TIMESTAMP = new Date('2025-01-02T03:04:05.678Z')

  function change(operations, overrides = {}) {
    return new Change(
      operations,
      overrides.timestamp || TIMESTAMP,
      overrides.authors,
      overrides.origin,
      overrides.v2Authors
    )
  }

  function addFile(pathname, content = 'content') {
    return Operation.addFile(pathname, File.fromString(content))
  }

  it('leaves operations alone when nothing conflicts', function () {
    const ours = [change([addFile('ours.tex')])]

    const rebased = rebaseChanges(ours, [change([addFile('theirs.tex')])])

    expect(rebased).to.have.length(1)
    expect(rebased[0].getOperations()).to.have.length(1)
    expect(rebased[0].getOperations()[0].getPathname()).to.equal('ours.tex')
  })

  it('drops a change whose only operation transforms away', function () {
    // Two clients add the same pathname. transformAddFileAddFile resolves this
    // in favour of the change that landed first, so ours becomes a no-op.
    const ours = [change([addFile('main.tex', 'ours')])]

    const rebased = rebaseChanges(ours, [
      change([addFile('main.tex', 'theirs')]),
    ])

    expect(rebased).to.deep.equal([])
  })

  it('prunes no-op operations but keeps the change when others survive', function () {
    const ours = [change([addFile('main.tex'), addFile('other.tex')])]

    const rebased = rebaseChanges(ours, [change([addFile('main.tex')])])

    expect(rebased).to.have.length(1)
    const operations = rebased[0].getOperations()
    expect(operations).to.have.length(1)
    expect(operations[0].getPathname()).to.equal('other.tex')
  })

  it('drops only the changes that empty out, keeping the rest in order', function () {
    const ours = [
      change([addFile('a.tex')]),
      change([addFile('collides.tex')]),
      change([addFile('b.tex')]),
    ]

    const rebased = rebaseChanges(ours, [change([addFile('collides.tex')])])

    expect(rebased.map(c => c.getOperations()[0].getPathname())).to.deep.equal([
      'a.tex',
      'b.tex',
    ])
  })

  it('returns an empty array when every change transforms away', function () {
    const ours = [change([addFile('a.tex')]), change([addFile('b.tex')])]

    const rebased = rebaseChanges(ours, [
      change([addFile('a.tex')]),
      change([addFile('b.tex')]),
    ])

    expect(rebased).to.deep.equal([])
  })

  it('transforms against each intervening change in turn', function () {
    // A rename chain: they moved a.tex -> b.tex, then b.tex -> c.tex. Our edit
    // of a.tex has to end up addressing c.tex, which only happens if the second
    // intervening change is applied to the already-transformed operation.
    const ours = [
      change([
        Operation.editFile(
          'a.tex',
          TextOperation.fromJSON({ textOperation: ['hello'] })
        ),
      ]),
    ]

    const rebased = rebaseChanges(ours, [
      change([Operation.moveFile('a.tex', 'b.tex')]),
      change([Operation.moveFile('b.tex', 'c.tex')]),
    ])

    expect(rebased).to.have.length(1)
    expect(rebased[0].getOperations()[0].getPathname()).to.equal('c.tex')
  })

  it('transforms a sequence of our changes against one of theirs', function () {
    // Both of our changes address a.tex, which they renamed. Each of ours has
    // to be transformed, not just the first.
    const ours = [
      change([
        Operation.editFile(
          'a.tex',
          TextOperation.fromJSON({ textOperation: ['one'] })
        ),
      ]),
      change([
        Operation.editFile(
          'a.tex',
          TextOperation.fromJSON({ textOperation: [3, 'two'] })
        ),
      ]),
    ]

    const rebased = rebaseChanges(ours, [
      change([Operation.moveFile('a.tex', 'renamed.tex')]),
    ])

    expect(rebased).to.have.length(2)
    expect(rebased.map(c => c.getOperations()[0].getPathname())).to.deep.equal([
      'renamed.tex',
      'renamed.tex',
    ])
  })

  it('preserves the fields a resend is recognised by', function () {
    // history-v1 identifies its own change read back from history by origin
    // kind, author and timestamp. A rebase must not disturb any of them, or
    // deduplicating a resend stops working.
    const authorId = '65b9d7fb2a1b2c3d4e5f6a7b'
    const ours = [
      change([addFile('main.tex'), addFile('survivor.tex')], {
        origin: new Origin(EDITOR_ORIGIN_KIND),
        v2Authors: [authorId],
      }),
    ]

    const rebased = rebaseChanges(ours, [change([addFile('main.tex')])])

    expect(rebased).to.have.length(1)
    const raw = rebased[0].toRaw()
    expect(raw.origin).to.deep.equal({ kind: EDITOR_ORIGIN_KIND })
    expect(raw.v2Authors).to.deep.equal([authorId])
    expect(raw.timestamp).to.equal(TIMESTAMP.toISOString())
  })

  it('leaves ours untouched when theirs is empty', function () {
    const ours = [change([addFile('main.tex')])]

    const rebased = rebaseChanges(ours, [])

    expect(rebased).to.have.length(1)
    expect(rebased[0].getOperations()[0].getPathname()).to.equal('main.tex')
  })

  it('returns an empty array when ours is empty', function () {
    expect(rebaseChanges([], [change([addFile('main.tex')])])).to.deep.equal([])
  })
})
