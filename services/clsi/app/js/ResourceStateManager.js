/* eslint-disable
    handle-callback-err,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS201: Simplify complex destructure assignments
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ResourceStateManager
const Path = require('path')
const fs = require('fs')
const logger = require('logger-sharelatex')
const settings = require('settings-sharelatex')
const Errors = require('./Errors')
const SafeReader = require('./SafeReader')

module.exports = ResourceStateManager = {
  // The sync state is an identifier which must match for an
  // incremental update to be allowed.
  //
  // The initial value is passed in and stored on a full
  // compile, along with the list of resources..
  //
  // Subsequent incremental compiles must come with the same value - if
  // not they will be rejected with a 409 Conflict response. The
  // previous list of resources is returned.
  //
  // An incremental compile can only update existing files with new
  // content.  The sync state identifier must change if any docs or
  // files are moved, added, deleted or renamed.

  SYNC_STATE_FILE: '.project-sync-state',
  SYNC_STATE_MAX_SIZE: 128 * 1024,

  saveProjectState(state, resources, basePath, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    const stateFile = Path.join(basePath, this.SYNC_STATE_FILE)
    if (state == null) {
      // remove the file if no state passed in
      logger.log({ state, basePath }, 'clearing sync state')
      return fs.unlink(stateFile, function (err) {
        if (err != null && err.code !== 'ENOENT') {
          return callback(err)
        } else {
          return callback()
        }
      })
    } else {
      logger.log({ state, basePath }, 'writing sync state')
      const resourceList = resources.map((resource) => resource.path)
      return fs.writeFile(
        stateFile,
        [...resourceList, `stateHash:${state}`].join('\n'),
        callback
      )
    }
  },

  checkProjectStateMatches(state, basePath, callback) {
    if (callback == null) {
      callback = function (error, resources) {}
    }
    const stateFile = Path.join(basePath, this.SYNC_STATE_FILE)
    const size = this.SYNC_STATE_MAX_SIZE
    return SafeReader.readFile(stateFile, size, 'utf8', function (
      err,
      result,
      bytesRead
    ) {
      if (err != null) {
        return callback(err)
      }
      if (bytesRead === size) {
        logger.error(
          { file: stateFile, size, bytesRead },
          'project state file truncated'
        )
      }
      const array = result.toString().split('\n')
      const adjustedLength = Math.max(array.length, 1)
      const resourceList = array.slice(0, adjustedLength - 1)
      const oldState = array[adjustedLength - 1]
      const newState = `stateHash:${state}`
      logger.log(
        { state, oldState, basePath, stateMatches: newState === oldState },
        'checking sync state'
      )
      if (newState !== oldState) {
        return callback(
          new Errors.FilesOutOfSyncError('invalid state for incremental update')
        )
      } else {
        const resources = resourceList.map((path) => ({ path }))
        return callback(null, resources)
      }
    })
  },

  checkResourceFiles(resources, allFiles, basePath, callback) {
    // check the paths are all relative to current directory
    let file
    if (callback == null) {
      callback = function (error) {}
    }
    for (file of resources || []) {
      if (file && file.path) {
        const dirs = file.path.split('/')
        if (dirs.indexOf('..') !== -1) {
          return callback(new Error('relative path in resource file list'))
        }
      }
    }
    // check if any of the input files are not present in list of files
    const seenFile = {}
    for (file of allFiles) {
      seenFile[file] = true
    }
    const missingFiles = resources
      .filter((resource) => !seenFile[resource.path])
      .map((resource) => resource.path)
    if ((missingFiles != null ? missingFiles.length : undefined) > 0) {
      logger.err(
        { missingFiles, basePath, allFiles, resources },
        'missing input files for project'
      )
      return callback(
        new Errors.FilesOutOfSyncError(
          'resource files missing in incremental update'
        )
      )
    } else {
      return callback()
    }
  },
}
