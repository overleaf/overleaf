/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let TikzManager
const fs = require('node:fs')
const Path = require('node:path')
const { promisify } = require('node:util')
const ResourceWriter = require('./ResourceWriter')
const SafeReader = require('./SafeReader')
const logger = require('@overleaf/logger')

// for \tikzexternalize or pstool to work the main file needs to match the
// jobname.  Since we set the -jobname to output, we have to create a
// copy of the main file as 'output.tex'.

module.exports = TikzManager = {
  checkMainFile(compileDir, mainFile, resources, callback) {
    // if there's already an output.tex file, we don't want to touch it
    if (callback == null) {
      callback = function () {}
    }
    for (const resource of Array.from(resources)) {
      if (resource.path === 'output.tex') {
        logger.debug(
          { compileDir, mainFile },
          'output.tex already in resources'
        )
        return callback(null, false)
      }
    }
    // if there's no output.tex, see if we are using tikz/pgf or pstool in the main file
    return ResourceWriter.checkPath(
      compileDir,
      mainFile,
      function (error, path) {
        if (error != null) {
          return callback(error)
        }
        return SafeReader.readFile(
          path,
          65536,
          'utf8',
          function (error, content) {
            if (error != null) {
              return callback(error)
            }
            const usesTikzExternalize =
              (content != null
                ? content.indexOf('\\tikzexternalize')
                : undefined) >= 0
            const usesPsTool =
              (content != null ? content.indexOf('{pstool}') : undefined) >= 0
            logger.debug(
              { compileDir, mainFile, usesTikzExternalize, usesPsTool },
              'checked for packages needing main file as output.tex'
            )
            const needsMainFile = usesTikzExternalize || usesPsTool
            return callback(null, needsMainFile)
          }
        )
      }
    )
  },

  injectOutputFile(compileDir, mainFile, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return ResourceWriter.checkPath(
      compileDir,
      mainFile,
      function (error, path) {
        if (error != null) {
          return callback(error)
        }
        return fs.readFile(path, 'utf8', function (error, content) {
          if (error != null) {
            return callback(error)
          }
          logger.debug(
            { compileDir, mainFile },
            'copied file to output.tex as project uses packages which require it'
          )
          // use wx flag to ensure that output file does not already exist
          return fs.writeFile(
            Path.join(compileDir, 'output.tex'),
            content,
            { flag: 'wx' },
            callback
          )
        })
      }
    )
  },
}

module.exports.promises = {
  checkMainFile: promisify(TikzManager.checkMainFile),
  injectOutputFile: promisify(TikzManager.injectOutputFile),
}
