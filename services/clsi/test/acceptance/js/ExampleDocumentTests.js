/* eslint-disable
    no-return-assign,
    no-unused-vars,
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
const Client = require('./helpers/Client')
const fetch = require('node-fetch')
const { pipeline } = require('node:stream')
const fs = require('node:fs')
const ChildProcess = require('node:child_process')
const ClsiApp = require('./helpers/ClsiApp')
const logger = require('@overleaf/logger')
const Path = require('node:path')
const fixturePath = path => {
  if (path.slice(0, 3) === 'tmp') {
    return '/tmp/clsi_acceptance_tests' + path.slice(3)
  }
  return Path.join(__dirname, '../fixtures/', path)
}
const process = require('node:process')
console.log(
  process.pid,
  process.ppid,
  process.getuid(),
  process.getgroups(),
  'PID'
)

const MOCHA_LATEX_TIMEOUT = 60 * 1000

const convertToPng = function (pdfPath, pngPath, callback) {
  if (callback == null) {
    callback = function () {}
  }
  const command = `convert ${fixturePath(pdfPath)} ${fixturePath(pngPath)}`
  console.log('COMMAND')
  console.log(command)
  const convert = ChildProcess.exec(command)
  const stdout = ''
  convert.stdout.on('data', chunk => console.log('STDOUT', chunk.toString()))
  convert.stderr.on('data', chunk => console.log('STDERR', chunk.toString()))
  return convert.on('exit', () => callback())
}

const compare = function (originalPath, generatedPath, callback) {
  if (callback == null) {
    callback = function () {}
  }
  const diffFile = `${fixturePath(generatedPath)}-diff.png`
  const proc = ChildProcess.exec(
    `compare -metric mae ${fixturePath(originalPath)} ${fixturePath(
      generatedPath
    )} ${diffFile}`
  )
  let stderr = ''
  proc.stderr.on('data', chunk => (stderr += chunk))
  return proc.on('exit', () => {
    if (stderr.trim() === '0 (0)') {
      // remove output diff if test matches expected image
      fs.unlink(diffFile, err => {
        if (err) {
          throw err
        }
      })
      return callback(null, true)
    } else {
      console.log('compare result', stderr)
      return callback(null, false)
    }
  })
}

const checkPdfInfo = function (pdfPath, callback) {
  if (callback == null) {
    callback = function () {}
  }
  const proc = ChildProcess.exec(`pdfinfo ${fixturePath(pdfPath)}`)
  let stdout = ''
  proc.stdout.on('data', chunk => (stdout += chunk))
  proc.stderr.on('data', chunk => console.log('STDERR', chunk.toString()))
  return proc.on('exit', () => {
    if (stdout.match(/Optimized:\s+yes/)) {
      return callback(null, true)
    } else {
      return callback(null, false)
    }
  })
}

const compareMultiplePages = function (projectId, callback) {
  if (callback == null) {
    callback = function () {}
  }
  function compareNext(pageNo, callback) {
    const path = `tmp/${projectId}-source-${pageNo}.png`
    return fs.stat(fixturePath(path), (error, stat) => {
      if (error != null) {
        return callback()
      } else {
        return compare(
          `tmp/${projectId}-source-${pageNo}.png`,
          `tmp/${projectId}-generated-${pageNo}.png`,
          (error, same) => {
            if (error != null) {
              throw error
            }
            same.should.equal(true)
            return compareNext(pageNo + 1, callback)
          }
        )
      }
    })
  }
  return compareNext(0, callback)
}

const comparePdf = function (projectId, exampleDir, callback) {
  if (callback == null) {
    callback = function () {}
  }
  console.log('CONVERT')
  console.log(`tmp/${projectId}.pdf`, `tmp/${projectId}-generated.png`)
  return convertToPng(
    `tmp/${projectId}.pdf`,
    `tmp/${projectId}-generated.png`,
    error => {
      if (error != null) {
        throw error
      }
      return convertToPng(
        `examples/${exampleDir}/output.pdf`,
        `tmp/${projectId}-source.png`,
        error => {
          if (error != null) {
            throw error
          }
          return fs.stat(
            fixturePath(`tmp/${projectId}-source-0.png`),
            (error, stat) => {
              if (error != null) {
                return compare(
                  `tmp/${projectId}-source.png`,
                  `tmp/${projectId}-generated.png`,
                  (error, same) => {
                    if (error != null) {
                      throw error
                    }
                    same.should.equal(true)
                    return callback()
                  }
                )
              } else {
                return compareMultiplePages(projectId, error => {
                  if (error != null) {
                    throw error
                  }
                  return callback()
                })
              }
            }
          )
        }
      )
    }
  )
}

const downloadAndComparePdf = function (projectId, exampleDir, url, callback) {
  fetch(url)
    .then(res => {
      if (!res.ok) {
        return callback(new Error('non success response: ' + res.statusText))
      }

      const dest = fs.createWriteStream(fixturePath(`tmp/${projectId}.pdf`))
      pipeline(res.body, dest, err => {
        if (err) return callback(err)

        checkPdfInfo(`tmp/${projectId}.pdf`, (err, optimised) => {
          if (err) return callback(err)

          optimised.should.equal(true)
          comparePdf(projectId, exampleDir, callback)
        })
      })
    })
    .catch(callback)
}

describe('Example Documents', function () {
  Client.runFakeFilestoreService(fixturePath('examples'))

  before(function (done) {
    ClsiApp.ensureRunning(done)
  })
  before(function (done) {
    fs.rm(fixturePath('tmp'), { force: true, recursive: true }, done)
  })
  before(function (done) {
    fs.mkdir(fixturePath('tmp'), done)
  })
  after(function (done) {
    fs.rm(fixturePath('tmp'), { force: true, recursive: true }, done)
  })

  return Array.from(fs.readdirSync(fixturePath('examples'))).map(exampleDir =>
    (exampleDir =>
      describe(exampleDir, function () {
        before(function () {
          return (this.project_id = Client.randomId() + '_' + exampleDir)
        })

        it('should generate the correct pdf', function (done) {
          this.timeout(MOCHA_LATEX_TIMEOUT)
          return Client.compileDirectory(
            this.project_id,
            fixturePath('examples'),
            exampleDir,
            (error, res, body) => {
              if (
                error ||
                __guard__(
                  body != null ? body.compile : undefined,
                  x => x.status
                ) === 'failure'
              ) {
                console.log('DEBUG: error', error, 'body', JSON.stringify(body))
                return done(new Error('Compile failed'))
              }
              const pdf = Client.getOutputFile(body, 'pdf')
              return downloadAndComparePdf(
                this.project_id,
                exampleDir,
                pdf.url,
                done
              )
            }
          )
        })

        return it('should generate the correct pdf on the second run as well', function (done) {
          this.timeout(MOCHA_LATEX_TIMEOUT)
          return Client.compileDirectory(
            this.project_id,
            fixturePath('examples'),
            exampleDir,
            (error, res, body) => {
              if (
                error ||
                __guard__(
                  body != null ? body.compile : undefined,
                  x => x.status
                ) === 'failure'
              ) {
                console.log('DEBUG: error', error, 'body', JSON.stringify(body))
                return done(new Error('Compile failed'))
              }
              const pdf = Client.getOutputFile(body, 'pdf')
              return downloadAndComparePdf(
                this.project_id,
                exampleDir,
                pdf.url,
                done
              )
            }
          )
        })
      }))(exampleDir)
  )
})

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
