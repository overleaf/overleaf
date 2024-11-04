import minimist from 'minimist'
import settings from '@overleaf/settings'
import ProjectDetailsHandler from '../app/src/Features/Project/ProjectDetailsHandler.js'
import mongodb from '../app/src/infrastructure/mongodb.js'
import mongoose from '../app/src/infrastructure/Mongoose.js'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import fetch from 'node-fetch'
import http from 'node:http'
import _ from 'lodash'

const { ObjectId } = mongodb

// Examples:
//
// Simple usage:
// node stress_test.mjs --project-id=ID -n 100 --download-zip # download 100 zips from history-v1
// node stress_test.mjs --project-id=ID -n 100 --create-blob # create 100 blobs in history-v1
// node stress_test.mjs --project-id=ID -n 100 --fetch-blob # create blob and fetch it 100 times from history-v1
// node stress_test.mjs --project-id=ID -n 100 --upload-file # upload 100 files to filestore
// node stress_test.mjs --project-id=ID -n 100 --download-file # create file in filestore and download it 100 times
//
// Delay between requests:
// node stress_test.mjs --project-id=ID -n 100 --download-zip --sleep=0.1 # download 100 zips from history-v1 with 0.1s sleep
//
// Abort requests at random times:
// node stress_test.mjs --project-id=ID -n 100 --download-zip --abort # download 100 zips from history-v1 with aborts
//
// Parallel workers:
// node stress_test.mjs --project-id=ID -n 1000 -j 10 --upload-file # upload 1000 files in 10 parallel workers
//
// Fixed file size:
// node stress_test.mjs --project-id=ID -n 1000 --size 1000000 --upload-file # upload 1000 files of 1MB in 10 parallel workers
//
// Random file size:
// node stress_test.mjs --project-id=ID -n 1000 --size-min 1024 --size-max 10000000 --upload-file # upload 1000 files of 1KB to 10MB in 10 parallel workers

const argv = minimist(process.argv.slice(2), {
  string: ['n', 'j', 'project-id', 'sleep', 'size', 'size-min', 'size-max'],
  boolean: [
    'download-zip',
    'create-blob',
    'fetch-blob',
    'upload-file',
    'download-file',
    'use-file',
    'abort',
  ],
  default: {
    n: 1,
    j: 1,
    sleep: 1,
    size: 100 * 1024,
    highWaterMark: 64 * 1024,
  },
})

const projectId = argv['project-id']
if (!projectId) {
  console.error(
    'Usage: node stress_test.mjs --project-id ID -n COUNT -j CONCURRENCY --sleep T --size BYTES --use-file --[create-blob|fetch-blob|download-zip|upload-file|download-file]'
  )
  process.exit(1)
}

process.on('exit', () => {
  log('Exiting')
})

async function sleep() {
  const ms = argv.sleep * 1000 * (0.5 + Math.random())
  return new Promise(resolve => setTimeout(resolve, ms))
}
function log(...args) {
  const date = new Date()
  console.log(date.toISOString(), ...args)
}

let abortTime = 1000
function adjustAbortTime(aborted, dt) {
  if (!argv.abort) {
    return
  }
  // If the last task was aborted, increase the abort time gradually
  // Otherwise, reset the abort time to a random fraction of the response time.
  if (aborted) {
    abortTime = Math.min(abortTime * 1.5, 10000)
  } else {
    abortTime = Math.random() * dt
  }
  // Clamp to valid AbortSignal times
  abortTime = Math.max(1, Math.round(abortTime))
}

function abortSignal() {
  if (!argv.abort) {
    return
  }
  return AbortSignal.timeout(abortTime)
}

async function stressTest(testCase, numberOfRuns, concurrentJobs) {
  process.on('SIGINT', () => {
    log('Caught interrupt signal. Running cleanup...')
    numberOfRuns = 0
  })
  let startedTasks = 0
  let finishedTasks = 0
  let abortedTasks = 0
  const periodicLog = _.throttle(log, 1000, { leading: true })
  const errors = []
  const { action, cleanup } = testCase
  const executeTask = async () => {
    startedTasks++
    await sleep()
    const t0 = Date.now()
    try {
      await action(abortSignal())
      finishedTasks++
      adjustAbortTime(false, Date.now() - t0)
    } catch (err) {
      if (err.name === 'AbortError') {
        abortedTasks++
        adjustAbortTime(true, Date.now() - t0)
      } else {
        errors.push(err)
        log(startedTasks, err)
      }
    } finally {
      periodicLog(
        `Completed ${finishedTasks} / Aborted ${abortedTasks} / Errors ${errors.length}`
      )
    }
    if (startedTasks < numberOfRuns) {
      await executeTask()
    }
  }
  const workers = []
  for (let i = 0; i < concurrentJobs; i++) {
    workers.push(executeTask())
  }

  try {
    await Promise.all(workers)
    periodicLog.cancel()
    log(
      `Completed ${finishedTasks} / Aborted ${abortedTasks} / Errors ${errors.length}`
    )
    log(startedTasks, 'tasks completed')
    if (cleanup) {
      log('Cleaning up')
      try {
        await cleanup()
      } catch (err) {
        log('error cleaning up', err)
      }
    }
  } catch (err) {
    log('error running stress test', err)
  }
  if (errors.length > 0) {
    log('Errors:', errors.length)
    throw new Error('Errors')
  }
}

function generateRandomBuffer(size) {
  if (argv['fill-string']) {
    const buffer = Buffer.alloc(size, argv['fill-string'])
    // add some randomness at the start to avoid every random buffer being the same
    buffer.write(crypto.randomUUID())
    return buffer
  } else {
    return Buffer.alloc(size, crypto.randomUUID())
  }
}

function computeGitHash(buffer) {
  const byteLength = buffer.byteLength
  const hash = crypto.createHash('sha1')
  hash.setEncoding('hex')
  hash.update('blob ' + byteLength + '\x00')
  hash.update(buffer)
  hash.end()
  return { hashHex: hash.read(), byteLength }
}

function computeMD5Hash(buffer) {
  const hash = crypto.createHash('md5')
  hash.update(buffer)
  return hash.digest('hex')
}

function readableSize(size) {
  // convert a size in bytes to a human readable string
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  while (size > 1024 && i < units.length) {
    size /= 1024
    i++
  }
  return `${size.toFixed(2)} ${units[i]}`.trim()
}

class SizeGenerator {
  constructor() {
    if (argv['size-min'] && argv['size-max']) {
      this.size_min = parseInt(argv['size-min']) || 0
      this.size_max = parseInt(argv['size-max']) || argv.size
      log(
        `File size range [${readableSize(this.size_min)}, ${readableSize(
          this.size_max
        )}]`
      )
    } else {
      this.size = parseInt(argv.size)
      this.fixed = true
      log('File size', readableSize(this.size))
    }
  }

  get() {
    return this.fixed
      ? this.size
      : this.size_min + Math.random() * (this.size_max - this.size_min)
  }
}

async function createBlob(projectId) {
  log('Getting history id')
  const v1Id = await getHistoryId(projectId)
  // generate a random blob in a buffer and compute the git hash of the buffer
  log('Creating test blob')
  const userSize = new SizeGenerator()
  async function putBlob(abortSignal) {
    // create a random buffer and compute its hash
    const buffer = generateRandomBuffer(userSize.get())
    const { hashHex, byteLength } = computeGitHash(buffer)
    // write the buffer to a file for streaming
    let readStream
    let filepath
    if (argv['use-file']) {
      filepath = path.join('/tmp', `${v1Id}-${hashHex}-${crypto.randomUUID()}`)
      await fs.promises.writeFile(filepath, buffer)
      const filestream = fs.createReadStream(filepath, {
        highWaterMark: argv.highWaterMark,
      })
      readStream = filestream
    } else {
      filepath = null
      readStream = buffer
    }
    const putUrl = `${settings.apis.v1_history.url}/projects/${v1Id}/blobs/${hashHex}`
    const options = {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': byteLength,
        Authorization: `Basic ${Buffer.from(
          `${settings.apis.v1_history.user}:${settings.apis.v1_history.pass}`
        ).toString('base64')}`,
      },
    }
    const req = http.request(putUrl, options)
    return await new Promise((resolve, reject) => {
      req.on('error', reject)
      req.on('response', res => {
        if (res.statusCode !== 201) {
          reject(
            new Error(
              `failed to put blob ${putUrl} status=${res.statusCode} ${res.statusMessage}`
            )
          )
        } else {
          resolve({ hashHex, byteLength })
        }
      })
      readStream.pipe(req)
    })
  }
  return { action: putBlob, description: 'createBlob in history-v1' }
}

async function fetchBlob(projectId) {
  log('Getting history id and creating test blob')
  const v1Id = await getHistoryId(projectId)
  const { action: putBlob } = await createBlob(projectId)
  const { hashHex, byteLength } = await putBlob()
  async function getBlob(abortSignal) {
    const getUrl = `${settings.apis.v1_history.url}/projects/${v1Id}/blobs/${hashHex}`
    const response = await historyFetch(getUrl, { signal: abortSignal })
    if (!response.ok) {
      throw new Error(`failed to get blob ${getUrl} status=${response.status}`)
    }
    const buffer = await response.arrayBuffer()
    if (buffer.byteLength !== byteLength) {
      throw new Error(
        `unexpected fetch blob length ${buffer.byteLength} vs expected ${byteLength}`
      )
    }
  }
  return { action: getBlob, description: 'fetchBlob from history-v1' }
}

async function getHistoryId(projectId) {
  const project = await ProjectDetailsHandler.promises.getDetails(projectId)
  const v1Id = project?.overleaf?.history?.id
  return v1Id
}

async function downloadHistoryZip(projectId) {
  log('Getting history id and latest version')
  const v1Id = await getHistoryId(projectId)
  const latestUrl = `${settings.apis.v1_history.url}/projects/${v1Id}/latest/history`
  let response = await historyFetch(latestUrl)
  if (!response.ok) {
    throw new Error(
      `failed to get latest version ${latestUrl} status=${response.status}`
    )
  }
  const latestBody = await response.json()
  const version =
    latestBody.chunk.startVersion + latestBody.chunk.history.changes.length
  const zipUrl = `${settings.apis.v1_history.url}/projects/${v1Id}/version/${version}/zip`
  let expectedLength = null
  async function getZip(abortSignal) {
    response = await historyFetch(zipUrl, { signal: abortSignal })
    const responseBuffer = await response.arrayBuffer()
    if (expectedLength === null) {
      expectedLength = responseBuffer.byteLength
    } else if (responseBuffer.byteLength !== expectedLength) {
      throw new Error(
        `unexpected zip download length ${responseBuffer.byteLength} vs expected ${expectedLength}`
      )
    }
  }
  return { action: getZip, description: 'download zip from history-v1' }
}

async function historyFetch(url, options) {
  const authHeader = {
    Authorization: `Basic ${Buffer.from(
      `${settings.apis.v1_history.user}:${settings.apis.v1_history.pass}`
    ).toString('base64')}`,
  }
  const response = await fetch(url, { ...options, headers: authHeader })
  if (!response.ok) {
    throw new Error(`failed to download url ${url} status=${response.status}`)
  }
  return response
}

async function _deleteFile(url, log) {
  const response = await fetch(url, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error(`failed to delete file status=${response.status}`)
  }
}

async function uploadFile(projectId) {
  // generate a random blob in a buffer and compute the md5 hash of the buffer
  const userSize = new SizeGenerator()
  async function upload(abortSignal, deleteFile = true) {
    const size = userSize.get()
    const buffer = Buffer.alloc(size, crypto.randomUUID())
    const fileId = new ObjectId()
    const url = `${settings.apis.filestore.url}/project/${projectId}/file/${fileId}`
    const md5 = computeMD5Hash(buffer)
    const response = await fetch(url, {
      method: 'POST',
      body: buffer,
      signal: abortSignal,
    })
    if (!response.ok) {
      throw new Error(`failed to upload file ${url} status=${response.status}`)
    }
    if (deleteFile) {
      await _deleteFile(url)
    }
    return { url, md5 }
  }
  return { action: upload, description: 'upload file to filestore' }
}

async function downloadFile(projectId) {
  log('Creating test file')
  const { action: upload } = await uploadFile(projectId)
  const { url, md5: expectedMd5 } = await upload(null, false)
  async function download(abortSignal) {
    const response = await fetch(url, {
      method: 'GET',
      signal: abortSignal,
    })
    if (!response.ok) {
      throw new Error(`failed to get file ${url} status=${response.status}`)
    }
    const md5 = computeMD5Hash(Buffer.from(await response.arrayBuffer()))
    if (md5 !== expectedMd5) {
      throw new Error(`md5 mismatch`)
    }
  }
  async function cleanup() {
    log('Deleting test file')
    await _deleteFile(url)
  }
  return {
    action: download,
    cleanup,
    description: 'download file from filestore',
  }
}

async function run() {
  let testCase
  if (argv['download-zip']) {
    testCase = await downloadHistoryZip(projectId)
  } else if (argv['create-blob']) {
    testCase = await createBlob(projectId)
  } else if (argv['fetch-blob']) {
    testCase = await fetchBlob(projectId)
  } else if (argv['upload-file']) {
    testCase = await uploadFile(projectId)
  } else if (argv['download-file']) {
    testCase = await downloadFile(projectId)
  } else {
    throw new Error('unknown command')
  }
  log('Running stress test:', testCase.description)
  await stressTest(testCase, argv.n, argv.j)
  log('Stress test done')
}

try {
  await Promise.all([mongodb.connectionPromise, mongoose.connectionPromise])
  await run()
  log('Completed')
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
