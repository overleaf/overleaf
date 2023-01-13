'use strict'

const { expect } = require('chai')
const ot = require('..')
const File = ot.File
const MoveFileOperation = ot.MoveFileOperation
const Snapshot = ot.Snapshot

describe('MoveFileOperation', function () {
  function makeEmptySnapshot() {
    return new Snapshot()
  }

  function makeOneFileSnapshot() {
    const snapshot = makeEmptySnapshot()
    snapshot.addFile('foo', File.fromString('test: foo'))
    return snapshot
  }

  function makeTwoFileSnapshot() {
    const snapshot = makeOneFileSnapshot()
    snapshot.addFile('bar', File.fromString('test: bar'))
    return snapshot
  }

  it('moves a file over another', function () {
    const snapshot = makeOneFileSnapshot()
    const operation = new MoveFileOperation('foo', 'bar')
    operation.applyTo(snapshot)
    expect(snapshot.countFiles()).to.equal(1)
    expect(snapshot.getFile('bar').getContent()).to.equal('test: foo')
  })

  it('moves a file to another pathname', function () {
    const snapshot = makeTwoFileSnapshot()
    const operation = new MoveFileOperation('foo', 'a')
    operation.applyTo(snapshot)
    expect(snapshot.countFiles()).to.equal(2)
    expect(snapshot.getFile('a').getContent()).to.equal('test: foo')
    expect(snapshot.getFile('bar').getContent()).to.equal('test: bar')
  })
})
