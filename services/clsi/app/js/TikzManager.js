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
import fs from 'node:fs'
import Path from 'node:path'
import { promisify } from 'node:util'
import ResourceWriter from './ResourceWriter.js'
import SafeReader from './SafeReader.js'
import logger from '@overleaf/logger'
let TikzManager

// for \tikzexternalize or pstool to work the main file needs to match the
// jobname.  Since we set the -jobname to output, we have to create a
// copy of the main file as 'output.tex'.

export default TikzManager = {
  OUTPUT_TEX: 'output.tex',

  /**
   * @param {string} content
   * @return {boolean}
   */
  usesTikzExternalize(content) {
    return content.includes('\\tikzexternalize') || content.includes('{pstool}')
  },

  /**
   * @param {string} compileDir
   * @param {import('overleaf-editor-core').Snapshot} snapshot
   * @param {string} content
   * @return {Promise<void>}
   */
  async writeOutputFileIfNeeded(compileDir, snapshot, content) {
    if (snapshot.getFile(TikzManager.OUTPUT_TEX)) return
    if (!TikzManager.usesTikzExternalize(content)) return
    await fs.promises.writeFile(
      Path.join(compileDir, TikzManager.OUTPUT_TEX),
      content,
      'utf-8'
    )
  },

  checkMainFile(compileDir, mainFile, resources, callback) {
    // if there's already an output.tex file, we don't want to touch it
    if (callback == null) {
      callback = function () {}
    }
    for (const resource of Array.from(resources)) {
      if (resource.path === TikzManager.OUTPUT_TEX) {
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
            const needsMainFile = TikzManager.usesTikzExternalize(content)
            logger.debug(
              { compileDir, mainFile, needsMainFile },
              'checked for packages needing main file as output.tex'
            )
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
            Path.join(compileDir, TikzManager.OUTPUT_TEX),
            content,
            { flag: 'wx' },
            callback
          )
        })
      }
    )
  },
}

TikzManager.promises = {
  checkMainFile: promisify(TikzManager.checkMainFile),
  injectOutputFile: promisify(TikzManager.injectOutputFile),
}
