'use strict'

const _ = require('lodash')
const { expect } = require('chai')
const config = require('config')
const fs = require('node:fs')
const path = require('node:path')
const { Readable } = require('node:stream')
const temp = require('temp').track()
const { promisify } = require('node:util')

const cleanup = require('./support/cleanup')
const testFiles = require('./support/test_files')

const { Blob, TextOperation } = require('overleaf-editor-core')
const {
  BlobStore,
  loadGlobalBlobs,
  mongodb,
  persistor,
  streams,
} = require('../../../../storage')
const mongoBackend = require('../../../../storage/lib/blob_store/mongo')
const postgresBackend = require('../../../../storage/lib/blob_store/postgres')
const { getProjectBlobsBatch } = require('../../../../storage/lib/blob_store')

const mkTmpDir = promisify(temp.mkdir)

describe('BlobStore', function () {
  const helloWorldString = 'Hello World'
  const helloWorldHash = '5e1c309dae7f45e0f39b1bf3ac3cd9db12e7d689'
  const globalBlobString = 'a'
  const globalBlobHash = testFiles.STRING_A_HASH
  const demotedBlobString = 'ab'
  const demotedBlobHash = testFiles.STRING_AB_HASH

  beforeEach(cleanup.everything)

  beforeEach('install a global blob', async function () {
    await mongodb.globalBlobs.insertOne({
      _id: globalBlobHash,
      byteLength: globalBlobString.length,
      stringLength: globalBlobString.length,
    })
    await mongodb.globalBlobs.insertOne({
      _id: demotedBlobHash,
      byteLength: demotedBlobString.length,
      stringLength: demotedBlobString.length,
      demoted: true,
    })
    const bucket = config.get('blobStore.globalBucket')
    for (const { key, content } of [
      {
        key: '2e/65/efe2a145dda7ee51d1741299f848e5bf752e',
        content: globalBlobString,
      },
      {
        key: '9a/e9/e86b7bd6cb1472d9373702d8249973da0832',
        content: demotedBlobString,
      },
    ]) {
      const stream = Readable.from([content])
      await persistor.sendStream(bucket, key, stream)
    }
    await loadGlobalBlobs()
  })

  const scenarios = [
    {
      description: 'Postgres backend',
      projectId: '123',
      projectId2: '456',
      backend: postgresBackend,
    },
    {
      description: 'Mongo backend',
      projectId: '63725f84b2bdd246ec8c0000',
      projectId2: '63725f84b2bdd246ec8c1234',
      backend: mongoBackend,
    },
  ]
  for (const scenario of scenarios) {
    describe(scenario.description, function () {
      const blobStore = new BlobStore(scenario.projectId)
      const blobStore2 = new BlobStore(scenario.projectId2)

      beforeEach('initialize the blob stores', async function () {
        await blobStore.initialize()
        await blobStore2.initialize()
      })

      it('can initialize a project again without throwing an error', async function () {
        await blobStore.initialize()
        await blobStore2.initialize()
      })

      it('can store and fetch string content', async function () {
        function checkBlob(blob) {
          expect(blob.getHash()).to.equal(helloWorldHash)
          expect(blob.getByteLength()).to.equal(helloWorldString.length)
          expect(blob.getStringLength()).to.equal(helloWorldString.length)
        }

        const insertedBlob = await blobStore.putString(helloWorldString)
        checkBlob(insertedBlob)
        const fetchedBlob = await blobStore.getBlob(helloWorldHash)
        checkBlob(fetchedBlob)
        const content = await blobStore.getString(helloWorldHash)
        expect(content).to.equal(helloWorldString)
      })

      it('can store and fetch utf-8 files', async function () {
        const testFile = 'hello.txt'

        function checkBlob(blob) {
          expect(blob.getHash()).to.equal(testFiles.HELLO_TXT_HASH)
          expect(blob.getByteLength()).to.equal(testFiles.HELLO_TXT_BYTE_LENGTH)
          expect(blob.getStringLength()).to.equal(
            testFiles.HELLO_TXT_UTF8_LENGTH
          )
        }

        const insertedBlob = await blobStore.putFile(testFiles.path(testFile))
        checkBlob(insertedBlob)
        const fetchedBlob = await blobStore.getBlob(testFiles.HELLO_TXT_HASH)
        checkBlob(fetchedBlob)
        const content = await blobStore.getString(testFiles.HELLO_TXT_HASH)
        expect(content).to.equal('Olá mundo\n')
      })

      it('can store and fetch a large text file', async function () {
        const testString = _.repeat('a', 1000000)
        const testHash = 'de1fbf0c2f34f67f01f355f31ed0cf7319643c5e'

        function checkBlob(blob) {
          expect(blob.getHash()).to.equal(testHash)
          expect(blob.getByteLength()).to.equal(testString.length)
          expect(blob.getStringLength()).to.equal(testString.length)
        }

        const dir = await mkTmpDir('blobStore')
        const pathname = path.join(dir, 'a.txt')
        fs.writeFileSync(pathname, testString)
        const insertedBlob = await blobStore.putFile(pathname)
        checkBlob(insertedBlob)
        const fetchedBlob = await blobStore.getBlob(testHash)
        checkBlob(fetchedBlob)
        const content = await blobStore.getString(testHash)
        expect(content).to.equal(testString)
      })

      it('stores overlarge text files as binary', async function () {
        const testString = _.repeat('a', TextOperation.MAX_STRING_LENGTH + 1)
        const dir = await mkTmpDir('blobStore')
        const pathname = path.join(dir, 'a.txt')
        fs.writeFileSync(pathname, testString)
        const blob = await blobStore.putFile(pathname)
        expect(blob.getByteLength()).to.equal(testString.length)
        expect(blob.getStringLength()).not.to.exist
      })

      it('can store and fetch binary files', async function () {
        const testFile = 'graph.png'

        function checkBlob(blob) {
          expect(blob.getHash()).to.equal(testFiles.GRAPH_PNG_HASH)
          expect(blob.getByteLength()).to.equal(testFiles.GRAPH_PNG_BYTE_LENGTH)
          expect(blob.getStringLength()).to.be.null
        }

        const insertedBlob = await blobStore.putFile(testFiles.path(testFile))
        checkBlob(insertedBlob)
        const fetchedBlob = await blobStore.getBlob(testFiles.GRAPH_PNG_HASH)
        checkBlob(fetchedBlob)
        const stream = await blobStore.getStream(testFiles.GRAPH_PNG_HASH)
        const buffer = await streams.readStreamToBuffer(stream)
        expect(buffer.length).to.equal(testFiles.GRAPH_PNG_BYTE_LENGTH)
        expect(buffer.toString('hex', 0, 8)).to.equal(
          testFiles.PNG_MAGIC_NUMBER
        )
      })

      const missingHash = 'deadbeef00000000000000000000000000000000'

      it('fails to get a missing key as a string', async function () {
        try {
          await blobStore.getString(missingHash)
        } catch (err) {
          expect(err).to.be.an.instanceof(Blob.NotFoundError)
          expect(err.hash).to.equal(missingHash)
          return
        }
        expect.fail('expected NotFoundError')
      })

      it('fails to get a missing key as a stream', async function () {
        try {
          await blobStore.getStream(missingHash)
        } catch (err) {
          expect(err).to.be.an.instanceof(Blob.NotFoundError)
          return
        }
        expect.fail('expected NotFoundError')
      })

      it('reads invalid utf-8 as utf-8', async function () {
        // We shouldn't do this, but we need to know what happens if we do.
        // TODO: We should throw an error instead, but this function doesn't have
        // an easy way of checking the content type.
        const testFile = 'graph.png'
        await blobStore.putFile(testFiles.path(testFile))
        const content = await blobStore.getString(testFiles.GRAPH_PNG_HASH)
        expect(content.length).to.equal(12902)
      })

      it('checks for non BMP characters', async function () {
        const testFile = 'non_bmp.txt'
        await blobStore.putFile(testFiles.path(testFile))
        const blob = await blobStore.getBlob(testFiles.NON_BMP_TXT_HASH)
        expect(blob.getStringLength()).to.be.null
        expect(blob.getByteLength()).to.equal(testFiles.NON_BMP_TXT_BYTE_LENGTH)
      })

      it('can fetch metadata for multiple blobs at once', async function () {
        await blobStore.putFile(testFiles.path('graph.png'))
        const blobs = await blobStore.getBlobs([
          testFiles.GRAPH_PNG_HASH,
          testFiles.HELLO_TXT_HASH, // not found
          testFiles.GRAPH_PNG_HASH, // requested twice
        ])
        const hashes = blobs.map(blob => blob.getHash())
        expect(hashes).to.deep.equal([testFiles.GRAPH_PNG_HASH])
      })

      describe('multiple blobs in the same project', async function () {
        beforeEach(async function () {
          await blobStore.putString(helloWorldString)
          await blobStore.putFile(testFiles.path('graph.png'))
          await blobStore.putFile(testFiles.path('hello.txt'))
        })

        it('getBlob() returns each blob', async function () {
          const helloBlob = await blobStore.getBlob(testFiles.HELLO_TXT_HASH)
          const graphBlob = await blobStore.getBlob(testFiles.GRAPH_PNG_HASH)
          const helloWorldBlob = await blobStore.getBlob(helloWorldHash)
          expect(helloBlob.hash).to.equal(testFiles.HELLO_TXT_HASH)
          expect(graphBlob.hash).to.equal(testFiles.GRAPH_PNG_HASH)
          expect(helloWorldBlob.hash).to.equal(helloWorldHash)
        })

        it('getBlobs() returns all blobs', async function () {
          const blobs = await blobStore.getBlobs([
            testFiles.HELLO_TXT_HASH,
            testFiles.GRAPH_PNG_HASH,
            testFiles.NON_BMP_TXT_HASH, // not in blob store
          ])
          const actualHashes = blobs.map(blob => blob.hash)
          expect(actualHashes).to.have.members([
            testFiles.HELLO_TXT_HASH,
            testFiles.GRAPH_PNG_HASH,
          ])
        })

        it('getProjectBlobs() returns all blobs in the project', async function () {
          const blobs = await blobStore.getProjectBlobs()
          const hashes = blobs.map(blob => blob.getHash())
          expect(hashes).to.have.members([
            testFiles.HELLO_TXT_HASH,
            testFiles.GRAPH_PNG_HASH,
            helloWorldHash,
          ])
        })
      })

      describe('two blob stores on different projects', function () {
        beforeEach(async function () {
          await blobStore.putString(helloWorldString)
          await blobStore2.putFile(testFiles.path('graph.png'))
        })

        it('separates blobs when calling getBlob()', async function () {
          const blobFromStore1 = await blobStore.getBlob(helloWorldHash)
          const blobFromStore2 = await blobStore2.getBlob(helloWorldHash)
          expect(blobFromStore1).to.exist
          expect(blobFromStore2).not.to.exist
        })

        it('separates blobs when calling getBlobs()', async function () {
          const blobsFromStore1 = await blobStore.getBlobs([
            helloWorldHash,
            testFiles.GRAPH_PNG_HASH,
          ])
          const blobsFromStore2 = await blobStore2.getBlobs([
            helloWorldHash,
            testFiles.GRAPH_PNG_HASH,
          ])
          expect(blobsFromStore1.map(blob => blob.getHash())).to.deep.equal([
            helloWorldHash,
          ])
          expect(blobsFromStore2.map(blob => blob.getHash())).to.deep.equal([
            testFiles.GRAPH_PNG_HASH,
          ])
        })

        it('separates blobs when calling getStream()', async function () {
          await blobStore2.getStream(testFiles.GRAPH_PNG_HASH)
          try {
            await blobStore.getStream(testFiles.GRAPH_PNG_HASH)
          } catch (err) {
            expect(err).to.be.an.instanceof(Blob.NotFoundError)
            return
          }
          expect.fail(
            'expected Blob.NotFoundError when calling blobStore.getStream()'
          )
        })

        it('separates blobs when calling getString()', async function () {
          const content = await blobStore.getString(helloWorldHash)
          expect(content).to.equal(helloWorldString)
          try {
            await blobStore2.getString(helloWorldHash)
          } catch (err) {
            expect(err).to.be.an.instanceof(Blob.NotFoundError)
            return
          }
          expect.fail(
            'expected Blob.NotFoundError when calling blobStore.getStream()'
          )
        })

        if (scenario.backend !== mongoBackend) {
          // mongo backend has its own test for this, covering sharding
          it('getProjectBlobsBatch() returns blobs per project', async function () {
            const projects = [
              parseInt(scenario.projectId, 10),
              parseInt(scenario.projectId2, 10),
            ]
            const { nBlobs, blobs } =
              await postgresBackend.getProjectBlobsBatch(projects)
            expect(nBlobs).to.equal(2)
            expect(Object.fromEntries(blobs.entries())).to.deep.equal({
              [parseInt(scenario.projectId, 10)]: [
                new Blob(helloWorldHash, 11, 11),
              ],
              [parseInt(scenario.projectId2, 10)]: [
                new Blob(
                  testFiles.GRAPH_PNG_HASH,
                  testFiles.GRAPH_PNG_BYTE_LENGTH,
                  null
                ),
              ],
            })
          })
        }
      })

      describe('a global blob', function () {
        it('is available through getBlob()', async function () {
          const blob = await blobStore.getBlob(globalBlobHash)
          expect(blob.getHash()).to.equal(globalBlobHash)
        })

        it('is available through getBlobs()', async function () {
          await blobStore.putString(helloWorldString)
          const requestedHashes = [globalBlobHash, helloWorldHash]
          const blobs = await blobStore.getBlobs(requestedHashes)
          const hashes = blobs.map(blob => blob.getHash())
          expect(hashes).to.have.members(requestedHashes)
        })

        it('is available through getString()', async function () {
          const content = await blobStore.getString(globalBlobHash)
          expect(content).to.equal('a')
        })

        it('is available through getStream()', async function () {
          const stream = await blobStore.getStream(globalBlobHash)
          const buffer = await streams.readStreamToBuffer(stream)
          expect(buffer.toString()).to.equal(globalBlobString)
        })

        it("doesn't prevent putString() from adding the same blob", async function () {
          const blob = await blobStore.putString(globalBlobString)
          expect(blob.getHash()).to.equal(globalBlobHash)
          const projectBlob = await scenario.backend.findBlob(
            scenario.projectId,
            globalBlobHash
          )
          expect(projectBlob).not.to.exist
        })

        it("doesn't prevent putFile() from adding the same blob", async function () {
          const dir = await mkTmpDir('blobStore')
          const pathname = path.join(dir, 'blob.txt')
          fs.writeFileSync(pathname, globalBlobString)
          const blob = await blobStore.putFile(pathname)
          expect(blob.getHash()).to.equal(globalBlobHash)
          const projectBlob = await scenario.backend.findBlob(
            scenario.projectId,
            globalBlobHash
          )
          expect(projectBlob).not.to.exist
        })
      })

      describe('a demoted global blob', function () {
        it('is available through getBlob()', async function () {
          const blob = await blobStore.getBlob(demotedBlobHash)
          expect(blob.getHash()).to.equal(demotedBlobHash)
        })

        it('is available through getBlobs()', async function () {
          await blobStore.putString(helloWorldString)
          const requestedHashes = [demotedBlobHash, helloWorldHash]
          const blobs = await blobStore.getBlobs(requestedHashes)
          const hashes = blobs.map(blob => blob.getHash())
          expect(hashes).to.have.members(requestedHashes)
        })

        it('is available through getString()', async function () {
          const content = await blobStore.getString(demotedBlobHash)
          expect(content).to.equal(demotedBlobString)
        })

        it('is available through getStream()', async function () {
          const stream = await blobStore.getStream(demotedBlobHash)
          const buffer = await streams.readStreamToBuffer(stream)
          expect(buffer.toString()).to.equal(demotedBlobString)
        })

        it("doesn't prevent putString() from creating a project blob", async function () {
          const blob = await blobStore.putString(demotedBlobString)
          expect(blob.getHash()).to.equal(demotedBlobHash)
          const projectBlob = await scenario.backend.findBlob(
            scenario.projectId,
            demotedBlobHash
          )
          expect(projectBlob).to.exist
        })

        it("doesn't prevent putFile() from creating a project blob", async function () {
          const dir = await mkTmpDir('blobStore')
          const pathname = path.join(dir, 'blob.txt')
          fs.writeFileSync(pathname, demotedBlobString)
          const blob = await blobStore.putFile(pathname)
          expect(blob.getHash()).to.equal(demotedBlobHash)
          const projectBlob = await scenario.backend.findBlob(
            scenario.projectId,
            demotedBlobHash
          )
          expect(projectBlob).to.exist
        })
      })

      describe('deleting blobs', async function () {
        beforeEach('install a project blob', async function () {
          await blobStore.putString(helloWorldString)
          const blob = await blobStore.getBlob(helloWorldHash)
          expect(blob).to.exist
        })

        beforeEach('delete project blobs', async function () {
          await blobStore.deleteBlobs()
        })

        it('deletes project blobs', async function () {
          try {
            await blobStore.getString(helloWorldHash)
            expect.fail('expected NotFoundError')
          } catch (err) {
            expect(err).to.be.an.instanceof(Blob.NotFoundError)
          }
        })

        it('retains global blobs', async function () {
          const content = await blobStore.getString(globalBlobHash)
          expect(content).to.equal(globalBlobString)
        })
      })

      describe('copyBlob method', function () {
        it('copies a binary blob to another project in the same backend', async function () {
          const testFile = 'graph.png'
          const originalHash = testFiles.GRAPH_PNG_HASH
          const insertedBlob = await blobStore.putFile(testFiles.path(testFile))
          await blobStore.copyBlob(insertedBlob, scenario.projectId2)
          const copiedBlob = await blobStore2.getBlob(originalHash)
          expect(copiedBlob.getHash()).to.equal(originalHash)
          expect(copiedBlob.getByteLength()).to.equal(
            insertedBlob.getByteLength()
          )
          expect(copiedBlob.getStringLength()).to.be.null
        })

        it('copies a text blob to another project in the same backend', async function () {
          const insertedBlob = await blobStore.putString(helloWorldString)
          await blobStore.copyBlob(insertedBlob, scenario.projectId2)
          const copiedBlob = await blobStore2.getBlob(helloWorldHash)
          expect(copiedBlob.getHash()).to.equal(helloWorldHash)
          const content = await blobStore2.getString(helloWorldHash)
          expect(content).to.equal(helloWorldString)
        })
      })

      describe('copyBlob method with different backends', function () {
        const otherScenario = scenarios.find(
          s => s.backend !== scenario.backend
        )
        const otherBlobStore = new BlobStore(otherScenario.projectId2)

        beforeEach(async function () {
          await otherBlobStore.initialize()
        })

        it('copies a binary blob to another project in a different backend', async function () {
          const testFile = 'graph.png'
          const originalHash = testFiles.GRAPH_PNG_HASH
          const insertedBlob = await blobStore.putFile(testFiles.path(testFile))
          await blobStore.copyBlob(insertedBlob, otherScenario.projectId2)
          const copiedBlob = await otherBlobStore.getBlob(originalHash)
          expect(copiedBlob).to.exist
          expect(copiedBlob.getHash()).to.equal(originalHash)
          expect(copiedBlob.getByteLength()).to.equal(
            insertedBlob.getByteLength()
          )
          expect(copiedBlob.getStringLength()).to.be.null
        })

        it('copies a text blob to another project in a different backend', async function () {
          const insertedBlob = await blobStore.putString(helloWorldString)
          await blobStore.copyBlob(insertedBlob, otherScenario.projectId2)
          const copiedBlob = await otherBlobStore.getBlob(helloWorldHash)
          expect(copiedBlob).to.exist
          expect(copiedBlob.getHash()).to.equal(helloWorldHash)
          const content = await otherBlobStore.getString(helloWorldHash)
          expect(content).to.equal(helloWorldString)
        })
      })
    })
  }

  it('getProjectBlobsBatch() with mixed projects', async function () {
    for (const scenario of scenarios) {
      const blobStore = new BlobStore(scenario.projectId)
      const blobStore2 = new BlobStore(scenario.projectId2)
      await blobStore.initialize()
      await blobStore.putString(helloWorldString)
      await blobStore2.initialize()
      await blobStore2.putFile(testFiles.path('graph.png'))
    }

    const projects = [
      parseInt(scenarios[0].projectId, 10),
      scenarios[1].projectId,
      parseInt(scenarios[0].projectId2, 10),
      scenarios[1].projectId2,
    ]
    const { nBlobs, blobs } = await getProjectBlobsBatch(projects)
    expect(nBlobs).to.equal(4)
    expect(Object.fromEntries(blobs.entries())).to.deep.equal({
      [scenarios[0].projectId]: [new Blob(helloWorldHash, 11, 11)],
      [scenarios[1].projectId]: [new Blob(helloWorldHash, 11, 11)],
      [scenarios[0].projectId2]: [
        new Blob(
          testFiles.GRAPH_PNG_HASH,
          testFiles.GRAPH_PNG_BYTE_LENGTH,
          null
        ),
      ],
      [scenarios[1].projectId2]: [
        new Blob(
          testFiles.GRAPH_PNG_HASH,
          testFiles.GRAPH_PNG_BYTE_LENGTH,
          null
        ),
      ],
    })
  })
})
