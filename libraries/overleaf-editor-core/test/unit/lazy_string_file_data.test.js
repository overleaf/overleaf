// @ts-check
'use strict'

const _ = require('lodash')
const { expect } = require('chai')
const sinon = require('sinon')

const ot = require('../..')
const File = ot.File
const TextOperation = ot.TextOperation
const LazyStringFileData = require('../../lib/file_data/lazy_string_file_data')
const EagerStringFileData = require('../../lib/file_data/string_file_data')

describe('LazyStringFileData', function () {
  beforeEach(function () {
    this.rangesHash = '380de212d09bf8498065833dbf242aaf11184316'
    this.fileHash = 'a5675307b61ec2517330622a6e649b4ca1ee5612'
    this.blobStore = {
      getString: sinon.stub(),
      putString: sinon.stub().resolves(new ot.Blob(this.fileHash, 19, 19)),
      getObject: sinon.stub(),
      putObject: sinon.stub().resolves(new ot.Blob(this.rangesHash, 204, 204)),
    }
    this.blobStore.getString.withArgs(File.EMPTY_FILE_HASH).resolves('')
    this.blobStore.getString
      .withArgs(this.fileHash)
      .resolves('the quick brown fox')
    this.blobStore.getObject.withArgs(this.rangesHash).resolves({
      comments: [{ id: 'foo', ranges: [{ pos: 0, length: 3 }] }],
      trackedChanges: [
        {
          range: { pos: 4, length: 5 },
          tracking: {
            type: 'delete',
            userId: 'user1',
            ts: '2024-01-01T00:00:00.000Z',
          },
        },
      ],
    })
  })

  it('uses raw text operations for toRaw and fromRaw', function () {
    const testHash = File.EMPTY_FILE_HASH
    const fileData = new LazyStringFileData(testHash, undefined, 0)
    let roundTripFileData

    expect(fileData.toRaw()).to.deep.equal({
      hash: testHash,
      stringLength: 0,
    })
    roundTripFileData = LazyStringFileData.fromRaw(fileData.toRaw())
    expect(roundTripFileData.getHash()).to.equal(testHash)
    expect(roundTripFileData.getStringLength()).to.equal(0)
    expect(roundTripFileData.getOperations()).to.have.length(0)

    fileData.edit(new TextOperation().insert('a'))
    expect(fileData.toRaw()).to.deep.equal({
      hash: testHash,
      stringLength: 1,
      operations: [{ textOperation: ['a'] }],
    })
    roundTripFileData = LazyStringFileData.fromRaw(fileData.toRaw())
    expect(roundTripFileData.getHash()).not.to.exist // file has changed
    expect(roundTripFileData.getStringLength()).to.equal(1)
    expect(roundTripFileData.getOperations()).to.have.length(1)
    expect(roundTripFileData.getOperations()[0]).to.be.instanceOf(TextOperation)
    expect(
      /** @type {InstanceType<TextOperation>} */ (
        roundTripFileData.getOperations()[0]
      ).ops
    ).to.have.length(1)

    fileData.edit(new TextOperation().retain(1).insert('b'))
    expect(fileData.toRaw()).to.deep.equal({
      hash: testHash,
      stringLength: 2,
      operations: [{ textOperation: ['a'] }, { textOperation: [1, 'b'] }],
    })
    roundTripFileData = LazyStringFileData.fromRaw(fileData.toRaw())
    expect(roundTripFileData.getHash()).not.to.exist // file has changed
    expect(roundTripFileData.getStringLength()).to.equal(2)
    expect(roundTripFileData.getOperations()).to.have.length(2)
    expect(
      /** @type {InstanceType<TextOperation>} */ (
        roundTripFileData.getOperations()[0]
      ).ops
    ).to.have.length(1)
    expect(
      /** @type {InstanceType<TextOperation>} */ (
        roundTripFileData.getOperations()[1]
      ).ops
    ).to.have.length(2)
  })

  it('should include rangesHash in toRaw and fromRaw when available', function () {
    const testHash = File.EMPTY_FILE_HASH
    const rangesHash = this.rangesHash
    const fileData = new LazyStringFileData(testHash, rangesHash, 19)

    expect(fileData.toRaw()).to.deep.equal({
      hash: testHash,
      rangesHash,
      stringLength: 19,
    })

    const roundTripFileData = LazyStringFileData.fromRaw(fileData.toRaw())
    expect(roundTripFileData.getHash()).to.equal(testHash)
    expect(roundTripFileData.getRangesHash()).to.equal(rangesHash)
    expect(roundTripFileData.getStringLength()).to.equal(19)
    expect(roundTripFileData.getOperations()).to.have.length(0)
  })

  it('should fetch content from blob store when loading eager string', async function () {
    const testHash = this.fileHash
    const rangesHash = this.rangesHash
    const fileData = new LazyStringFileData(testHash, rangesHash, 19)
    const eagerString = await fileData.toEager(this.blobStore)
    expect(eagerString).to.be.instanceOf(EagerStringFileData)
    expect(eagerString.getContent()).to.equal('the quick brown fox')
    expect(eagerString.getComments().toRaw()).to.deep.equal([
      { id: 'foo', ranges: [{ pos: 0, length: 3 }] },
    ])
    expect(eagerString.trackedChanges.toRaw()).to.deep.equal([
      {
        range: { pos: 4, length: 5 },
        tracking: {
          type: 'delete',
          userId: 'user1',
          ts: '2024-01-01T00:00:00.000Z',
        },
      },
    ])
    expect(this.blobStore.getObject.calledWith(rangesHash)).to.be.true
    expect(this.blobStore.getString.calledWith(testHash)).to.be.true
  })

  it('should not fetch ranges from blob store if not present', async function () {
    const testHash = this.fileHash
    const fileData = new LazyStringFileData(testHash, undefined, 19)
    const eagerString = await fileData.toEager(this.blobStore)
    expect(eagerString).to.be.instanceOf(EagerStringFileData)
    expect(eagerString.getContent()).to.equal('the quick brown fox')
    expect(eagerString.getComments().toRaw()).to.be.empty
    expect(eagerString.trackedChanges.length).to.equal(0)
    expect(this.blobStore.getObject.called).to.be.false
    expect(this.blobStore.getString.calledWith(testHash)).to.be.true
  })

  it('validates operations when edited', function () {
    const testHash = File.EMPTY_FILE_HASH
    const fileData = new LazyStringFileData(testHash, undefined, 0)
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
    const fileData = new LazyStringFileData(testHash, undefined, 0)
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

  it('truncates its operations after being stored', async function () {
    const testHash = File.EMPTY_FILE_HASH
    const fileData = new LazyStringFileData(testHash, undefined, 0)
    fileData.edit(new TextOperation().insert('abc'))
    const stored = await fileData.store(this.blobStore)
    expect(fileData.hash).to.equal(stored.hash)
    expect(fileData.operations).to.deep.equal([])
  })
})
