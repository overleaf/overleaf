/* eslint-disable
    handle-callback-err,
    no-return-assign,
    no-unused-vars,
    no-useless-escape,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let OutputFileFinder
const async = require('async')
const fs = require('fs')
const Path = require('path')
const { spawn } = require('child_process')
const logger = require('logger-sharelatex')

module.exports = OutputFileFinder = {
  findOutputFiles(resources, directory, callback) {
    if (callback == null) {
      callback = function (error, outputFiles, allFiles) {}
    }
    const incomingResources = {}
    for (const resource of Array.from(resources)) {
      incomingResources[resource.path] = true
    }

    return OutputFileFinder._getAllFiles(directory, function (error, allFiles) {
      if (allFiles == null) {
        allFiles = []
      }
      if (error != null) {
        logger.err({ err: error }, 'error finding all output files')
        return callback(error)
      }
      const outputFiles = []
      for (const file of Array.from(allFiles)) {
        if (!incomingResources[file]) {
          outputFiles.push({
            path: file,
            type: __guard__(file.match(/\.([^\.]+)$/), (x) => x[1])
          })
        }
      }
      return callback(null, outputFiles, allFiles)
    })
  },

  _getAllFiles(directory, _callback) {
    if (_callback == null) {
      _callback = function (error, fileList) {}
    }
    const callback = function (error, fileList) {
      _callback(error, fileList)
      return (_callback = function () {})
    }

    // don't include clsi-specific files/directories in the output list
    const EXCLUDE_DIRS = [
      '-name',
      '.cache',
      '-o',
      '-name',
      '.archive',
      '-o',
      '-name',
      '.project-*'
    ]
    const args = [
      directory,
      '(',
      ...Array.from(EXCLUDE_DIRS),
      ')',
      '-prune',
      '-o',
      '-type',
      'f',
      '-print'
    ]
    logger.log({ args }, 'running find command')

    const proc = spawn('find', args)
    let stdout = ''
    proc.stdout.setEncoding('utf8').on('data', (chunk) => (stdout += chunk))
    proc.on('error', callback)
    return proc.on('close', function (code) {
      if (code !== 0) {
        logger.warn(
          { directory, code },
          "find returned error, directory likely doesn't exist"
        )
        return callback(null, [])
      }
      let fileList = stdout.trim().split('\n')
      fileList = fileList.map(function (file) {
        // Strip leading directory
        let path
        return (path = Path.relative(directory, file))
      })
      return callback(null, fileList)
    })
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
