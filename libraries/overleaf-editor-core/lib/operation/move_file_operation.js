'use strict'

const Operation = require('./')

/**
 * Moves or removes a file from a project.
 */
class MoveFileOperation extends Operation {
  /**
   * @param {string} pathname
   * @param {string} newPathname
   */
  constructor(pathname, newPathname) {
    super()
    this.pathname = pathname
    this.newPathname = newPathname
  }

  /**
   * @inheritdoc
   */
  toRaw() {
    return {
      pathname: this.pathname,
      newPathname: this.newPathname,
    }
  }

  getPathname() {
    return this.pathname
  }

  getNewPathname() {
    return this.newPathname
  }

  /**
   * Whether this operation is a MoveFile operation that deletes the file.
   *
   * @return {boolean}
   */
  isRemoveFile() {
    return this.getNewPathname() === ''
  }

  /**
   * @inheritdoc
   */
  applyTo(snapshot) {
    snapshot.moveFile(this.getPathname(), this.getNewPathname())
  }
}

module.exports = MoveFileOperation
