let OutputFileFinder
const async = require('async')
const fs = require('fs')
const Path = require('path')
const { spawn } = require('child_process')
const logger = require('logger-sharelatex')

module.exports = OutputFileFinder = {
  findOutputFiles(resources, directory, callback) {
    const incomingResources = new Set(
      resources.map((resource) => resource.path)
    )

    return OutputFileFinder._getAllFiles(directory, function (error, allFiles) {
      if (allFiles == null) {
        allFiles = []
      }
      if (error) {
        logger.err({ err: error }, 'error finding all output files')
        return callback(error)
      }
      const outputFiles = []
      for (const file of allFiles) {
        if (!incomingResources.has(file)) {
          outputFiles.push({
            path: file,
            type: Path.extname(file).replace(/^\./, '') || undefined
          })
        }
      }
      callback(null, outputFiles, allFiles)
    })
  },

  _getAllFiles(directory, _callback) {
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
      ...EXCLUDE_DIRS,
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
      callback(null, fileList)
    })
  }
}
