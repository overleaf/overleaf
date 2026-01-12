import config from 'config'
import { ObjectId } from 'mongodb'
import { expect } from 'chai'
import {
  backedUpBlobs,
  client,
  globalBlobs,
} from '../../../../storage/lib/mongodb.js'
import persistor from '../../../../storage/lib/persistor.js'
import {
  loadGlobalBlobs,
  BlobStore,
  makeProjectKey,
} from '../../../../storage/lib/blob_store/index.js'
import { NotFoundError } from '@overleaf/object-persistor/src/Errors.js'
import projectKey from '@overleaf/object-persistor/src/ProjectKey.js'
import { getBackupStatus } from '../../../../storage/lib/backup_store/index.js'
import { text, buffer } from 'node:stream/consumers'
import { createGunzip } from 'node:zlib'
import { Change, Operation, File, TextOperation } from 'overleaf-editor-core'
import ChunkStore from '../../../../storage/lib/chunk_store/index.js'
import persistChanges from '../../../../storage/lib/persist_changes.js'
import { historyStore } from '../../../../storage/lib/history_store.js'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import testFiles from '../storage/support/test_files.js'
import fs from 'node:fs'
import {
  backupBlob,
  storeBlobBackup,
} from '../../../../storage/lib/backupBlob.mjs'
import {
  backupPersistor,
  projectBlobsBucket,
  chunksBucket,
} from '../../../../storage/lib/backupPersistor.mjs'
import { Readable } from 'node:stream'
import { ListObjectsV2Command } from '@aws-sdk/client-s3'

const projectsCollection = client.db().collection('projects')

/**
 * @param {ObjectId} projectId
 * @param {number} version
 * @return {string}
 */
function makeChunkKey(projectId, version) {
  return projectKey.format(projectId) + '/' + projectKey.pad(version)
}

describe('backup script', function () {
  let project
  let projectId, historyId
  let limitsToPersistImmediately

  before(function () {
    // Used to provide a limit which forces us to persist all of the changes
    const farFuture = new Date()
    farFuture.setTime(farFuture.getTime() + 7 * 24 * 3600 * 1000)
    limitsToPersistImmediately = {
      minChangeTimestamp: farFuture,
      maxChangeTimestamp: farFuture,
      maxChanges: 10,
      maxChunkChanges: 10,
    }
  })

  beforeEach(async function () {
    // Set up test projects with proper history metadata
    projectId = new ObjectId()
    historyId = projectId.toString()
    project = {
      _id: projectId,
      overleaf: {
        history: {
          id: historyId,
          currentEndVersion: 0, // Will be updated as changes are made
          currentEndTimestamp: new Date(), // Will be updated as changes are made
        },
        backup: {
          // Start with no backup state
        },
      },
    }

    // Pre-load the global blobs
    await loadGlobalBlobs()

    // Clean up any pre-existing test data
    await projectsCollection.deleteMany({
      _id: projectId,
    })
    await backedUpBlobs.deleteMany({}) // Clear any existing backedUpBlobs entries
  })

  describe('with simple project content', function () {
    const contentString = 'hello world'
    const newContentString = 'hello world more'
    const graphPngPath = testFiles.path('graph.png')
    const graphPngBuf = fs.readFileSync(graphPngPath)
    const graphPngHash = testFiles.GRAPH_PNG_HASH
    const nonBmpPath = testFiles.path('non_bmp.txt')
    const DUMMY_HASH = '1111111111111111111111111111111111111111'

    beforeEach(async function () {
      // Create initial project
      await projectsCollection.insertOne(project)

      // Initialize project in chunk store
      await ChunkStore.initializeProject(historyId)

      const blobStore = new BlobStore(historyId)

      // Create the blobs and then back them up using backupBlob
      const graphPngBlob = await blobStore.putFile(graphPngPath)
      await backupBlob(historyId, graphPngBlob, graphPngPath)

      // Add initial content using persistChanges
      const file = File.fromString(contentString)
      const addFileOp = Operation.addFile('main.tex', file)
      const addGraphFileOp = Operation.addFile(
        'graph.png',
        File.fromHash(testFiles.GRAPH_PNG_HASH)
      )
      const change1 = new Change([addFileOp, addGraphFileOp], new Date(), [])

      await persistChanges(historyId, [change1], limitsToPersistImmediately, 0)

      // Add a second change with a proper TextOperation
      // For text operation: first number is how many chars to retain, then the text to insert
      const textOp = TextOperation.fromJSON({
        textOperation: [contentString.length, ' more'], // Keep existing content, append ' more'
      })
      const editOp = Operation.editFile('main.tex', textOp)
      const change2 = new Change([editOp], new Date(), [])

      // store an unrelated hash in the backedUpBlobs collection,
      // so we can test that only the backed up hashes are cleared.
      await storeBlobBackup(historyId, DUMMY_HASH)

      await persistChanges(historyId, [change2], limitsToPersistImmediately, 1)
    })

    it('should perform an initial backup', async function () {
      // Run backup script for initial version
      const { stdout } = await runBackupScript(['--projectId', projectId])
      expect(stdout).to.not.include(
        'warning: persistor not passed to backupBlob'
      )

      // Verify backup state
      const result = await getBackupStatus(projectId)
      expect(result.backupStatus.lastBackedUpVersion).to.equal(2)
      expect(result.backupStatus.lastBackedUpAt).to.be.an.instanceOf(Date)
      expect(result.currentEndTimestamp).to.be.an.instanceOf(Date)
      expect(result.backupStatus.pendingChangeAt).to.be.undefined

      // Verify graph.png blob was backed up
      const graphBlobStream = await backupPersistor.getObjectStream(
        projectBlobsBucket,
        makeProjectKey(historyId, graphPngHash),
        { autoGunzip: true }
      )
      const graphBlobContent = await buffer(graphBlobStream)
      expect(graphBlobContent.equals(graphPngBuf)).to.be.true

      // Verify chunk was backed up
      const chunkStream = await backupPersistor.getObjectStream(
        chunksBucket,
        makeChunkKey(historyId, 0)
      )
      const chunkContent = await text(chunkStream.pipe(createGunzip()))
      const chunkMetadata = await ChunkStore.getLatestChunkMetadata(historyId)
      const rawHistory = await historyStore.loadRaw(historyId, chunkMetadata.id)
      expect(JSON.parse(chunkContent)).to.deep.equal(rawHistory)

      // Unrelated entries from backedUpBlobs should be not cleared
      const backedUpBlobsDoc = await backedUpBlobs.findOne({
        _id: project._id,
      })
      expect(backedUpBlobsDoc).not.to.be.null
      expect(backedUpBlobsDoc.blobs).to.have.length(1)
      expect(backedUpBlobsDoc.blobs[0].toString('hex')).to.equal(DUMMY_HASH)
    })

    it('should perform an incremental backup', async function () {
      // Backup first version
      const { stdout: stdout1 } = await runBackupScript([
        '--projectId',
        projectId,
      ])
      expect(stdout1).to.not.include(
        'warning: persistor not passed to backupBlob'
      )

      // Verify first backup
      const result1 = await getBackupStatus(projectId)
      expect(result1.backupStatus.lastBackedUpVersion).to.equal(2)

      // Persist additional changes
      const additionalTextOp = TextOperation.fromJSON({
        textOperation: [newContentString.length, ' even more'], // Keep existing content, append ' even more'
      })
      const additionalEditOp = Operation.editFile('main.tex', additionalTextOp)
      const firstTimestamp = new Date()
      const additionalChange = new Change(
        [additionalEditOp],
        firstTimestamp,
        []
      )

      // add the nonbmp file
      const blobStore = new BlobStore(historyId)
      const nonBmpBlob = await blobStore.putFile(nonBmpPath)
      await backupBlob(historyId, nonBmpBlob, nonBmpPath)

      // Verify that the non-BMP file was backed up when the file was added
      const newBackedUpBlobs = await backedUpBlobs.findOne({
        _id: project._id,
      })
      expect(newBackedUpBlobs).not.to.be.null
      expect(newBackedUpBlobs.blobs).to.have.length(2)
      expect(
        newBackedUpBlobs.blobs.map(b => b.toString('hex'))
      ).to.have.members([testFiles.NON_BMP_TXT_HASH, DUMMY_HASH])

      const addNonBmpFileOp = Operation.addFile(
        'non_bmp.txt',
        File.fromHash(testFiles.NON_BMP_TXT_HASH)
      )
      const secondTimestamp = new Date()
      const additionalChange2 = new Change(
        [addNonBmpFileOp],
        secondTimestamp,
        []
      )

      await persistChanges(
        historyId,
        [additionalChange, additionalChange2],
        limitsToPersistImmediately,
        2
      )

      const afterChangeResult = await getBackupStatus(projectId)
      // Verify that the currentEndVersion and currentEndTimestamp are updated
      expect(afterChangeResult.currentEndVersion).to.equal(4)
      expect(afterChangeResult.currentEndTimestamp)
        .to.be.an.instanceOf(Date)
        .and.to.be.greaterThan(result1.currentEndTimestamp)
      // Persisting a change should not modify the backup version and timestamp
      expect(afterChangeResult.backupStatus.lastBackedUpVersion).to.equal(2)
      expect(afterChangeResult.backupStatus.lastBackedUpAt)
        .to.be.an.instanceOf(Date)
        .and.to.deep.equal(result1.backupStatus.lastBackedUpAt)
      // but it should update the pendingChangeAt timestamp to the timestamp of the
      // first change which modified the project
      expect(afterChangeResult.backupStatus.pendingChangeAt)
        .to.be.an.instanceOf(Date)
        .and.to.deep.equal(firstTimestamp)

      // Second backup
      const { stdout: stdout2 } = await runBackupScript([
        '--projectId',
        projectId,
      ])
      expect(stdout2).to.not.include(
        'warning: persistor not passed to backupBlob'
      )

      // Verify incremental backup
      const result2 = await getBackupStatus(projectId)
      // The backup version and timestamp should be updated
      expect(result2.backupStatus.lastBackedUpVersion).to.equal(4)
      expect(result2.backupStatus.lastBackedUpAt)
        .to.be.an.instanceOf(Date)
        .and.to.be.greaterThan(result1.backupStatus.lastBackedUpAt)
      // The currentEndVersion and currentEndTimestamp should not be modified
      expect(result2.currentEndVersion).to.equal(4)
      expect(result2.currentEndTimestamp)
        .to.be.an.instanceOf(Date)
        .and.to.deep.equal(afterChangeResult.currentEndTimestamp)
      // The pendingChangeAt timestamp should be cleared when the backup is complete
      expect(result2.backupStatus.pendingChangeAt).to.be.undefined

      // Verify additional blob was backed up
      const newBlobStream = await backupPersistor.getObjectStream(
        projectBlobsBucket,
        makeProjectKey(historyId, testFiles.NON_BMP_TXT_HASH),
        { autoGunzip: true }
      )
      const newBlobContent = await buffer(newBlobStream)
      expect(newBlobContent).to.deep.equal(
        fs.readFileSync(testFiles.path('non_bmp.txt'))
      )

      // Check chunk was backed up
      const chunkStream = await backupPersistor.getObjectStream(
        chunksBucket,
        makeChunkKey(historyId, 0)
      )
      const chunkContent = await text(chunkStream.pipe(createGunzip()))
      const chunkMetadata = await ChunkStore.getLatestChunkMetadata(historyId)
      const rawHistory = await historyStore.loadRaw(historyId, chunkMetadata.id)
      expect(JSON.parse(chunkContent)).to.deep.equal(rawHistory)

      // Unrelated entries from backedUpBlobs should be not cleared
      const backedUpBlobsDoc = await backedUpBlobs.findOne({
        _id: project._id,
      })
      expect(backedUpBlobsDoc).not.to.be.null
      expect(backedUpBlobsDoc.blobs).to.have.length(1)
      expect(backedUpBlobsDoc.blobs[0].toString('hex')).to.equal(DUMMY_HASH)
    })

    it('should not backup global blobs', async function () {
      const globalBlobString = 'a'
      const globalBlobHash = testFiles.STRING_A_HASH
      await globalBlobs.insertOne({
        _id: globalBlobHash,
        byteLength: globalBlobString.length,
        stringLength: globalBlobString.length,
      })
      const bucket = config.get('blobStore.globalBucket')
      for (const { key, content } of [
        {
          key: '2e/65/efe2a145dda7ee51d1741299f848e5bf752e',
          content: globalBlobString,
        },
      ]) {
        const stream = Readable.from([content])
        await persistor.sendStream(bucket, key, stream)
      }
      await loadGlobalBlobs()

      // Create a change using the global blob
      const addFileOp = Operation.addFile(
        'global.tex',
        File.fromHash(globalBlobHash)
      )
      const change = new Change([addFileOp], new Date(), [])

      await persistChanges(historyId, [change], limitsToPersistImmediately, 2)

      // Run backup
      await runBackupScript(['--projectId', projectId])

      // Verify global blob wasn't backed up
      try {
        await backupPersistor.getObjectStream(
          projectBlobsBucket,
          makeProjectKey(historyId, globalBlobHash),
          { autoGunzip: true }
        )
        expect.fail('Should not find global blob in project blobs')
      } catch (err) {
        expect(err).to.be.an.instanceOf(NotFoundError)
      }
    })

    it('should back up global blobs if they are demoted', async function () {
      const demotedBlobString = 'ab'
      const demotedBlobHash = testFiles.STRING_AB_HASH
      await globalBlobs.insertOne({
        _id: demotedBlobHash,
        byteLength: demotedBlobString.length,
        stringLength: demotedBlobString.length,
        demoted: true,
      })
      const bucket = config.get('blobStore.globalBucket')
      for (const { key, content } of [
        {
          key: '9a/e9/e86b7bd6cb1472d9373702d8249973da0832',
          content: demotedBlobString,
        },
      ]) {
        const stream = Readable.from([content])
        await persistor.sendStream(bucket, key, stream)
      }
      await loadGlobalBlobs()

      // Create a change using the global blob
      const addFileOp = Operation.addFile(
        'demoted.tex',
        File.fromHash(demotedBlobHash)
      )
      const change = new Change([addFileOp], new Date(), [])

      await persistChanges(historyId, [change], limitsToPersistImmediately, 2)

      // Run backup
      const { stdout } = await runBackupScript(['--projectId', projectId])
      expect(stdout).to.not.include(
        'warning: persistor not passed to backupBlob'
      )

      // Check chunk was backed up
      const chunkStream = await backupPersistor.getObjectStream(
        chunksBucket,
        makeChunkKey(historyId, 0)
      )
      const chunkContent = await text(chunkStream.pipe(createGunzip()))
      const chunkMetadata = await ChunkStore.getLatestChunkMetadata(historyId)
      const rawHistory = await historyStore.loadRaw(historyId, chunkMetadata.id)
      expect(JSON.parse(chunkContent)).to.deep.equal(rawHistory)

      // Verify that the demoted global blob was backed up
      try {
        const demotedBlobStream = await backupPersistor.getObjectStream(
          projectBlobsBucket,
          makeProjectKey(historyId, demotedBlobHash),
          {
            autoGunzip: true,
          }
        )
        const demotedBlobContent = await buffer(demotedBlobStream)
        expect(demotedBlobContent).to.deep.equal(Buffer.from(demotedBlobString))
      } catch (err) {
        expect.fail('Should find demoted global blob in project blobs')
      }
    })
  })

  describe('with complex project content', function () {
    let beforeInitializationTimestamp
    let afterInitializationTimestamp

    beforeEach(async function () {
      // Create initial project
      await projectsCollection.insertOne(project)

      // Initialize project in chunk store
      // bracket the initialisation with two timestamps to check the pendingChangeAt field
      beforeInitializationTimestamp = new Date()
      await ChunkStore.initializeProject(historyId)
      afterInitializationTimestamp = new Date()

      const blobStore = new BlobStore(historyId)

      // Set up test files with varying content
      const testFilesData = {
        mainTex: { name: 'main.tex', content: 'Initial content' },
        chapter1: { name: 'chapter1.tex', content: 'Chapter 1 content' },
        chapter2: { name: 'chapter2.tex', content: 'Chapter 2 content' },
        bibliography: {
          name: 'bibliography.bib',
          content: '@article{key1,\n  title={Title1}\n}',
          newContent: '@article{key2,\n  title={Title2}\n}',
        },
        graph: {
          name: 'graph.png',
          path: testFiles.path('graph.png'),
          hash: testFiles.GRAPH_PNG_HASH,
        },
        unicodeFile: {
          name: 'unicodeFile.tex',
          path: testFiles.path('non_bmp.txt'),
          hash: testFiles.NON_BMP_TXT_HASH,
        },
      }

      const textFiles = [
        testFilesData.mainTex,
        testFilesData.chapter1,
        testFilesData.chapter2,
        testFilesData.bibliography,
      ]
      const binaryFiles = [testFilesData.graph, testFilesData.unicodeFile]

      // Add binary files first
      await Promise.all(binaryFiles.map(file => blobStore.putFile(file.path)))

      // Back up the binary files
      await Promise.all(
        binaryFiles.map(async file => {
          await backupBlob(
            historyId,
            await blobStore.putFile(file.path),
            file.path
          )
        })
      )

      // Create operations to add all files initially
      const addFileOperations = Object.values(testFilesData).map(file => {
        if (file.path) {
          return Operation.addFile(file.name, File.fromHash(file.hash))
        }
        return Operation.addFile(file.name, File.fromString(file.content))
      })

      // Initial change adding all files
      const initialChange = new Change(addFileOperations, new Date(), [])
      await persistChanges(
        historyId,
        [initialChange],
        limitsToPersistImmediately,
        0
      )

      // Generate a series of edit operations for each text file
      const editOperations = []
      for (let i = 0; i < 50; i++) {
        const targetFile = textFiles[i % textFiles.length]
        if (!targetFile.path) {
          // Skip binary/unicode files
          const appendText = `\n\nEdit ${i + 1}`
          targetFile.content += appendText
          const textOp = TextOperation.fromJSON({
            textOperation: [
              targetFile.content.length - appendText.length,
              appendText,
            ],
          })
          const editOp = Operation.editFile(targetFile.name, textOp)
          editOperations.push(new Change([editOp], new Date(), []))
        }
      }

      // Add a delete operation
      const deleteChange = new Change(
        [Operation.removeFile(testFilesData.bibliography.name)],
        new Date(),
        []
      )
      editOperations.push(deleteChange)

      // Add the file back with different content
      const addBackChange = new Change(
        [
          Operation.addFile(
            testFilesData.bibliography.name,
            File.fromString(testFilesData.bibliography.newContent)
          ),
        ],
        new Date(),
        []
      )
      editOperations.push(addBackChange)
      // Persist all changes
      await persistChanges(
        historyId,
        editOperations,
        limitsToPersistImmediately,
        1
      )
    })

    it('persistChanges should set the pendingChangeAt field to the time of snapshot initialisation', async function () {
      const result = await getBackupStatus(projectId)
      expect(result.backupStatus.pendingChangeAt).to.be.an.instanceOf(Date)
      expect(result.backupStatus.pendingChangeAt)
        .to.be.greaterThan(beforeInitializationTimestamp)
        .and.to.be.lessThan(afterInitializationTimestamp)
    })

    it('should backup all chunks and blobs from a complex project history', async function () {
      // Run backup script
      const { stdout } = await runBackupScript(['--projectId', projectId])
      expect(stdout).to.not.include(
        'warning: persistor not passed to backupBlob'
      )

      // Verify backup state
      const result = await getBackupStatus(projectId)
      expect(result.backupStatus.lastBackedUpVersion).to.equal(53) // 1 initial change + 50 edits + 1 delete + 1 add back
      expect(result.backupStatus.lastBackedUpAt).to.be.an.instanceOf(Date)
      expect(result.currentEndTimestamp).to.be.an.instanceOf(Date)
      expect(result.backupStatus.pendingChangeAt).to.be.undefined

      // Verify that binary files were backed up
      for (const hash of [
        testFiles.GRAPH_PNG_HASH,
        testFiles.NON_BMP_TXT_HASH,
      ]) {
        const blobStream = await backupPersistor.getObjectStream(
          projectBlobsBucket,
          makeProjectKey(historyId, hash),
          { autoGunzip: true }
        )
        expect(blobStream).to.exist
      }

      // Get all chunks and verify they were backed up
      const listing = await backupPersistor
        ._getClientForBucket(chunksBucket)
        .send(
          new ListObjectsV2Command({
            Bucket: chunksBucket,
            Prefix: projectKey.format(historyId) + '/',
          })
        )

      const chunkKeys = listing.Contents.map(item => item.Key)
      expect(chunkKeys.length).to.equal(6) // Should have multiple chunks

      const localChunks = await ChunkStore.getProjectChunks(historyId)
      const chunksByStartVersion = new Map()
      for (const chunkRecord of localChunks) {
        chunksByStartVersion.set(chunkRecord.startVersion, chunkRecord)
      }

      // Verify the content of each chunk matches what's in the history store
      for (const chunkKey of chunkKeys) {
        const chunkStream = await backupPersistor.getObjectStream(
          chunksBucket,
          chunkKey
        )
        const chunkContent = await text(chunkStream.pipe(createGunzip()))
        const startVersion = parseInt(chunkKey.split('/').pop(), 10)
        const chunk = chunksByStartVersion.get(startVersion)
        const rawHistory = await historyStore.loadRaw(historyId, chunk.id)
        expect(JSON.parse(chunkContent)).to.deep.equal(rawHistory)
      }
    })

    it('should throw an error if downloading a blob fails', async function () {
      const blobStore = new BlobStore(historyId)
      const blob = await blobStore.putFile(
        testFiles.path('null_characters.txt')
      )
      const change = new Change(
        [Operation.addFile('broken-file', File.fromHash(blob.getHash()))],
        new Date(),
        []
      )
      // Persist all changes
      await persistChanges(historyId, [change], limitsToPersistImmediately, 53)

      // Delete the blob from the underlying storage to simulate a failure
      const bucket = config.get('blobStore.projectBucket')
      const key = makeProjectKey(historyId, blob.getHash())
      await persistor.deleteObject(bucket, key)

      // Run backup script - it should fail because the blob is missing
      let result
      try {
        result = await runBackupScript(['--projectId', projectId])
        expect.fail('Backup script should have failed')
      } catch (err) {
        expect(err).to.exist
        expect(result).to.not.exist
      }

      // Verify that backup did not complete
      const newBackupStatus = await getBackupStatus(projectId)
      expect(newBackupStatus.backupStatus.lastBackedUpVersion).to.equal(50) // backup fails on final chunk
      expect(newBackupStatus.currentEndVersion).to.equal(54) // backup is incomplete due to missing blob
    })
  })
})

/**
 * Run the backup script with given arguments
 * @param {string[]} args
 */
async function runBackupScript(args) {
  const TIMEOUT = 20 * 1000
  let result
  try {
    result = await promisify(execFile)(
      'node',
      ['storage/scripts/backup.mjs', ...args],
      {
        encoding: 'utf-8',
        timeout: TIMEOUT,
        env: {
          ...process.env,
          LOG_LEVEL: 'debug', // Override LOG_LEVEL of acceptance tests
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
  if (result.status !== 0) {
    throw new Error('backup failed')
  }
  return result
}
