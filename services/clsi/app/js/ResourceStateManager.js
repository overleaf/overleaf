const Path = require('node:path')
const fs = require('node:fs')
const logger = require('@overleaf/logger')
const Errors = require('./Errors')
const SafeReader = require('./SafeReader')

module.exports = {
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
    const stateFile = Path.join(basePath, this.SYNC_STATE_FILE)
    if (state == null) {
      // remove the file if no state passed in
      logger.debug({ state, basePath }, 'clearing sync state')
      fs.unlink(stateFile, function (err) {
        if (err && err.code !== 'ENOENT') {
          return callback(err)
        } else {
          return callback()
        }
      })
    } else {
      logger.debug({ state, basePath }, 'writing sync state')
      const resourceList = resources.map(resource => resource.path)
      fs.writeFile(
        stateFile,
        [...resourceList, `stateHash:${state}`].join('\n'),
        callback
      )
    }
  },

  checkProjectStateMatches(state, basePath, callback) {
    const stateFile = Path.join(basePath, this.SYNC_STATE_FILE)
    const size = this.SYNC_STATE_MAX_SIZE
    SafeReader.readFile(
      stateFile,
      size,
      'utf8',
      function (err, result, bytesRead) {
        if (err) {
          return callback(err)
        }
        if (bytesRead === size) {
          logger.error(
            { file: stateFile, size, bytesRead },
            'project state file truncated'
          )
        }
        const array = result ? result.toString().split('\n') : []
        const adjustedLength = Math.max(array.length, 1)
        const resourceList = array.slice(0, adjustedLength - 1)
        const oldState = array[adjustedLength - 1]
        const newState = `stateHash:${state}`
        logger.debug(
          { state, oldState, basePath, stateMatches: newState === oldState },
          'checking sync state'
        )
        if (newState !== oldState) {
          return callback(
            new Errors.FilesOutOfSyncError(
              'invalid state for incremental update'
            )
          )
        } else {
          const resources = resourceList.map(path => ({ path }))
          callback(null, resources)
        }
      }
    )
  },

  checkResourceFiles(resources, allFiles, basePath, callback) {
    // check the paths are all relative to current directory
    const containsRelativePath = resource => {
      const dirs = resource.path.split('/')
      return dirs.indexOf('..') !== -1
    }
    if (resources.some(containsRelativePath)) {
      return callback(new Error('relative path in resource file list'))
    }
    // check if any of the input files are not present in list of files
    const seenFiles = new Set(allFiles)
    const missingFiles = resources
      .map(resource => resource.path)
      .filter(path => !seenFiles.has(path))
    if (missingFiles.length > 0) {
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
      callback()
    }
  },
}
