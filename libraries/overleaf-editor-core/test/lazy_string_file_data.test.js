'use strict'

const _ = require('lodash')
const { expect } = require('chai')

const ot = require('..')
const File = ot.File
const TextOperation = ot.TextOperation
const LazyStringFileData = require('../lib/file_data/lazy_string_file_data')

describe('LazyStringFileData', function () {
  it('uses raw text operations for toRaw and fromRaw', function () {
    const testHash = File.EMPTY_FILE_HASH
    const fileData = new LazyStringFileData(testHash, 0)
    let roundTripFileData

    expect(fileData.toRaw()).to.eql({
      hash: testHash,
      stringLength: 0,
    })
    roundTripFileData = LazyStringFileData.fromRaw(fileData.toRaw())
    expect(roundTripFileData.getHash()).to.equal(testHash)
    expect(roundTripFileData.getStringLength()).to.equal(0)
    expect(roundTripFileData.getOperations()).to.have.length(0)

    fileData.edit(new TextOperation().insert('a'))
    expect(fileData.toRaw()).to.eql({
      hash: testHash,
      stringLength: 1,
      operations: [{ textOperation: ['a'] }],
    })
    roundTripFileData = LazyStringFileData.fromRaw(fileData.toRaw())
    expect(roundTripFileData.getHash()).not.to.exist // file has changed
    expect(roundTripFileData.getStringLength()).to.equal(1)
    expect(roundTripFileData.getOperations()).to.have.length(1)
    expect(roundTripFileData.getOperations()[0].ops).to.have.length(1)

    fileData.edit(new TextOperation().retain(1).insert('b'))
    expect(fileData.toRaw()).to.eql({
      hash: testHash,
      stringLength: 2,
      operations: [{ textOperation: ['a'] }, { textOperation: [1, 'b'] }],
    })
    roundTripFileData = LazyStringFileData.fromRaw(fileData.toRaw())
    expect(roundTripFileData.getHash()).not.to.exist // file has changed
    expect(roundTripFileData.getStringLength()).to.equal(2)
    expect(roundTripFileData.getOperations()).to.have.length(2)
    expect(roundTripFileData.getOperations()[0].ops).to.have.length(1)
    expect(roundTripFileData.getOperations()[1].ops).to.have.length(2)
  })

  it('validates operations when edited', function () {
    const testHash = File.EMPTY_FILE_HASH
    const fileData = new LazyStringFileData(testHash, 0)
    expect(fileData.getHash()).equal(testHash)
    expect(fileData.getByteLength()).to.equal(0) // approximately
    expect(fileData.getStringLength()).to.equal(0)
    expect(fileData.getOperations()).to.have.length(0)

    fileData.edit(new TextOperation().insert('a'))
    expect(fileData.getHash()).not.to.exist
    expect(fileData.getByteLength()).to.equal(1) // approximately
    expect(fileData.getStringLength()).to.equal(1)
    expect(fileData.getOperations()).to.have.length(1)

    expect(() => {
      fileData.edit(new TextOperation().retain(10))
    }).to.throw(TextOperation.ApplyError)
    expect(fileData.getHash()).not.to.exist
    expect(fileData.getByteLength()).to.equal(1) // approximately
    expect(fileData.getStringLength()).to.equal(1)
    expect(fileData.getOperations()).to.have.length(1)
  })

  it('validates string length when edited', function () {
    const testHash = File.EMPTY_FILE_HASH
    const fileData = new LazyStringFileData(testHash, 0)
    expect(fileData.getHash()).equal(testHash)
    expect(fileData.getByteLength()).to.equal(0) // approximately
    expect(fileData.getStringLength()).to.equal(0)
    expect(fileData.getOperations()).to.have.length(0)

    const longString = _.repeat('a', TextOperation.MAX_STRING_LENGTH)
    fileData.edit(new TextOperation().insert(longString))
    expect(fileData.getHash()).not.to.exist
    expect(fileData.getByteLength()).to.equal(longString.length) // approximate
    expect(fileData.getStringLength()).to.equal(longString.length)
    expect(fileData.getOperations()).to.have.length(1)

    expect(() => {
      fileData.edit(new TextOperation().retain(longString.length).insert('x'))
    }).to.throw(TextOperation.TooLongError)
    expect(fileData.getHash()).not.to.exist
    expect(fileData.getByteLength()).to.equal(longString.length) // approximate
    expect(fileData.getStringLength()).to.equal(longString.length)
    expect(fileData.getOperations()).to.have.length(1)
  })
})
