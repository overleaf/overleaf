import { expect } from 'chai'
import { backupGenerator } from '../../../../storage/lib/backupGenerator.mjs'
import ChunkStore from '../../../../storage/lib/chunk_store/index.js'
import persistChanges from '../../../../storage/lib/persist_changes.js'
import {
  Change,
  Operation,
  TextOperation,
  AddFileOperation,
  File,
} from 'overleaf-editor-core'
import { ObjectId } from 'mongodb'
import testFiles from './support/test_files.js'
import { BlobStore } from '../../../../storage/lib/blob_store/index.js'
import fs from 'node:fs'
import blobHash from '../../../../storage/lib/blob_hash.js'

const scenarios = [
  {
    description: 'Postgres history',
    createProject: ChunkStore.initializeProject,
  },
  {
    description: 'Mongo history',
    createProject: () =>
      ChunkStore.initializeProject(new ObjectId().toString()),
  },
]

for (const scenario of scenarios) {
  describe(`backupGenerator with ${scenario.description}`, function () {
    let projectId
    let limitsToPersistImmediately
    let blobStore
    const NUM_CHUNKS = 3
    const FINAL_VERSION = 24

    before(function () {
      // used to provide a limit which forces us to persist all of the changes
      const farFuture = new Date()
      farFuture.setTime(farFuture.getTime() + 7 * 24 * 3600 * 1000)
      limitsToPersistImmediately = {
        minChangeTimestamp: farFuture,
        maxChangeTimestamp: farFuture,
        maxChunkChanges: 10,
      }
    })

    beforeEach(async function () {
      projectId = await scenario.createProject()
      blobStore = new BlobStore(projectId)

      // Add test files first
      await Promise.all([
        blobStore.putFile(testFiles.path('graph.png')),
        blobStore.putFile(testFiles.path('non_bmp.txt')),
      ])

      const HELLO_TXT = fs.readFileSync(testFiles.path('hello.txt')).toString()

      // Create a sample project history for testing, with a chunk size of 10
      //
      // 1. Add a text file main.tex with contents from hello.txt
      // 2. Add a binary file image.png with contents from graph.png
      // 3. Add a text file other.tex with empty contents
      // 4. Apply 10 changes that append characters to the end of other.tex giving 'aaaaaaaaaa'
      // In applying the 10 changes we hit the first chunk boundary and create a new chunk.
      // The first chunk contains the 3 file operations and 7 changes
      // to other.tex which is now "aaaaaaa" (7 characters)
      //    snapshot: {}
      //    changes: add main.tex, add image.png, add other.tex, 7 changes to other.tex
      // The second chunk has a snapshot with the existing files
      //    snapshot: main.tex, image.png, other.tex="aaaaaaa" (7 characters)
      //    changes: 3 changes to other.tex, each appending 'a'
      // 5. Now we add a new file non_bmp.txt with non-BMP characters
      // 6. Finally we apply 10 more changes to other.tex, each appending another 'a' to give 'aaaaaaaaaaaaaaaaaaaa' (20 characters)
      // In applying the 10 changes we hit another chunk boundary and create a third chunk.
      // The final state of the second chunk is
      //    snapshot: main.tex, image.png, other.tex="aaaaaaa" (7 characters)
      //    changes:
      //        3 changes to other.tex, each appending 'a'
      //        add file non_bmp.txt,
      //        6 changes to other.tex, each appending 'a'
      // The third chunk will contain the last 4 changes to other.tex
      //    snapshot: main.tex, image.png, non_bmp.tex, other.tex="aaaaaaaaaaaaaaaa" (16 characters)
      //    changes: 4 changes to other.tex, each appending 'a'

      const textChange = new Change(
        [new AddFileOperation('main.tex', File.fromString(HELLO_TXT))],
        new Date(),
        []
      )
      const binaryChange = new Change(
        [
          new AddFileOperation(
            'image.png',
            File.fromHash(testFiles.GRAPH_PNG_HASH)
          ),
        ],
        new Date(),
        []
      )
      const otherChange = new Change(
        [new AddFileOperation('other.tex', File.fromString(''))],
        new Date(),
        []
      )
      // now append characters to the end of the contents of other.tex
      const otherEdits = Array.from(
        { length: 10 },
        (_, i) =>
          new Change(
            [
              Operation.editFile(
                'other.tex',
                TextOperation.fromJSON({
                  textOperation: i === 0 ? ['a'] : [i, 'a'],
                })
              ),
            ],
            new Date(),
            []
          )
      )
      const newFile = new Change(
        [
          new AddFileOperation(
            'non_bmp.txt',
            File.fromHash(testFiles.NON_BMP_TXT_HASH)
          ),
        ],
        new Date(),
        []
      )
      const moreOtherEdits = Array.from(
        { length: 10 },
        (_, i) =>
          new Change(
            [
              Operation.editFile(
                'other.tex',
                TextOperation.fromJSON({ textOperation: [i + 10, 'a'] })
              ),
            ],
            new Date(),
            []
          )
      )

      await persistChanges(
        projectId,
        [
          textChange,
          binaryChange,
          otherChange,
          ...otherEdits,
          newFile,
          ...moreOtherEdits,
        ],
        limitsToPersistImmediately,
        0
      )
    })

    it('should yield correct data for an initial backup', async function () {
      const results = []
      for await (const result of backupGenerator(projectId)) {
        results.push(result)
      }

      // There should be 3 chunks
      expect(results).to.have.length(NUM_CHUNKS)

      // First chunk
      expect(results[0].chunkRecord.startVersion).to.equal(0)
      expect(results[0].chunkRecord.endVersion).to.equal(10)
      expect(results[0].blobsToBackup).to.have.deep.members([
        {
          hash: testFiles.HELLO_TXT_HASH,
          byteLength: testFiles.HELLO_TXT_BYTE_LENGTH,
          stringLength: testFiles.HELLO_TXT_UTF8_LENGTH,
        },
        {
          hash: testFiles.GRAPH_PNG_HASH,
          byteLength: testFiles.GRAPH_PNG_BYTE_LENGTH,
          stringLength: null,
        },
        {
          hash: File.EMPTY_FILE_HASH,
          byteLength: 0,
          stringLength: 0,
        },
      ])

      // Second chunk
      expect(results[1].chunkRecord.startVersion).to.equal(10)
      expect(results[1].chunkRecord.endVersion).to.equal(20)
      expect(results[1].blobsToBackup).to.have.deep.members([
        {
          hash: blobHash.fromString('a'.repeat(7)),
          byteLength: 7,
          stringLength: 7,
        },
        {
          hash: testFiles.NON_BMP_TXT_HASH,
          byteLength: testFiles.NON_BMP_TXT_BYTE_LENGTH,
          stringLength: null,
        },
      ])

      // Third chunk
      expect(results[2].chunkRecord.startVersion).to.equal(20)
      expect(results[2].chunkRecord.endVersion).to.equal(24)
      expect(results[2].blobsToBackup).to.have.deep.members([
        {
          hash: blobHash.fromString('a'.repeat(16)),
          byteLength: 16,
          stringLength: 16,
        },
      ])
    })

    for (
      let lastBackedUpVersion = 0;
      lastBackedUpVersion <= FINAL_VERSION;
      lastBackedUpVersion++
    ) {
      it(`should yield the expected data when the last backed up version was ${lastBackedUpVersion}`, async function () {
        const results = []
        for await (const result of backupGenerator(
          projectId,
          lastBackedUpVersion
        )) {
          results.push(result)
        }

        const chunkDefinitions = [
          {
            chunk: { startVersion: 0, endVersion: 10 },
            blobs: [
              {
                version: 1,
                blob: {
                  hash: testFiles.HELLO_TXT_HASH,
                  byteLength: testFiles.HELLO_TXT_BYTE_LENGTH,
                  stringLength: testFiles.HELLO_TXT_UTF8_LENGTH,
                },
              },
              {
                version: 2,
                blob: {
                  hash: testFiles.GRAPH_PNG_HASH,
                  byteLength: testFiles.GRAPH_PNG_BYTE_LENGTH,
                  stringLength: null,
                },
              },
              {
                version: 3,
                blob: {
                  hash: File.EMPTY_FILE_HASH,
                  byteLength: 0,
                  stringLength: 0,
                },
              },
            ],
          },
          {
            chunk: { startVersion: 10, endVersion: 20 },
            blobs: [
              {
                version: 11,
                blob: {
                  hash: blobHash.fromString('a'.repeat(7)),
                  byteLength: 7,
                  stringLength: 7,
                },
              },
              {
                version: 14,
                blob: {
                  hash: testFiles.NON_BMP_TXT_HASH,
                  byteLength: testFiles.NON_BMP_TXT_BYTE_LENGTH,
                  stringLength: null,
                },
              },
            ],
          },
          {
            chunk: { startVersion: 20, endVersion: 24 },
            blobs: [
              {
                version: 21,
                blob: {
                  hash: blobHash.fromString('a'.repeat(16)),
                  byteLength: 16,
                  stringLength: 16,
                },
              },
            ],
          },
        ]

        const expectedChunks = chunkDefinitions
          .filter(({ chunk }) => lastBackedUpVersion < chunk.endVersion)
          .map(({ chunk }) => chunk)
        const expectedBlobs = chunkDefinitions
          .filter(({ chunk }) => lastBackedUpVersion < chunk.endVersion)
          .map(({ blobs }) =>
            blobs
              .filter(({ version }) => lastBackedUpVersion < version)
              .map(({ blob }) => blob)
          )

        expect(results).to.have.length(expectedChunks.length)
        expect(results).to.have.length(expectedBlobs.length)

        results.forEach((result, i) => {
          expect(result.chunkRecord).to.deep.include(expectedChunks[i])
          expect(result.blobsToBackup).to.have.deep.members(expectedBlobs[i])
        })
      })
    }

    it(`should not back up blobs that have already been backed up in previous chunks`, async function () {
      const results = []
      for await (const result of backupGenerator(projectId)) {
        results.push(result)
      }
      const seenBlobs = new Set()
      for (const result of results) {
        for (const blob of result.blobsToBackup) {
          expect(seenBlobs).to.not.include(blob.hash)
          seenBlobs.add(blob.hash)
        }
      }
    })
  })
}
