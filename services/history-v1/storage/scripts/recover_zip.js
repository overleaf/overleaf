/**
 * Try to recover a zip of the latest version of a project using only data in
 * GCS, where this data may have been (recently) hard deleted (i.e. may exist
 * wholely or in part as non-current versions). This should be able to
 * retrieve the latest content of a project up to 180 days after it was
 * deleted.
 *
 * Usage:
 * node recover_zip.js [--verbose] <HISTORY_ID> <HISTORY_ID> ...
 *
 * Output:
 * Signed URL(s) for the uploaded zip files. Note that these are valid for
 * only 24h, to match the lifecycle rule on the zip bucket.
 */

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const util = require('node:util')

// Something is registering 11 listeners, over the limit of 10, which generates
// a lot of warning noise.
require('node:events').EventEmitter.defaultMaxListeners = 11

const config = require('config')
// We depend on this via object-persistor.
// eslint-disable-next-line import/no-extraneous-dependencies
const { Storage } = require('@google-cloud/storage')
const isValidUtf8 = require('utf-8-validate')

const core = require('overleaf-editor-core')
const projectKey = require('@overleaf/object-persistor/src/ProjectKey.js')
const streams = require('../lib/streams')
const ProjectArchive = require('../lib/project_archive')

const {
  values: { verbose: VERBOSE },
  positionals: HISTORY_IDS,
} = util.parseArgs({
  options: {
    verbose: {
      type: 'boolean',
      default: false,
    },
  },
  allowPositionals: true,
})

if (HISTORY_IDS.length === 0) {
  console.error('no history IDs; see usage')
  process.exit(1)
}

async function listDeletedChunks(historyId) {
  const bucketName = config.get('chunkStore.bucket')
  const storage = new Storage()
  const [files] = await storage.bucket(bucketName).getFiles({
    prefix: projectKey.format(historyId),
    versions: true,
  })
  return files
}

async function findLatestChunk(historyId) {
  const files = await listDeletedChunks(historyId)
  if (files.length === 0) return null
  files.sort((a, b) => {
    if (a.name < b.name) return -1
    if (a.name > b.name) return 1
    return 0
  })
  return files[files.length - 1]
}

async function downloadLatestChunk(tmp, historyId) {
  const latestChunkFile = await findLatestChunk(historyId)
  if (!latestChunkFile) throw new Error('no chunk found to recover')

  const destination = path.join(tmp, 'latest.json')
  await latestChunkFile.download({ destination })
  return destination
}

async function loadHistory(historyPathname) {
  const data = await fs.promises.readFile(historyPathname)
  const rawHistory = JSON.parse(data)
  return core.History.fromRaw(rawHistory)
}

async function loadChunk(historyPathname, blobStore) {
  const history = await loadHistory(historyPathname)

  const blobHashes = new Set()
  history.findBlobHashes(blobHashes)

  await blobStore.fetchBlobs(blobHashes)
  await history.loadFiles('lazy', blobStore)

  return new core.Chunk(history, 0)
}

// TODO: it would be nice to export / expose this from BlobStore;
// currently this is a copy of the method there.
async function getStringLengthOfFile(byteLength, pathname) {
  // We have to read the file into memory to get its UTF-8 length, so don't
  // bother for files that are too large for us to edit anyway.
  if (byteLength > core.Blob.MAX_EDITABLE_BYTE_LENGTH_BOUND) {
    return null
  }

  // We need to check if the file contains nonBmp or null characters
  let data = await fs.promises.readFile(pathname)
  if (!isValidUtf8(data)) return null
  data = data.toString()
  if (data.length > core.TextOperation.MAX_STRING_LENGTH) return null
  if (core.util.containsNonBmpChars(data)) return null
  if (data.indexOf('\x00') !== -1) return null
  return data.length
}

class RecoveryBlobStore {
  constructor(historyId, tmp) {
    this.historyId = historyId
    this.tmp = tmp
    this.blobs = new Map()
  }

  async fetchBlobs(blobHashes) {
    for await (const blobHash of blobHashes) {
      await this.fetchBlob(blobHash)
    }
  }

  async fetchBlob(hash) {
    if (this.blobs.has(hash)) return

    if (VERBOSE) console.log('fetching blob', hash)

    const bucketName = config.get('blobStore.projectBucket')
    const storage = new Storage()
    const [files] = await storage.bucket(bucketName).getFiles({
      prefix: this.makeProjectBlobKey(hash),
      versions: true,
    })

    const destination = this.getBlobPathname(hash)

    if (files.length === 0) {
      await this.fetchGlobalBlob(hash, destination)
    } else if (files.length === 1) {
      await files[0].download({ destination })
    } else {
      throw new Error('Multiple versions of blob ' + hash)
    }

    this.blobs.set(hash, await this.makeBlob(hash, destination))
  }

  async fetchGlobalBlob(hash, destination) {
    const bucketName = config.get('blobStore.globalBucket')
    const storage = new Storage()
    const file = storage.bucket(bucketName).file(this.makeGlobalBlobKey(hash))
    await file.download({ destination })
  }

  async makeBlob(hash, pathname) {
    const stat = await fs.promises.stat(pathname)
    const byteLength = stat.size
    const stringLength = await getStringLengthOfFile(byteLength, pathname)
    return new core.Blob(hash, byteLength, stringLength)
  }

  async getString(hash) {
    const stream = await this.getStream(hash)
    const buffer = await streams.readStreamToBuffer(stream)
    return buffer.toString()
  }

  async getStream(hash) {
    return fs.createReadStream(this.getBlobPathname(hash))
  }

  async getBlob(hash) {
    return this.blobs.get(hash)
  }

  getBlobPathname(hash) {
    return path.join(this.tmp, hash)
  }

  makeGlobalBlobKey(hash) {
    return `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash.slice(4)}`
  }

  makeProjectBlobKey(hash) {
    return `${projectKey.format(this.historyId)}/${hash.slice(
      0,
      2
    )}/${hash.slice(2)}`
  }
}

async function uploadZip(historyId, zipPathname) {
  const bucketName = config.get('zipStore.bucket')
  const deadline = 24 * 3600 * 1000 // lifecycle limit on the zips bucket
  const storage = new Storage()
  const destination = `${historyId}-recovered.zip`
  await storage.bucket(bucketName).upload(zipPathname, { destination })

  const signedUrls = await storage
    .bucket(bucketName)
    .file(destination)
    .getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + deadline,
    })

  return signedUrls[0]
}

async function restoreProject(historyId) {
  const tmp = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), historyId.toString())
  )
  if (VERBOSE) console.log('recovering', historyId, 'in', tmp)

  const latestJsonPathname = await downloadLatestChunk(tmp, historyId)
  const blobStore = new RecoveryBlobStore(historyId, tmp)
  const chunk = await loadChunk(latestJsonPathname, blobStore)

  const snapshot = chunk.getSnapshot()
  for (const change of chunk.getChanges()) {
    change.applyTo(snapshot)
  }

  if (VERBOSE) console.log('zipping', historyId)

  const zipPathname = path.join(tmp, `${historyId}.zip`)
  const zipTimeoutMs = 60 * 1000
  const archive = new ProjectArchive(snapshot, zipTimeoutMs)
  await archive.writeZip(blobStore, zipPathname)

  if (VERBOSE) console.log('uploading', historyId)

  return await uploadZip(historyId, zipPathname)
}

async function main() {
  for (const historyId of HISTORY_IDS) {
    const signedUrl = await restoreProject(historyId)
    console.log(signedUrl)
  }
}
main().catch(console.error)
