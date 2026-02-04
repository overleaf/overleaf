import commandLineArgs from 'command-line-args'
import {
  loadAtVersion,
  getChunkMetadataForVersion,
  getProjectChunksFromVersion,
} from '../lib/chunk_store/index.js'
import { client } from '../lib/mongodb.js'
import knex from '../lib/knex.js'
import redis from '../lib/redis.js'
import {
  loadGlobalBlobs,
  BlobStore,
  makeProjectKey,
} from '../lib/blob_store/index.js'
import { TextDecoder } from 'node:util'
import {
  backupPersistor,
  chunksBucket,
  projectBlobsBucket,
} from '../lib/backupPersistor.mjs'
import fs from 'node:fs'
import { pipeline } from 'node:stream/promises'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import projectKey from '@overleaf/object-persistor/src/ProjectKey.js'
import { createGunzip } from 'node:zlib'
import { text } from 'node:stream/consumers'

const optionDefinitions = [
  { name: 'historyId', alias: 'p', type: String },
  { name: 'version', alias: 'v', type: Number },
  { name: 'blob', alias: 'b', type: String },
  { name: 'remote', alias: 'r', type: Boolean },
  { name: 'keep', alias: 'k', type: Boolean },
]

function makeChunkKey(projectId, startVersion) {
  return path.join(projectKey.format(projectId), projectKey.pad(startVersion))
}

async function listChunks(historyId) {
  for await (const chunkRecord of getProjectChunksFromVersion(historyId, 0)) {
    console.log('Chunk record:', chunkRecord)
  }
}

async function fetchChunkLocal(historyId, version) {
  const chunkRecord = await getChunkMetadataForVersion(historyId, version)
  const chunk = await loadAtVersion(historyId, version)
  const persistedChunk = await loadAtVersion(historyId, version, {
    persistedOnly: true,
  })
  return {
    key: version,
    chunk,
    persistedChunk,
    metadata: chunkRecord,
    source: 'local storage',
  }
}

async function fetchChunkRemote(historyId, version) {
  const chunkRecord = await getChunkMetadataForVersion(historyId, version)
  const startVersion = chunkRecord.startVersion
  const key = makeChunkKey(historyId, startVersion)
  const backupPersistorForProject = await backupPersistor.forProject(
    chunksBucket,
    key
  )
  const backupChunkStream = await backupPersistorForProject.getObjectStream(
    chunksBucket,
    key
  )
  const backupStr = await text(backupChunkStream.pipe(createGunzip()))
  return {
    key,
    chunk: JSON.parse(backupStr),
    metadata: chunkRecord,
    source: 'remote backup',
  }
}

async function displayChunk(historyId, version, options) {
  const { key, chunk, persistedChunk, metadata, source } = await (options.remote
    ? fetchChunkRemote(historyId, version)
    : fetchChunkLocal(historyId, version))
  console.log('Source:', source)
  console.log('Chunk record', metadata)
  console.log('Key', key)
  // console.log('Number of changes', chunk.getChanges().length)
  console.log(JSON.stringify(chunk))
  if (
    persistedChunk &&
    persistedChunk.getChanges().length !== chunk.getChanges().length
  ) {
    console.warn(
      'Warning: Local chunk and persisted chunk have different number of changes:',
      chunk.getChanges().length,
      'local (including buffer) vs',
      persistedChunk.getChanges().length,
      'persisted'
    )
  }
}

async function fetchBlobRemote(historyId, blobHash) {
  const backupPersistorForProject = await backupPersistor.forProject(
    projectBlobsBucket,
    makeProjectKey(historyId, '')
  )
  const blobKey = makeProjectKey(historyId, blobHash)
  return {
    stream: await backupPersistorForProject.getObjectStream(
      projectBlobsBucket,
      blobKey,
      { autoGunzip: true }
    ),
    metadata: { hash: blobHash },
    source: 'remote backup',
  }
}

async function fetchBlobLocal(historyId, blobHash) {
  const blobStore = new BlobStore(historyId)
  const blob = await blobStore.getBlob(blobHash)
  if (!blob) throw new Error(`Blob ${blobHash} not found`)
  return {
    stream: await blobStore.getStream(blobHash),
    metadata: blob,
    source: 'local storage',
  }
}

async function displayBlobContent(filepath, metadata, source, blobHash) {
  console.log('Source:', source)
  console.log('Blob metadata:', metadata)

  // Compute git hash using streaming
  const stat = fs.statSync(filepath)
  const header = `blob ${stat.size}\0`
  const hash = createHash('sha1')
  hash.update(header)

  const hashStream = fs.createReadStream(filepath)
  for await (const chunk of hashStream) {
    hash.update(chunk)
  }
  const gitHash = hash.digest('hex')

  // Check content type and display preview
  const fd = fs.openSync(filepath, 'r')
  try {
    const headBuf = Buffer.alloc(16)
    const tailBuf = Buffer.alloc(16)

    try {
      // Stream through TextDecoderStream to check for valid UTF-8
      const textStream = fs.createReadStream(filepath)
      const decoder = new TextDecoder('utf-8', { fatal: true })
      for await (const chunk of textStream) {
        decoder.decode(chunk, { stream: true })
      }
      decoder.decode()
      // If we get here, it's valid UTF-8
      if (stat.size <= 1024) {
        console.log('Content (text):', await fs.readFileSync(filepath, 'utf8'))
      } else {
        console.log('Content (text, truncated):')
        console.log(`  Length: ${stat.size} bytes`)
        fs.readSync(fd, headBuf, 0, 16, 0)
        fs.readSync(fd, tailBuf, 0, 16, stat.size - 16)
        console.log(
          '  Content:',
          headBuf.toString('utf8') +
            ' ...(truncated)... ' +
            tailBuf.toString('utf8')
        )
      }
    } catch (e) {
      // Binary content - show head and tail
      console.log('Content (binary):')
      console.log(`  Length: ${stat.size} bytes`)

      if (stat.size <= 32) {
        // Small file - read it all
        const buf = Buffer.alloc(stat.size)
        fs.readSync(fd, buf, 0, stat.size, 0)
        const hexBytes = buf.toString('hex').match(/../g).join(' ')
        console.log('  Bytes:', hexBytes)
      } else {
        // Read tail for large files
        fs.readSync(fd, headBuf, 0, 16, 0)
        fs.readSync(fd, tailBuf, 0, 16, stat.size - 16)
        const headHex = headBuf.toString('hex').match(/../g).join(' ')
        const tailHex = tailBuf.toString('hex').match(/../g).join(' ')
        console.log('  Bytes:', headHex + ' ... ' + tailHex)
      }
      console.log('  Git-style SHA1:', gitHash)
      if (gitHash !== blobHash) {
        console.log('  Warning: Git hash differs from blob hash!\x1b[0m')
        console.log('  Blob hash:', blobHash)
      }
    }
  } finally {
    fs.closeSync(fd)
  }
}

async function withTempDir(prefix, fn, options = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  try {
    return await Promise.resolve(fn(tmpDir))
  } finally {
    if (!options.keep) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } else {
      console.log('Keeping temporary file:', path.join(tmpDir, 'blob'))
    }
  }
}

async function displayBlob(historyId, blobHash, options) {
  try {
    const { stream, metadata, source } = await (options.remote
      ? fetchBlobRemote(historyId, blobHash)
      : fetchBlobLocal(historyId, blobHash))

    await withTempDir(
      'blob-show-',
      async tmpDir => {
        const tmpPath = path.join(tmpDir, 'blob')
        await pipeline(stream, fs.createWriteStream(tmpPath))
        await displayBlobContent(tmpPath, metadata, source, blobHash)
      },
      { keep: options.keep }
    )
  } catch (err) {
    if (err.code === 'NoSuchKey') {
      throw new Error(`Blob ${blobHash} not found in backup`)
    }
    throw err
  }
}

async function main() {
  const { historyId, version, blob, remote, keep } =
    commandLineArgs(optionDefinitions)
  if (!historyId) {
    console.error('Error: --historyId is required.')
    process.exit(1)
  }
  await loadGlobalBlobs()
  if (version != null) {
    await displayChunk(historyId, version, { remote })
  } else if (blob != null) {
    await displayBlob(historyId, blob, { remote, keep })
  } else {
    await listChunks(historyId)
  }
}

main()
  .then(() => console.log('Done.'))
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })
  .finally(() => {
    knex.destroy().catch(err => console.error('Error closing Postgres:', err))
    client.close().catch(err => console.error('Error closing MongoDB:', err))
    redis
      .disconnect()
      .catch(err => console.error('Error disconnecting Redis:', err))
  })
