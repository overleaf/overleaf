'use strict'

const _ = require('lodash')
const assert = require('check-types').assert
const BPromise = require('bluebird')

const Blob = require('../blob')
const FileData = require('./')
const EagerStringFileData = require('./string_file_data')
const TextOperation = require('../operation/text_operation')

class LazyStringFileData extends FileData {
  /**
   * @param {string} hash
   * @param {number} stringLength
   * @param {Array.<TextOperation>} [textOperations]
   * @see FileData
   */
  constructor(hash, stringLength, textOperations) {
    super()
    assert.match(hash, Blob.HEX_HASH_RX)
    assert.greaterOrEqual(stringLength, 0)
    assert.maybe.array.of.instance(textOperations, TextOperation)

    this.hash = hash
    this.stringLength = stringLength
    this.textOperations = textOperations || []
  }

  static fromRaw(raw) {
    return new LazyStringFileData(
      raw.hash,
      raw.stringLength,
      raw.textOperations && _.map(raw.textOperations, TextOperation.fromJSON)
    )
  }

  /** @inheritdoc */
  toRaw() {
    const raw = { hash: this.hash, stringLength: this.stringLength }
    if (this.textOperations.length) {
      raw.textOperations = _.map(this.textOperations, function (textOperation) {
        return textOperation.toJSON()
      })
    }
    return raw
  }

  /** @inheritdoc */
  getHash() {
    if (this.textOperations.length) return null
    return this.hash
  }

  /** @inheritdoc */
  isEditable() {
    return true
  }

  /**
   * For project quota checking, we approximate the byte length by the UTF-8
   * length for hollow files. This isn't strictly speaking correct; it is an
   * underestimate of byte length.
   *
   * @return {number}
   */
  getByteLength() {
    return this.stringLength
  }

  /** @inheritdoc */
  getStringLength() {
    return this.stringLength
  }

  /**
   * Get the cached text operations that are to be applied to this file to get
   * from the content with its last known hash to its latest content.
   *
   * @return {Array.<TextOperation>}
   */
  getTextOperations() {
    return this.textOperations
  }

  /** @inheritdoc */
  toEager(blobStore) {
    return blobStore.getString(this.hash).then(content => {
      return new EagerStringFileData(
        computeContent(this.textOperations, content)
      )
    })
  }

  /** @inheritdoc */
  toLazy() {
    return BPromise.resolve(this)
  }

  /** @inheritdoc */
  toHollow() {
    return BPromise.try(() => FileData.createHollow(null, this.stringLength))
  }

  /** @inheritdoc */
  edit(textOperation) {
    this.stringLength = textOperation.applyToLength(this.stringLength)
    this.textOperations.push(textOperation)
  }

  /** @inheritdoc */
  store(blobStore) {
    if (this.textOperations.length === 0)
      return BPromise.resolve({ hash: this.hash })
    return blobStore
      .getString(this.hash)
      .then(content => {
        return blobStore.putString(computeContent(this.textOperations, content))
      })
      .then(blob => {
        this.hash = blob.getHash()
        this.stringLength = blob.getStringLength()
        this.textOperations.length = 0
        return { hash: this.hash }
      })
  }
}

function computeContent(textOperations, initialFile) {
  function applyTextOperation(content, textOperation) {
    return textOperation.apply(content)
  }
  return _.reduce(textOperations, applyTextOperation, initialFile)
}

module.exports = LazyStringFileData
