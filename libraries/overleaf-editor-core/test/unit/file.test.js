'use strict'

const { expect } = require('chai')
const FakeBlobStore = require('./support/fake_blob_store')
const ot = require('../..')
const File = ot.File

describe('File', function () {
  it('can have attached metadata', function () {
    // no metadata
    let file = File.fromString('foo')
    expect(file.getMetadata()).to.eql({})

    // metadata passed in at construction time
    file = File.fromString('foo', { main: true })
    expect(file.getMetadata()).to.eql({ main: true })

    // metadata set at runtime
    file.setMetadata({ main: false })
    expect(file.getMetadata()).to.eql({ main: false })
  })

  describe('toRaw', function () {
    it('returns non-empty metadata', function () {
      const metadata = { main: true }
      const file = File.fromHash(File.EMPTY_FILE_HASH, undefined, metadata)
      expect(file.toRaw()).to.eql({
        hash: File.EMPTY_FILE_HASH,
        metadata,
      })

      delete file.getMetadata().main
      expect(file.toRaw()).to.eql({ hash: File.EMPTY_FILE_HASH })
    })

    it('returns a deep clone of metadata', function () {
      const metadata = { externalFile: { id: 123 } }
      const file = File.fromHash(File.EMPTY_FILE_HASH, undefined, metadata)
      const raw = file.toRaw()
      const fileMetadata = file.getMetadata()
      const rawMetadata = raw.metadata
      expect(rawMetadata).not.to.equal(fileMetadata)
      expect(rawMetadata).to.deep.equal(fileMetadata)
    })
  })

  describe('store', function () {
    it('does not return empty metadata', async function () {
      const file = File.fromHash(File.EMPTY_FILE_HASH)
      const fakeBlobStore = new FakeBlobStore()
      const raw = await file.store(fakeBlobStore)
      expect(raw).to.eql({ hash: File.EMPTY_FILE_HASH })
    })

    it('returns non-empty metadata', async function () {
      const metadata = { main: true }
      const file = File.fromHash(File.EMPTY_FILE_HASH, undefined, metadata)
      const fakeBlobStore = new FakeBlobStore()
      const raw = await file.store(fakeBlobStore)
      expect(raw).to.eql({
        hash: File.EMPTY_FILE_HASH,
        metadata,
      })
    })

    it('returns a deep clone of metadata', async function () {
      const metadata = { externalFile: { id: 123 } }
      const file = File.fromHash(File.EMPTY_FILE_HASH, undefined, metadata)
      const fakeBlobStore = new FakeBlobStore()
      const raw = await file.store(fakeBlobStore)
      raw.metadata.externalFile.id = 456
      expect(file.getMetadata().externalFile.id).to.equal(123)
    })
  })

  describe('with string data', function () {
    it('can be created from a string', function () {
      const file = File.fromString('foo')
      expect(file.getContent()).to.equal('foo')
    })
  })

  describe('with hollow string data', function () {
    it('can be cloned', function () {
      const file = File.createHollow(null, 0)
      expect(file.getStringLength()).to.equal(0)
      const clone = file.clone()
      expect(clone.getStringLength()).to.equal(0)
    })
  })

  it('getComments() returns an empty comment list', function () {
    const file = File.fromString('foo')
    expect(file.getComments().toRaw()).to.eql([])
  })
})
