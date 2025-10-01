const Client = require('./helpers/Client')
const fetch = require('node-fetch')
const Stream = require('node:stream')
const fs = require('node:fs')
const fsPromises = require('node:fs/promises')
const ChildProcess = require('node:child_process')
const { promisify } = require('node:util')
const ClsiApp = require('./helpers/ClsiApp')
const Path = require('node:path')
const fixturePath = path => {
  if (path.slice(0, 3) === 'tmp') {
    return '/tmp/clsi_acceptance_tests' + path.slice(3)
  }
  return Path.join(__dirname, '../fixtures/', path)
}
const process = require('node:process')
const pipeline = promisify(Stream.pipeline)
console.log(
  process.pid,
  process.ppid,
  process.getuid(),
  process.getgroups(),
  'PID'
)

const MOCHA_LATEX_TIMEOUT = 60 * 1000

const convertToPng = function (pdfPath, pngPath) {
  return new Promise((resolve, reject) => {
    const command = `convert ${fixturePath(pdfPath)} ${fixturePath(pngPath)}`
    console.log('COMMAND')
    console.log(command)
    const convert = ChildProcess.exec(command)
    convert.stdout.on('data', chunk => console.log('STDOUT', chunk.toString()))
    convert.stderr.on('data', chunk => console.log('STDERR', chunk.toString()))
    convert.on('exit', () => resolve())
    convert.on('error', error => reject(error))
  })
}

const compare = function (originalPath, generatedPath) {
  return new Promise((resolve, reject) => {
    const diffFile = `${fixturePath(generatedPath)}-diff.png`
    const proc = ChildProcess.exec(
      `compare -metric mae ${fixturePath(originalPath)} ${fixturePath(
        generatedPath
      )} ${diffFile}`
    )
    let stderr = ''
    proc.stderr.on('data', chunk => (stderr += chunk))
    proc.on('exit', () => {
      if (stderr.trim() === '0 (0)') {
        // remove output diff if test matches expected image
        fs.unlink(diffFile, err => {
          if (err) {
            reject(err)
          }
        })
        resolve(true)
      } else {
        console.log('compare result', stderr)
        resolve(false)
      }
    })
  })
}

const checkPdfInfo = function (pdfPath) {
  return new Promise((resolve, reject) => {
    const proc = ChildProcess.exec(`pdfinfo ${fixturePath(pdfPath)}`)
    let stdout = ''
    proc.stdout.on('data', chunk => (stdout += chunk))
    proc.stderr.on('data', chunk => console.log('STDERR', chunk.toString()))
    proc.on('exit', () => {
      if (stdout.match(/Optimized:\s+yes/)) {
        resolve(true)
      } else {
        resolve(false)
      }
    })
    proc.on('error', error => reject(error))
  })
}

const compareMultiplePages = async function (projectId) {
  async function compareNext(pageNo) {
    const path = `tmp/${projectId}-source-${pageNo}.png`
    try {
      await fsPromises.stat(fixturePath(path))
    } catch (error) {
      return
    }

    const same = await compare(
      `tmp/${projectId}-source-${pageNo}.png`,
      `tmp/${projectId}-generated-${pageNo}.png`
    )
    same.should.equal(true)
    await compareNext(pageNo + 1)
  }
  await compareNext(0)
}

const comparePdf = async function (projectId, exampleDir) {
  console.log('CONVERT')
  console.log(`tmp/${projectId}.pdf`, `tmp/${projectId}-generated.png`)
  await convertToPng(`tmp/${projectId}.pdf`, `tmp/${projectId}-generated.png`)
  await convertToPng(
    `examples/${exampleDir}/output.pdf`,
    `tmp/${projectId}-source.png`
  )
  try {
    await fsPromises.stat(fixturePath(`tmp/${projectId}-source-0.png`))
    await compareMultiplePages(projectId)
  } catch (error) {
    const same = await compare(
      `tmp/${projectId}-source.png`,
      `tmp/${projectId}-generated.png`
    )
    same.should.equal(true)
  }
}

const downloadAndComparePdf = async function (projectId, exampleDir, url) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('non success response: ' + res.statusText)
  }
  const dest = fs.createWriteStream(fixturePath(`tmp/${projectId}.pdf`))
  await pipeline(res.body, dest)
  const optimised = await checkPdfInfo(`tmp/${projectId}.pdf`)
  optimised.should.equal(true)
  await comparePdf(projectId, exampleDir)
}

describe('Example Documents', function () {
  Client.runFakeFilestoreService(fixturePath('examples'))

  before(async function () {
    await ClsiApp.ensureRunning()
  })
  before(async function () {
    await fsPromises.rm(fixturePath('tmp'), { force: true, recursive: true })
  })
  before(async function () {
    await fsPromises.mkdir(fixturePath('tmp'))
  })
  after(async function () {
    await fsPromises.rm(fixturePath('tmp'), { force: true, recursive: true })
  })

  return fs.readdirSync(fixturePath('examples')).map(exampleDir =>
    (exampleDir =>
      describe(exampleDir, function () {
        before(function () {
          this.project_id = Client.randomId() + '_' + exampleDir
        })

        it('should generate the correct pdf', async function () {
          this.timeout(MOCHA_LATEX_TIMEOUT)
          const body = await Client.compileDirectory(
            this.project_id,
            fixturePath('examples'),
            exampleDir
          )

          if (body?.compile?.status === 'failure') {
            throw new Error('Compile failed')
          }
          const pdf = Client.getOutputFile(body, 'pdf')
          await downloadAndComparePdf(this.project_id, exampleDir, pdf.url)
        })

        it('should generate the correct pdf on the second run as well', async function () {
          this.timeout(MOCHA_LATEX_TIMEOUT)
          const body = await Client.compileDirectory(
            this.project_id,
            fixturePath('examples'),
            exampleDir
          )

          if (body?.compile?.status === 'failure') {
            throw new Error('Compile failed')
          }

          const pdf = Client.getOutputFile(body, 'pdf')
          await downloadAndComparePdf(this.project_id, exampleDir, pdf.url)
        })
      }))(exampleDir)
  )
})
