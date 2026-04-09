import { expect } from 'chai'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { ObjectId } from 'mongodb'

import { BlobStore } from '../../../../storage/lib/blob_store/index.js'
import cleanup from './support/cleanup.js'

describe('redact.mjs script', function () {
  const TIMEOUT = 20 * 1000

  beforeEach(cleanup.everything)

  async function runScript(args = []) {
    let result
    try {
      result = await promisify(execFile)(
        process.argv0,
        ['storage/scripts/redact.mjs', ...args],
        {
          encoding: 'utf-8',
          timeout: TIMEOUT,
          env: {
            ...process.env,
            LOG_LEVEL: 'warn',
          },
        }
      )
      result.status = 0
    } catch (err) {
      const { stdout, stderr, code } = err
      if (typeof code !== 'number') {
        console.log(err)
      }
      result = { stdout, stderr, status: code }
    }
    return result
  }

  it('should redact one blob completely (via delete) and leave other unmodified', async function () {
    const historyId = new ObjectId().toString()
    const blobStore = new BlobStore(historyId)

    const blob1 = await blobStore.putString('Confidential data')
    const blob2 = await blobStore.putString('Public data')

    const hash1 = blob1.getHash()
    const hash2 = blob2.getHash()

    // Redact blob1 completely
    const result = await runScript([
      '--historyId',
      historyId,
      '--blob',
      hash1,
      '--delete',
      '--yes',
    ])

    expect(result.status).to.equal(0)
    expect(result.stdout).to.include(`Deleting blob ${hash1}`)

    // Check blob1 is absent using getStream (as getString can mask specific NotFoundError)
    let fetchError
    try {
      await blobStore.getStream(hash1)
    } catch (err) {
      fetchError = err
    }
    expect(fetchError).to.exist
    expect(fetchError.message).to.match(/not found/i)

    // Check blob2 is unmodified
    const publicContent = await blobStore.getString(hash2)
    expect(publicContent).to.equal('Public data')
  })

  it('should redact a blob with a default message if no flag is provided', async function () {
    const historyId = new ObjectId().toString()
    const blobStore = new BlobStore(historyId)

    const blob1 = await blobStore.putString('Confidential data')
    const hash1 = blob1.getHash()

    // Redact blob1
    const result = await runScript([
      '--historyId',
      historyId,
      '--blob',
      hash1,
      '--yes',
    ])

    expect(result.status).to.equal(0)
    expect(result.stdout).to.include(`Replacing blob ${hash1}`)

    // Check blob1 is redacted
    const redactedContent = await blobStore.getString(hash1)
    expect(redactedContent).to.match(
      /^REDACTED \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    )
  })

  it('should redact a blob with a custom message', async function () {
    const historyId = new ObjectId().toString()
    const blobStore = new BlobStore(historyId)

    const blob1 = await blobStore.putString('Confidential data')
    const hash1 = blob1.getHash()

    // Redact blob1
    const result = await runScript([
      '--historyId',
      historyId,
      '--blob',
      hash1,
      '--message',
      'MY_CUSTOM_MSG',
      '--yes',
    ])

    expect(result.status).to.equal(0)
    expect(result.stdout).to.include(`Replacing blob ${hash1}`)

    // Check blob1 is redacted
    const redactedContent = await blobStore.getString(hash1)
    expect(redactedContent).to.match(
      /^MY_CUSTOM_MSG \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    )
  })

  it('should redact a blob with an empty file if --empty is used', async function () {
    const historyId = new ObjectId().toString()
    const blobStore = new BlobStore(historyId)

    const blob1 = await blobStore.putString('Confidential data')
    const hash1 = blob1.getHash()

    // Redact blob1
    const result = await runScript([
      '--historyId',
      historyId,
      '--blob',
      hash1,
      '--empty',
      '--yes',
    ])

    expect(result.status).to.equal(0)
    expect(result.stdout).to.include(`Replacing blob ${hash1}`)

    // Check blob1 is empty
    const redactedContent = await blobStore.getString(hash1)
    expect(redactedContent).to.equal('')
  })

  it('should redact a blob with a specific file if --file is used', async function () {
    const historyId = new ObjectId().toString()
    const blobStore = new BlobStore(historyId)

    const blob1 = await blobStore.putString('Confidential data')
    const hash1 = blob1.getHash()

    // Create a temporary file
    const fs = await import('node:fs/promises')
    const os = await import('node:os')
    const path = await import('node:path')

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'redact-test-'))
    const tmpFile = path.join(tmpDir, 'replacement.txt')
    await fs.writeFile(tmpFile, 'Replacement file content')

    try {
      // Redact blob1
      const result = await runScript([
        '--historyId',
        historyId,
        '--blob',
        hash1,
        '--file',
        tmpFile,
        '--yes',
      ])

      expect(result.status).to.equal(0)
      expect(result.stdout).to.include(`Replacing blob ${hash1}`)

      // Check blob1 has replacement content
      const redactedContent = await blobStore.getString(hash1)
      expect(redactedContent).to.equal('Replacement file content')
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('should error when conflicting options are provided', async function () {
    const historyId = new ObjectId().toString()
    const blobStore = new BlobStore(historyId)

    const blob1 = await blobStore.putString('Confidential data')
    const hash1 = blob1.getHash()

    // Redact blob1 with conflicting flags
    const result = await runScript([
      '--historyId',
      historyId,
      '--blob',
      hash1,
      '--delete',
      '--file',
      'dummy.txt',
    ])

    expect(result.status).to.equal(1)
    expect(result.stderr).to.include('Error: Conflicting options provided')
    expect(result.stderr).to.include('--delete')
    expect(result.stderr).to.include('--file')
  })
})
