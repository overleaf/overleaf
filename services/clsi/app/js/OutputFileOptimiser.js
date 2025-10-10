/* eslint-disable
    no-return-assign,
    no-undef,
    no-unused-vars,
    n/no-deprecated-api,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let OutputFileOptimiser
const fs = require('node:fs')
const Path = require('node:path')
const { spawn } = require('node:child_process')
const logger = require('@overleaf/logger')
const Metrics = require('@overleaf/metrics')
const _ = require('lodash')

module.exports = OutputFileOptimiser = {
  optimiseFile(src, dst, callback) {
    // check output file (src) and see if we can optimise it, storing
    // the result in the build directory (dst)
    if (callback == null) {
      callback = function () {}
    }
    if (src.match(/\/output\.pdf$/)) {
      return OutputFileOptimiser.checkIfPDFIsOptimised(
        src,
        function (err, isOptimised) {
          if (err != null || isOptimised) {
            return callback(null)
          }
          return OutputFileOptimiser.optimisePDF(src, dst, callback)
        }
      )
    } else {
      return callback(null)
    }
  },

  checkIfPDFIsOptimised(file, callback) {
    const SIZE = 16 * 1024 // check the header of the pdf
    const result = Buffer.alloc(SIZE) // fills with zeroes by default
    return fs.open(file, 'r', function (err, fd) {
      if (err != null) {
        return callback(err)
      }
      return fs.read(fd, result, 0, SIZE, 0, (errRead, bytesRead, buffer) =>
        fs.close(fd, function (errClose) {
          if (errRead != null) {
            return callback(errRead)
          }
          if (typeof errReadClose !== 'undefined' && errReadClose !== null) {
            return callback(errClose)
          }
          const isOptimised =
            buffer.toString('ascii').indexOf('/Linearized 1') >= 0
          return callback(null, isOptimised)
        })
      )
    })
  },

  optimisePDF(src, dst, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const tmpOutput = dst + '.opt'
    const args = ['--linearize', '--newline-before-endstream', src, tmpOutput]
    logger.debug({ args }, 'running qpdf command')

    const timer = new Metrics.Timer('qpdf')
    const proc = spawn('qpdf', args, { stdio: 'ignore' })
    callback = _.once(callback) // avoid double call back for error and close event
    proc.on('error', function (err) {
      logger.warn({ err, args }, 'qpdf failed')
      return callback(null)
    }) // ignore the error
    return proc.on('close', function (code) {
      timer.done()
      if (code !== 0) {
        logger.warn({ code, args }, 'qpdf returned error')
        return callback(null) // ignore the error
      }
      return fs.rename(tmpOutput, dst, function (err) {
        if (err != null) {
          logger.warn(
            { tmpOutput, dst },
            'failed to rename output of qpdf command'
          )
        }
        return callback(null)
      })
    })
  }, // ignore the error
}
