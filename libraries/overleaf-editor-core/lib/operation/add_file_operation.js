'use strict'

const assert = require('check-types').assert

const File = require('../file')
const Operation = require('./')

/**
 * Adds a new file to a project.
 */
class AddFileOperation extends Operation {
  /**
   * @param {string} pathname
   * @param {File} file
   */
  constructor(pathname, file) {
    super()
    assert.string(pathname, 'bad pathname')
    assert.object(file, 'bad file')

    this.pathname = pathname
    this.file = file
  }

  /**
   * @return {String}
   */
  getPathname() {
    return this.pathname
  }

  /**
   * TODO
   * @param  {Object} raw
   * @return {AddFileOperation}
   */
  static fromRaw(raw) {
    return new AddFileOperation(raw.pathname, File.fromRaw(raw.file))
  }

  /**
   * @inheritdoc
   */
  toRaw() {
    return { pathname: this.pathname, file: this.file.toRaw() }
  }

  /**
   * @inheritdoc
   */
  getFile() {
    return this.file
  }

  /** @inheritdoc */
  findBlobHashes(blobHashes) {
    const hash = this.file.getHash()
    if (hash) blobHashes.add(hash)
  }

  /** @inheritdoc */
  async loadFiles(kind, blobStore) {
    return await this.file.load(kind, blobStore)
  }

  async store(blobStore) {
    const rawFile = await this.file.store(blobStore)
    return { pathname: this.pathname, file: rawFile }
  }

  /**
   * @inheritdoc
   */
  applyTo(snapshot) {
    snapshot.addFile(this.pathname, this.file.clone())
  }
}
module.exports = AddFileOperation
