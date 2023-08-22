'use strict'

const _ = require('lodash')
const assert = require('check-types').assert

const Operation = require('./')

/**
 * Moves or removes a file from a project.
 */
class SetFileMetadataOperation extends Operation {
  /**
   * @param {string} pathname
   * @param {Object} metadata
   */
  constructor(pathname, metadata) {
    super()
    assert.string(pathname, 'SetFileMetadataOperation: bad pathname')
    assert.object(metadata, 'SetFileMetadataOperation: bad metadata')

    this.pathname = pathname
    this.metadata = metadata
  }

  /**
   * @inheritdoc
   */
  toRaw() {
    return {
      pathname: this.pathname,
      metadata: _.cloneDeep(this.metadata),
    }
  }

  getPathname() {
    return this.pathname
  }

  getMetadata() {
    return this.metadata
  }

  /**
   * @inheritdoc
   */
  applyTo(snapshot) {
    const file = snapshot.getFile(this.pathname)
    if (!file) return
    file.setMetadata(this.metadata)
  }
}

module.exports = SetFileMetadataOperation
