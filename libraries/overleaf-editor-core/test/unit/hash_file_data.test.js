const HashFileData = require('../../lib/file_data/hash_file_data')
const { expect } = require('chai')
const StringFileData = require('../../lib/file_data/string_file_data')
const sinon = require('sinon')
const Blob = require('../../lib/blob')

describe('HashFileData', function () {
  beforeEach(function () {
    this.fileHash = 'a5675307b61ec2517330622a6e649b4ca1ee5612'
    this.rangesHash = '380de212d09bf8498065833dbf242aaf11184316'
    this.blobStore = {
      getString: sinon.stub(),
      getObject: sinon.stub(),
      getBlob: sinon.stub(),
    }
  })

  describe('constructor', function () {
    it('should create a new instance of HashFileData from content hash and ranges hash', function () {
      const fileData = new HashFileData(this.fileHash, this.rangesHash)

      expect(fileData).to.be.instanceOf(HashFileData)
      expect(fileData.getHash()).to.equal(this.fileHash)
      expect(fileData.getRangesHash()).to.equal(this.rangesHash)
    })

    it('should create a new instance of HashFileData with no ranges hash', function () {
      const fileData = new HashFileData(this.fileHash)
      expect(fileData).to.be.instanceOf(HashFileData)
      expect(fileData.getHash()).to.equal(this.fileHash)
      expect(fileData.getRangesHash()).to.be.undefined
    })
  })

  describe('fromRaw', function () {
    it('should create a new instance of HashFileData from raw data', function () {
      const raw = { hash: this.fileHash, rangesHash: this.rangesHash }
      const fileData = HashFileData.fromRaw(raw)

      expect(fileData).to.be.instanceOf(HashFileData)
      expect(fileData.getHash()).to.equal(raw.hash)
      expect(fileData.getRangesHash()).to.equal(raw.rangesHash)
    })

    it('should create a new instance of HashFileData from raw data without ranges hash', function () {
      const raw = { hash: this.fileHash }
      const fileData = HashFileData.fromRaw(raw)

      expect(fileData).to.be.instanceOf(HashFileData)
      expect(fileData.getHash()).to.equal(raw.hash)
      expect(fileData.getRangesHash()).to.equal(undefined)
    })
  })

  describe('toRaw', function () {
    it('should include ranges hash when present', function () {
      const fileData = new HashFileData(this.fileHash, this.rangesHash)
      const raw = fileData.toRaw()
      expect(raw).to.deep.equal({
        hash: this.fileHash,
        rangesHash: this.rangesHash,
      })
    })

    it('should omit ranges hash when not present', function () {
      const fileData = new HashFileData(this.fileHash)
      const raw = fileData.toRaw()
      expect(raw).to.deep.equal({
        hash: this.fileHash,
      })
    })
  })

  describe('toEager', function () {
    it('should convert HashFileData to StringFileData including ranges', async function () {
      const trackedChanges = [
        {
          range: { pos: 5, length: 10 },
          tracking: {
            userId: 'foo',
            type: 'insert',
            ts: '2024-01-01T00:00:00.000Z',
          },
        },
      ]
      const comments = [
        {
          id: 'comment-1',
          ranges: [{ pos: 1, length: 4 }],
        },
      ]
      const fileData = new HashFileData(this.fileHash, this.rangesHash)
      this.blobStore.getString.withArgs(this.fileHash).resolves('content')
      this.blobStore.getObject.withArgs(this.rangesHash).resolves({
        trackedChanges,
        comments,
      })
      this.blobStore.getBlob
        .withArgs(this.rangesHash)
        .resolves(new Blob(this.rangesHash, 20, 20))
      this.blobStore.getBlob
        .withArgs(this.fileHash)
        .resolves(new Blob(this.fileHash, 20, 20))
      const eagerFileData = await fileData.toEager(this.blobStore)
      expect(eagerFileData).to.be.instanceOf(StringFileData)
      expect(eagerFileData.getContent()).to.equal('content')
      expect(eagerFileData.trackedChanges.toRaw()).to.deep.equal(trackedChanges)
      expect(eagerFileData.getComments().toRaw()).to.deep.equal(comments)
    })

    it('should convert HashFileData to StringFileData without ranges', async function () {
      const fileData = new HashFileData(this.fileHash, undefined)
      this.blobStore.getString.withArgs(this.fileHash).resolves('content')
      this.blobStore.getBlob
        .withArgs(this.fileHash)
        .resolves(new Blob(this.fileHash, 20, 20))
      const eagerFileData = await fileData.toEager(this.blobStore)
      expect(eagerFileData).to.be.instanceOf(StringFileData)
      expect(eagerFileData.getContent()).to.equal('content')
      expect(eagerFileData.trackedChanges.toRaw()).to.deep.equal([])
      expect(eagerFileData.getComments().toRaw()).to.deep.equal([])
    })
  })
})
