'use strict'

const cleanup = require('./support/cleanup')
const fixtures = require('./support/fixtures')
const { expect } = require('chai')
const sinon = require('sinon')
const { ObjectId } = require('mongodb')
const { projects } = require('../../../../storage/lib/mongodb')
const {
  ChunkVersionConflictError,
  VersionNotFoundError,
} = require('../../../../storage/lib/chunk_store/errors')

const {
  Chunk,
  Snapshot,
  Change,
  History,
  File,
  Operation,
  AddFileOperation,
  EditFileOperation,
  TextOperation,
} = require('overleaf-editor-core')
const { chunkStore, historyStore, BlobStore } = require('../../../../storage')
const redisBackend = require('../../../../storage/lib/chunk_store/redis')

describe('chunkStore', function () {
  beforeEach(cleanup.everything)
  beforeEach(fixtures.create)

  const scenarios = [
    {
      description: 'Postgres backend',
      createProject: chunkStore.initializeProject,
      idMapping: id => parseInt(id, 10),
    },
    {
      description: 'Mongo backend',
      createProject: () =>
        chunkStore.initializeProject(new ObjectId().toString()),
      idMapping: id => id,
    },
  ]

  for (const scenario of scenarios) {
    describe(scenario.description, function () {
      let projectId
      let projectRecord
      let blobStore

      beforeEach(async function () {
        projectId = await scenario.createProject()
        // create a record in the mongo projects collection
        projectRecord = await projects.insertOne({
          overleaf: { history: { id: scenario.idMapping(projectId) } },
        })
        blobStore = new BlobStore(projectId)
      })

      it('loads empty latest chunk for a new project', async function () {
        const chunk = await chunkStore.loadLatest(projectId)
        expect(chunk.getSnapshot().countFiles()).to.equal(0)
        expect(chunk.getChanges().length).to.equal(0)
        expect(chunk.getEndTimestamp()).not.to.exist
      })

      describe('creating a chunk', async function () {
        const pendingChangeTimestamp = new Date('2014-01-01T00:00:00')
        const lastChangeTimestamp = new Date('2015-01-01T00:00:00')
        beforeEach(async function () {
          const blob = await blobStore.putString('abc')
          const firstChunk = makeChunk(
            [
              makeChange(
                Operation.addFile('main.tex', File.createLazyFromBlobs(blob)),
                lastChangeTimestamp
              ),
            ],
            0
          )
          await chunkStore.update(projectId, firstChunk, pendingChangeTimestamp)

          const secondChunk = makeChunk(
            [
              makeChange(
                Operation.addFile('other.tex', File.createLazyFromBlobs(blob)),
                lastChangeTimestamp
              ),
            ],
            1
          )
          await chunkStore.create(
            projectId,
            secondChunk,
            pendingChangeTimestamp
          )
        })

        it('creates a chunk and inserts the pending change timestamp', async function () {
          const project = await projects.findOne({
            _id: new ObjectId(projectRecord.insertedId),
          })
          expect(project.overleaf.history.currentEndVersion).to.equal(2)
          expect(project.overleaf.history.currentEndTimestamp).to.deep.equal(
            lastChangeTimestamp
          )
          expect(project.overleaf.backup.pendingChangeAt).to.deep.equal(
            pendingChangeTimestamp
          )
        })
      })

      describe('adding and editing a blank file', function () {
        const testPathname = 'foo.txt'
        const testTextOperation = TextOperation.fromJSON({
          textOperation: ['a'],
        }) // insert an a
        let lastChangeTimestamp
        const pendingChangeTimestamp = new Date()

        beforeEach(async function () {
          const chunk = await chunkStore.loadLatest(projectId)
          const blob = await blobStore.putString('')
          const changes = [
            makeChange(
              Operation.addFile(testPathname, File.createLazyFromBlobs(blob))
            ),
            makeChange(Operation.editFile(testPathname, testTextOperation)),
          ]
          lastChangeTimestamp = changes[1].getTimestamp()
          chunk.pushChanges(changes)
          await chunkStore.update(projectId, chunk, pendingChangeTimestamp)
        })

        it('records the correct metadata in db readOnly=false', async function () {
          const chunkMetadata =
            await chunkStore.getLatestChunkMetadata(projectId)
          expect(chunkMetadata).to.deep.include({
            startVersion: 0,
            endVersion: 2,
            endTimestamp: lastChangeTimestamp,
          })
        })

        it('records the correct metadata in db readOnly=true', async function () {
          const chunkMetadata = await chunkStore.getLatestChunkMetadata(
            projectId,
            { readOnly: true }
          )
          expect(chunkMetadata).to.deep.include({
            startVersion: 0,
            endVersion: 2,
            endTimestamp: lastChangeTimestamp,
          })
        })

        it('records the correct timestamp', async function () {
          const chunk = await chunkStore.loadLatest(projectId)
          expect(chunk.getEndTimestamp()).to.deep.equal(lastChangeTimestamp)
        })

        it('records changes', async function () {
          const chunk = await chunkStore.loadLatest(projectId)
          const history = chunk.getHistory()
          expect(history.getSnapshot().countFiles()).to.equal(0)
          expect(history.getChanges().length).to.equal(2)
          const addChange = history.getChanges()[0]
          expect(addChange.getOperations().length).to.equal(1)
          const addFile = addChange.getOperations()[0]
          expect(addFile).to.be.an.instanceof(AddFileOperation)
          expect(addFile.getPathname()).to.equal(testPathname)
          const file = addFile.getFile()
          expect(file.getHash()).to.equal(File.EMPTY_FILE_HASH)
          expect(file.getByteLength()).to.equal(0)
          expect(file.getStringLength()).to.equal(0)
          const editChange = history.getChanges()[1]
          expect(editChange.getOperations().length).to.equal(1)
          const editFile = editChange.getOperations()[0]
          expect(editFile).to.be.an.instanceof(EditFileOperation)
          expect(editFile.getPathname()).to.equal(testPathname)
        })

        it('updates the project record with the current version and timestamps', async function () {
          const project = await projects.findOne({
            _id: new ObjectId(projectRecord.insertedId),
          })
          expect(project.overleaf.history.currentEndVersion).to.equal(2)
          expect(project.overleaf.history.currentEndTimestamp).to.deep.equal(
            lastChangeTimestamp
          )
          expect(project.overleaf.backup.pendingChangeAt).to.deep.equal(
            pendingChangeTimestamp
          )
        })
      })

      describe('multiple chunks', async function () {
        // Two chunks are 1 year apart
        const pendingChangeTimestamp = new Date('2014-01-01T00:00:00')
        const firstChunkTimestamp = new Date('2015-01-01T00:00:00')
        const secondChunkTimestamp = new Date('2016-01-01T00:00:00')
        const thirdChunkTimestamp = new Date('2017-01-01T00:00:00')
        let firstChunk, secondChunk, thirdChunk

        beforeEach(async function () {
          const blob = await blobStore.putString('')
          firstChunk = makeChunk(
            [
              makeChange(
                Operation.addFile('foo.tex', File.createLazyFromBlobs(blob)),
                new Date(firstChunkTimestamp - 5000)
              ),
              makeChange(
                Operation.addFile('bar.tex', File.createLazyFromBlobs(blob)),
                firstChunkTimestamp
              ),
            ],
            0
          )
          await chunkStore.update(projectId, firstChunk, pendingChangeTimestamp)
          firstChunk = await chunkStore.loadLatest(projectId)

          secondChunk = makeChunk(
            [
              makeChange(
                Operation.addFile('baz.tex', File.createLazyFromBlobs(blob)),
                new Date(secondChunkTimestamp - 5000)
              ),
              makeChange(
                Operation.addFile('qux.tex', File.createLazyFromBlobs(blob)),
                secondChunkTimestamp
              ),
            ],
            2
          )
          await chunkStore.create(projectId, secondChunk)
          secondChunk = await chunkStore.loadLatest(projectId)

          thirdChunk = makeChunk(
            [
              makeChange(
                Operation.addFile('quux.tex', File.createLazyFromBlobs(blob)),
                thirdChunkTimestamp
              ),
              makeChange(
                Operation.addFile('barbar.tex', File.createLazyFromBlobs(blob)),
                thirdChunkTimestamp
              ),
            ],
            4
          )
          await chunkStore.create(projectId, thirdChunk)
          thirdChunk = await chunkStore.loadLatest(projectId)
        })

        it('returns the second chunk when querying for a version between the start and end version', async function () {
          const chunk = await chunkStore.loadAtVersion(projectId, 3)
          expect(chunk).to.deep.equal(secondChunk)

          // Check file lazy loading
          const history = chunk.getHistory()
          expect(history.getSnapshot().countFiles()).to.equal(0)
          expect(history.getChanges().length).to.equal(2)

          const change = history.getChanges()[0]
          expect(change.getOperations().length).to.equal(1)

          const addFile = change.getOperations()[0]
          expect(addFile).to.be.an.instanceof(AddFileOperation)
          expect(addFile.getPathname()).to.equal('baz.tex')

          const file = addFile.getFile()
          expect(file.getHash()).to.equal(File.EMPTY_FILE_HASH)
          expect(file.getByteLength()).to.equal(0)
          expect(file.getStringLength()).to.equal(0)
        })

        it('returns the first chunk when querying for the end version of the chunk', async function () {
          const chunk = await chunkStore.loadAtVersion(projectId, 2)
          expect(chunk).to.deep.equal(firstChunk)
        })

        it('returns the second chunk when querying for a timestamp between the second and third chunk', async function () {
          const searchTimestamp = new Date('2015-07-01T00:00:00')
          const chunk = await chunkStore.loadAtTimestamp(
            projectId,
            searchTimestamp
          )
          expect(chunk).to.deep.equal(secondChunk)

          // Check file lazy loading
          const history = chunk.getHistory()
          expect(history.getSnapshot().countFiles()).to.equal(0)
          expect(history.getChanges().length).to.equal(2)

          const change = history.getChanges()[0]
          expect(change.getOperations().length).to.equal(1)

          const addFile = change.getOperations()[0]
          expect(addFile).to.be.an.instanceof(AddFileOperation)
          expect(addFile.getPathname()).to.equal('baz.tex')

          const file = addFile.getFile()
          expect(file.getHash()).to.equal(File.EMPTY_FILE_HASH)
          expect(file.getByteLength()).to.equal(0)
          expect(file.getStringLength()).to.equal(0)
        })

        it('returns the third chunk when querying for a timestamp past the latest chunk', async function () {
          const searchTimestampPastLatestChunk = new Date('2018-01-01T00:00:00')
          const chunk = await chunkStore.loadAtTimestamp(
            projectId,
            searchTimestampPastLatestChunk
          )
          // Check that we found the third chunk
          expect(chunk).to.deep.equal(thirdChunk)
        })

        it('updates the project record to match the last chunk', async function () {
          const project = await projects.findOne({
            _id: new ObjectId(projectRecord.insertedId),
          })
          expect(project.overleaf.history.currentEndVersion).to.equal(6)
          expect(project.overleaf.history.currentEndTimestamp).to.deep.equal(
            thirdChunkTimestamp
          )
        })

        it('updates the pending change timestamp to match the first chunk', async function () {
          const project = await projects.findOne({
            _id: new ObjectId(projectRecord.insertedId),
          })
          expect(project.overleaf.backup.pendingChangeAt).to.deep.equal(
            pendingChangeTimestamp
          )
        })

        describe('chunk update', function () {
          it('rejects a chunk that removes changes', async function () {
            const newChunk = makeChunk([thirdChunk.getChanges()[0]], 4)
            await expect(
              chunkStore.update(projectId, newChunk)
            ).to.be.rejectedWith(ChunkVersionConflictError)
            const latestChunk = await chunkStore.loadLatest(projectId)
            expect(latestChunk.toRaw()).to.deep.equal(thirdChunk.toRaw())
          })

          it('accepts the same chunk', async function () {
            await chunkStore.update(projectId, thirdChunk)
            const latestChunk = await chunkStore.loadLatest(projectId)
            expect(latestChunk.toRaw()).to.deep.equal(thirdChunk.toRaw())
          })

          it('accepts a larger chunk', async function () {
            const blob = await blobStore.putString('foobar')
            const newChunk = makeChunk(
              [
                ...thirdChunk.getChanges(),
                makeChange(
                  Operation.addFile(
                    'onemore.tex',
                    File.createLazyFromBlobs(blob)
                  ),
                  thirdChunkTimestamp
                ),
              ],
              4
            )
            await chunkStore.update(projectId, newChunk)
            const latestChunk = await chunkStore.loadLatest(projectId)
            expect(latestChunk.toRaw()).to.deep.equal(newChunk.toRaw())
          })
        })

        describe('chunk create', function () {
          let change

          beforeEach(async function () {
            const blob = await blobStore.putString('foobar')
            change = makeChange(
              Operation.addFile('onemore.tex', File.createLazyFromBlobs(blob)),
              thirdChunkTimestamp
            )
          })

          it('rejects a base version that is too low', async function () {
            const newChunk = makeChunk([change], 5)
            await expect(
              chunkStore.create(projectId, newChunk)
            ).to.be.rejectedWith(ChunkVersionConflictError)
            const latestChunk = await chunkStore.loadLatest(projectId)
            expect(latestChunk.toRaw()).to.deep.equal(thirdChunk.toRaw())
          })

          it('rejects a base version that is too high', async function () {
            const newChunk = makeChunk([change], 7)
            await expect(
              chunkStore.create(projectId, newChunk)
            ).to.be.rejectedWith(VersionNotFoundError)
            const latestChunk = await chunkStore.loadLatest(projectId)
            expect(latestChunk.toRaw()).to.deep.equal(thirdChunk.toRaw())
          })

          it('accepts the right base version', async function () {
            const newChunk = makeChunk([change], 6)
            await chunkStore.create(projectId, newChunk)
            const latestChunk = await chunkStore.loadLatest(projectId)
            expect(latestChunk.toRaw()).to.deep.equal(newChunk.toRaw())
          })
        })

        describe('after updating the last chunk', function () {
          let newChunk

          beforeEach(async function () {
            const blob = await blobStore.putString('')
            newChunk = makeChunk(
              [
                ...thirdChunk.getChanges(),
                makeChange(
                  Operation.addFile(
                    'onemore.tex',
                    File.createLazyFromBlobs(blob)
                  ),
                  thirdChunkTimestamp
                ),
              ],
              4
            )
            await chunkStore.update(projectId, newChunk)
            newChunk = await chunkStore.loadLatest(projectId)
          })

          it('replaces the latest chunk', function () {
            expect(newChunk.getChanges()).to.have.length(3)
          })

          it('returns the right chunk when querying by version', async function () {
            const chunk = await chunkStore.loadAtVersion(projectId, 5)
            expect(chunk).to.deep.equal(newChunk)
          })

          it('returns the right chunk when querying by timestamp', async function () {
            const chunk = await chunkStore.loadAtTimestamp(
              projectId,
              thirdChunkTimestamp
            )
            expect(chunk).to.deep.equal(newChunk)
          })

          it('updates the project record to match the latest version and timestamp', async function () {
            const project = await projects.findOne({
              _id: new ObjectId(projectRecord.insertedId),
            })
            expect(project.overleaf.history.currentEndVersion).to.equal(7)
            expect(project.overleaf.history.currentEndTimestamp).to.deep.equal(
              thirdChunkTimestamp
            )
          })

          it('does not modify the existing pending change timestamp in the project record', async function () {
            const project = await projects.findOne({
              _id: new ObjectId(projectRecord.insertedId),
            })
            expect(project.overleaf.backup.pendingChangeAt).to.deep.equal(
              pendingChangeTimestamp
            )
          })
        })

        describe('with changes queued in the Redis buffer', function () {
          let queuedChanges
          const firstQueuedChangeTimestamp = new Date('2017-01-01T00:01:00')
          const lastQueuedChangeTimestamp = new Date('2017-01-01T00:02:00')

          beforeEach(async function () {
            const snapshot = thirdChunk.getSnapshot()
            snapshot.applyAll(thirdChunk.getChanges())
            const blob = await blobStore.putString('zzz')
            queuedChanges = [
              makeChange(
                Operation.addFile(
                  'in-redis.tex',
                  File.createLazyFromBlobs(blob)
                ),
                firstQueuedChangeTimestamp
              ),
              makeChange(
                // Add a second change to make the buffer more interesting
                Operation.editFile(
                  'in-redis.tex',
                  TextOperation.fromJSON({ textOperation: ['hello'] })
                ),
                lastQueuedChangeTimestamp
              ),
            ]
            await redisBackend.queueChanges(
              projectId,
              snapshot,
              thirdChunk.getEndVersion(),
              queuedChanges
            )
          })

          it('includes the queued changes when getting the latest chunk', async function () {
            const chunk = await chunkStore.loadLatest(projectId)
            const expectedChanges = thirdChunk
              .getChanges()
              .concat(queuedChanges)
            expect(chunk.getChanges()).to.deep.equal(expectedChanges)
            expect(chunk.getStartVersion()).to.equal(
              thirdChunk.getStartVersion()
            )
            expect(chunk.getEndVersion()).to.equal(
              thirdChunk.getEndVersion() + queuedChanges.length
            )
            expect(chunk.getEndTimestamp()).to.deep.equal(
              lastQueuedChangeTimestamp
            )
          })

          it('includes the queued changes when getting the latest chunk by timestamp', async function () {
            const chunk = await chunkStore.loadAtTimestamp(
              projectId,
              thirdChunkTimestamp
            )
            const expectedChanges = thirdChunk
              .getChanges()
              .concat(queuedChanges)
            expect(chunk.getChanges()).to.deep.equal(expectedChanges)
            expect(chunk.getStartVersion()).to.equal(
              thirdChunk.getStartVersion()
            )
            expect(chunk.getEndVersion()).to.equal(
              thirdChunk.getEndVersion() + queuedChanges.length
            )
          })

          it("doesn't include the queued changes when getting another chunk by timestamp", async function () {
            const chunk = await chunkStore.loadAtTimestamp(
              projectId,
              secondChunkTimestamp
            )
            const expectedChanges = secondChunk.getChanges()
            expect(chunk.getChanges()).to.deep.equal(expectedChanges)
            expect(chunk.getStartVersion()).to.equal(
              secondChunk.getStartVersion()
            )
            expect(chunk.getEndVersion()).to.equal(secondChunk.getEndVersion())
            expect(chunk.getEndTimestamp()).to.deep.equal(secondChunkTimestamp)
          })

          it('includes the queued changes when getting the latest chunk by version', async function () {
            const chunk = await chunkStore.loadAtVersion(
              projectId,
              thirdChunk.getEndVersion()
            )
            const expectedChanges = thirdChunk
              .getChanges()
              .concat(queuedChanges)
            expect(chunk.getChanges()).to.deep.equal(expectedChanges)
            expect(chunk.getStartVersion()).to.equal(
              thirdChunk.getStartVersion()
            )
            expect(chunk.getEndVersion()).to.equal(
              thirdChunk.getEndVersion() + queuedChanges.length
            )
            expect(chunk.getEndTimestamp()).to.deep.equal(
              lastQueuedChangeTimestamp
            )
          })

          it("doesn't include the queued changes when getting another chunk by version", async function () {
            const chunk = await chunkStore.loadAtVersion(
              projectId,
              secondChunk.getEndVersion()
            )
            const expectedChanges = secondChunk.getChanges()
            expect(chunk.getChanges()).to.deep.equal(expectedChanges)
            expect(chunk.getStartVersion()).to.equal(
              secondChunk.getStartVersion()
            )
            expect(chunk.getEndVersion()).to.equal(secondChunk.getEndVersion())
            expect(chunk.getEndTimestamp()).to.deep.equal(secondChunkTimestamp)
          })

          it('loads a version that is only in the Redis buffer', async function () {
            const versionInRedis = thirdChunk.getEndVersion() + 1 // the first change in Redis
            const chunk = await chunkStore.loadAtVersion(
              projectId,
              versionInRedis
            )
            // The chunk should contain changes from the thirdChunk and the queuedChanges
            const expectedChanges = thirdChunk
              .getChanges()
              .concat(queuedChanges)
            expect(chunk.getChanges()).to.deep.equal(expectedChanges)
            expect(chunk.getStartVersion()).to.equal(
              thirdChunk.getStartVersion()
            )
            expect(chunk.getEndVersion()).to.equal(
              thirdChunk.getEndVersion() + queuedChanges.length
            )
            expect(chunk.getEndTimestamp()).to.deep.equal(
              lastQueuedChangeTimestamp
            )
          })

          it('throws an error when loading a version beyond the Redis buffer', async function () {
            const versionBeyondRedis =
              thirdChunk.getEndVersion() + queuedChanges.length + 1
            await expect(
              chunkStore.loadAtVersion(projectId, versionBeyondRedis)
            )
              .to.be.rejectedWith(chunkStore.VersionOutOfBoundsError)
              .and.eventually.satisfy(err => {
                expect(err.info).to.have.property('projectId', projectId)
                expect(err.info).to.have.property('version', versionBeyondRedis)
                return true
              })
          })
        })

        describe('when iterating the chunks with getProjectChunksFromVersion', function () {
          // The first chunk has startVersion:0 and endVersion:2
          for (let startVersion = 0; startVersion <= 2; startVersion++) {
            it(`returns all chunk records when starting from version ${startVersion}`, async function () {
              const chunkRecords = []
              for await (const chunk of chunkStore.getProjectChunksFromVersion(
                projectId,
                startVersion
              )) {
                chunkRecords.push(chunk)
              }
              const expectedChunks = [firstChunk, secondChunk, thirdChunk]
              expect(chunkRecords).to.have.length(expectedChunks.length)
              chunkRecords.forEach((chunkRecord, index) => {
                expect(chunkRecord.startVersion).to.deep.equal(
                  expectedChunks[index].getStartVersion()
                )
                expect(chunkRecord.endVersion).to.deep.equal(
                  expectedChunks[index].getEndVersion()
                )
              })
            })
          }

          // The second chunk has startVersion:2 and endVersion:4
          for (let startVersion = 3; startVersion <= 4; startVersion++) {
            it(`returns two chunk records when starting from version ${startVersion}`, async function () {
              const chunkRecords = []
              for await (const chunk of chunkStore.getProjectChunksFromVersion(
                projectId,
                startVersion
              )) {
                chunkRecords.push(chunk)
              }
              const expectedChunks = [secondChunk, thirdChunk]
              expect(chunkRecords).to.have.length(expectedChunks.length)
              chunkRecords.forEach((chunkRecord, index) => {
                expect(chunkRecord.startVersion).to.deep.equal(
                  expectedChunks[index].getStartVersion()
                )
                expect(chunkRecord.endVersion).to.deep.equal(
                  expectedChunks[index].getEndVersion()
                )
              })
            })
          }

          // The third chunk has startVersion:4 and endVersion:5
          for (let startVersion = 5; startVersion <= 5; startVersion++) {
            it(`returns one chunk record when starting from version ${startVersion}`, async function () {
              const chunkRecords = []
              for await (const chunk of chunkStore.getProjectChunksFromVersion(
                projectId,
                startVersion
              )) {
                chunkRecords.push(chunk)
              }
              const expectedChunks = [thirdChunk]
              expect(chunkRecords).to.have.length(expectedChunks.length)
              chunkRecords.forEach((chunkRecord, index) => {
                expect(chunkRecord.startVersion).to.deep.equal(
                  expectedChunks[index].getStartVersion()
                )
                expect(chunkRecord.endVersion).to.deep.equal(
                  expectedChunks[index].getEndVersion()
                )
              })
            })
          }

          it('returns no chunk records when starting from a version after the last chunk', async function () {
            const chunkRecords = []
            for await (const chunk of chunkStore.getProjectChunksFromVersion(
              projectId,
              7
            )) {
              chunkRecords.push(chunk)
            }
            expect(chunkRecords).to.have.length(0)
          })
        })
      })

      describe('when saving to object storage fails', function () {
        beforeEach(function () {
          sinon.stub(historyStore, 'storeRaw').rejects(new Error('S3 Error'))
        })

        afterEach(function () {
          historyStore.storeRaw.restore()
        })

        it('does not create chunks', async function () {
          const oldEndVersion = 0
          const testPathname = 'foo.txt'
          const testTextOperation = TextOperation.fromJSON({
            textOperation: ['a'],
          }) // insert an a

          let chunk = await chunkStore.loadLatest(projectId)
          expect(chunk.getEndVersion()).to.equal(oldEndVersion)

          const blob = await blobStore.putString('')
          const changes = [
            makeChange(
              Operation.addFile(testPathname, File.createLazyFromBlobs(blob))
            ),
            makeChange(Operation.editFile(testPathname, testTextOperation)),
          ]
          chunk.pushChanges(changes)

          await expect(chunkStore.update(projectId, chunk)).to.be.rejectedWith(
            'S3 Error'
          )
          chunk = await chunkStore.loadLatest(projectId)
          expect(chunk.getEndVersion()).to.equal(oldEndVersion)
        })
      })

      describe('getChangesSinceVersion', function () {
        describe('single chunk scenarios', function () {
          let singleChunk

          beforeEach(async function () {
            // Create a single chunk with start version 0, end version 2
            const blob = await blobStore.putString('single chunk content')
            singleChunk = makeChunk(
              [
                makeChange(
                  Operation.addFile(
                    'file1.tex',
                    File.createLazyFromBlobs(blob)
                  ),
                  new Date('2020-01-01T00:00:00')
                ),
                makeChange(
                  Operation.addFile(
                    'file2.tex',
                    File.createLazyFromBlobs(blob)
                  ),
                  new Date('2020-01-01T00:01:00')
                ),
              ],
              0
            )
            await chunkStore.update(projectId, singleChunk)
            singleChunk = await chunkStore.loadLatest(projectId)
          })

          describe('without Redis changes', function () {
            it('returns empty changes when since equals latest version', async function () {
              const result = await chunkStore.getChangesSinceVersion(
                projectId,
                2
              )
              expect(result.changes).to.have.length(0)
              expect(result.hasMore).to.be.false
            })

            it('returns all changes when since is 0', async function () {
              const result = await chunkStore.getChangesSinceVersion(
                projectId,
                0
              )
              expect(result.changes).to.have.length(2)
              expect(result.hasMore).to.be.false
              expect(result.changes).to.deep.equal(singleChunk.getChanges())
            })

            it('returns subset of changes when since is 1', async function () {
              const result = await chunkStore.getChangesSinceVersion(
                projectId,
                1
              )
              expect(result.changes).to.have.length(1)
              expect(result.hasMore).to.be.false
              expect(result.changes).to.deep.equal([
                singleChunk.getChanges()[1],
              ])
            })

            it('throws error when since is negative', async function () {
              await expect(
                chunkStore.getChangesSinceVersion(projectId, -1)
              ).to.be.rejectedWith(VersionNotFoundError)
            })

            it('throws VersionNotFoundError when since is beyond latest version', async function () {
              await expect(
                chunkStore.getChangesSinceVersion(projectId, 10)
              ).to.be.rejectedWith(VersionNotFoundError)
            })
          })

          describe('with Redis changes', function () {
            let queuedChanges

            beforeEach(async function () {
              const snapshot = singleChunk.getSnapshot()
              snapshot.applyAll(singleChunk.getChanges())
              const blob = await blobStore.putString('redis content')
              queuedChanges = [
                makeChange(
                  Operation.addFile(
                    'redis1.tex',
                    File.createLazyFromBlobs(blob)
                  ),
                  new Date('2020-01-01T00:02:00')
                ),
                makeChange(
                  Operation.addFile(
                    'redis2.tex',
                    File.createLazyFromBlobs(blob)
                  ),
                  new Date('2020-01-01T00:03:00')
                ),
              ]
              await redisBackend.queueChanges(
                projectId,
                snapshot,
                singleChunk.getEndVersion(),
                queuedChanges
              )
            })

            it('returns Redis changes when since equals chunk end version', async function () {
              const result = await chunkStore.getChangesSinceVersion(
                projectId,
                2
              )
              expect(result.changes).to.have.length(2)
              expect(result.hasMore).to.be.false
              expect(result.changes).to.deep.equal(queuedChanges)
            })

            it('returns partial Redis changes when since is within Redis buffer', async function () {
              const result = await chunkStore.getChangesSinceVersion(
                projectId,
                3
              )
              expect(result.changes).to.have.length(1)
              expect(result.hasMore).to.be.false
              expect(result.changes).to.deep.equal([queuedChanges[1]])
            })

            it('returns chunk changes plus Redis changes when since is within chunk', async function () {
              const result = await chunkStore.getChangesSinceVersion(
                projectId,
                1
              )
              expect(result.changes).to.have.length(3)
              expect(result.hasMore).to.be.false
              // Should contain the second chunk change plus Redis changes
              const expectedChanges = [singleChunk.getChanges()[1]].concat(
                queuedChanges
              )
              expect(result.changes).to.deep.equal(expectedChanges)
            })

            it('returns empty changes when since equals current head version', async function () {
              const result = await chunkStore.getChangesSinceVersion(
                projectId,
                4
              )
              expect(result.changes).to.have.length(0)
              expect(result.hasMore).to.be.false
            })
          })
        })

        describe('multiple chunks scenarios', function () {
          let firstChunk, secondChunk, thirdChunk

          beforeEach(async function () {
            // Reuse the existing multiple chunks setup
            const blob = await blobStore.putString('')
            firstChunk = makeChunk(
              [
                makeChange(
                  Operation.addFile('foo.tex', File.createLazyFromBlobs(blob)),
                  new Date('2015-01-01T00:00:00')
                ),
                makeChange(
                  Operation.addFile('bar.tex', File.createLazyFromBlobs(blob)),
                  new Date('2015-01-01T00:01:00')
                ),
              ],
              0
            )
            await chunkStore.update(projectId, firstChunk)

            secondChunk = makeChunk(
              [
                makeChange(
                  Operation.addFile('baz.tex', File.createLazyFromBlobs(blob)),
                  new Date('2016-01-01T00:00:00')
                ),
                makeChange(
                  Operation.addFile('qux.tex', File.createLazyFromBlobs(blob)),
                  new Date('2016-01-01T00:01:00')
                ),
              ],
              2
            )
            await chunkStore.create(projectId, secondChunk)

            thirdChunk = makeChunk(
              [
                makeChange(
                  Operation.addFile('quux.tex', File.createLazyFromBlobs(blob)),
                  new Date('2017-01-01T00:00:00')
                ),
                makeChange(
                  Operation.addFile(
                    'barbar.tex',
                    File.createLazyFromBlobs(blob)
                  ),
                  new Date('2017-01-01T00:01:00')
                ),
              ],
              4
            )
            await chunkStore.create(projectId, thirdChunk)

            // Load the actual chunks for comparison
            firstChunk = await chunkStore.loadAtVersion(projectId, 1)
            secondChunk = await chunkStore.loadAtVersion(projectId, 3)
            thirdChunk = await chunkStore.loadAtVersion(projectId, 5)
          })

          describe('without Redis changes', function () {
            it('returns changes from first chunk when since is 0', async function () {
              const result = await chunkStore.getChangesSinceVersion(
                projectId,
                0
              )
              expect(result.changes).to.have.length(2)
              expect(result.hasMore).to.be.true
              expect(result.changes).to.deep.equal(firstChunk.getChanges())
            })

            it('returns changes from second chunk when since is 2', async function () {
              const result = await chunkStore.getChangesSinceVersion(
                projectId,
                2
              )
              expect(result.changes).to.have.length(2)
              expect(result.hasMore).to.be.true
              expect(result.changes).to.deep.equal(secondChunk.getChanges())
            })

            it('returns partial changes from second chunk when since is 3', async function () {
              const result = await chunkStore.getChangesSinceVersion(
                projectId,
                3
              )
              expect(result.changes).to.have.length(1)
              expect(result.hasMore).to.be.true
              expect(result.changes).to.deep.equal([
                secondChunk.getChanges()[1],
              ])
            })

            it('returns changes from third chunk when since is 4', async function () {
              const result = await chunkStore.getChangesSinceVersion(
                projectId,
                4
              )
              expect(result.changes).to.have.length(2)
              expect(result.hasMore).to.be.false
              expect(result.changes).to.deep.equal(thirdChunk.getChanges())
            })

            it('returns empty changes when since equals final version', async function () {
              const result = await chunkStore.getChangesSinceVersion(
                projectId,
                6
              )
              expect(result.changes).to.have.length(0)
              expect(result.hasMore).to.be.false
            })

            it('returns partial changes from third chunk when since is 5', async function () {
              const result = await chunkStore.getChangesSinceVersion(
                projectId,
                5
              )
              expect(result.changes).to.have.length(1)
              expect(result.hasMore).to.be.false
              expect(result.changes).to.deep.equal([thirdChunk.getChanges()[1]])
            })
          })

          describe('with Redis changes', function () {
            let queuedChanges

            beforeEach(async function () {
              // Add Redis changes after the third chunk
              const latestChunk = await chunkStore.loadLatest(projectId)
              const snapshot = latestChunk.getSnapshot()
              snapshot.applyAll(latestChunk.getChanges())
              const blob = await blobStore.putString('redis multi content')
              queuedChanges = [
                makeChange(
                  Operation.addFile(
                    'redis-multi1.tex',
                    File.createLazyFromBlobs(blob)
                  ),
                  new Date('2017-01-01T00:02:00')
                ),
                makeChange(
                  Operation.addFile(
                    'redis-multi2.tex',
                    File.createLazyFromBlobs(blob)
                  ),
                  new Date('2017-01-01T00:03:00')
                ),
              ]
              await redisBackend.queueChanges(
                projectId,
                snapshot,
                latestChunk.getEndVersion(),
                queuedChanges
              )
            })

            it('returns changes from second chunk when since is 2', async function () {
              const result = await chunkStore.getChangesSinceVersion(
                projectId,
                2
              )
              // Current implementation limitation: when Redis doesn't have the version,
              // it falls back to chunk-based approach which only returns changes from
              // the single chunk that contains the start version, not subsequent chunks or Redis
              expect(result.changes).to.have.length(2) // Only from second chunk
              expect(result.hasMore).to.be.true // There are more chunks after this one
              expect(result.changes).to.deep.equal(secondChunk.getChanges())
            })

            it('returns changes from third chunk including Redis changes when since is 4', async function () {
              const result = await chunkStore.getChangesSinceVersion(
                projectId,
                4
              )
              // When requesting changes from the latest chunk, Redis changes are included
              // because loadAtVersion for the latest chunk includes non-persisted changes
              expect(result.changes).to.have.length(4) // 2 from third chunk + 2 from Redis
              expect(result.hasMore).to.be.false // Redis returns hasMore: false
              const expectedChanges = thirdChunk
                .getChanges()
                .concat(queuedChanges)
              expect(result.changes).to.deep.equal(expectedChanges)
            })

            it('returns Redis changes when since equals chunk end version', async function () {
              const result = await chunkStore.getChangesSinceVersion(
                projectId,
                6
              )
              expect(result.changes).to.have.length(2)
              expect(result.hasMore).to.be.false
              expect(result.changes).to.deep.equal(queuedChanges)
            })

            it('returns partial Redis changes when since is within Redis buffer', async function () {
              const result = await chunkStore.getChangesSinceVersion(
                projectId,
                7
              )
              expect(result.changes).to.have.length(1)
              expect(result.hasMore).to.be.false
              expect(result.changes).to.deep.equal([queuedChanges[1]])
            })

            it('returns empty changes when since equals current head version', async function () {
              const result = await chunkStore.getChangesSinceVersion(
                projectId,
                8
              )
              expect(result.changes).to.have.length(0)
              expect(result.hasMore).to.be.false
            })

            it('iterates through all the changes using the hasMore parameter', async function () {
              const allChanges = []
              let currentVersion = 0
              let hasMore = true

              while (hasMore) {
                const result = await chunkStore.getChangesSinceVersion(
                  projectId,
                  currentVersion
                )
                allChanges.push(...result.changes)
                hasMore = result.hasMore

                if (hasMore) {
                  // Move to the next version after the last change we received
                  currentVersion += result.changes.length
                }
              }

              // Should have collected the changes from all chunks plus Redis
              const expectedTotalChanges =
                firstChunk.getChanges().length +
                secondChunk.getChanges().length +
                thirdChunk.getChanges().length +
                queuedChanges.length
              expect(allChanges).to.have.length(expectedTotalChanges)

              // Verify we got the expected changes in order
              const expectedChanges = []
                .concat(firstChunk.getChanges())
                .concat(secondChunk.getChanges())
                .concat(thirdChunk.getChanges())
                .concat(queuedChanges)
              expect(allChanges).to.deep.equal(expectedChanges)
            })
          })
        })
      })

      describe('version checks', function () {
        beforeEach(async function () {
          // Create a chunk with start version 0, end version 3
          const blob = await blobStore.putString('abc')
          const chunk = makeChunk(
            [
              makeChange(
                Operation.addFile('main.tex', File.createLazyFromBlobs(blob))
              ),
              makeChange(
                Operation.editFile(
                  'main.tex',
                  TextOperation.fromJSON({ textOperation: [3, 'def'] })
                )
              ),
              makeChange(
                Operation.editFile(
                  'main.tex',
                  TextOperation.fromJSON({ textOperation: [6, 'ghi'] })
                )
              ),
            ],
            0
          )
          await chunkStore.update(projectId, chunk)
        })

        it('refuses to create a chunk with the same start version', async function () {
          const blob = await blobStore.putString('abc')
          const chunk = makeChunk(
            [
              makeChange(
                Operation.addFile('main.tex', File.createLazyFromBlobs(blob))
              ),
            ],
            0
          )
          await expect(chunkStore.create(projectId, chunk)).to.be.rejectedWith(
            chunkStore.ChunkVersionConflictError
          )
        })

        it("allows creating chunks that don't have version conflicts", async function () {
          const blob = await blobStore.putString('abc')
          const chunk = makeChunk(
            [
              makeChange(
                Operation.addFile('main.tex', File.createLazyFromBlobs(blob))
              ),
            ],
            3
          )
          await chunkStore.create(projectId, chunk)
        })
      })
    })
  }
})

function makeChange(operation, date = new Date()) {
  return new Change([operation], date, [])
}

function makeChunk(changes, versionNumber) {
  const snapshot = Snapshot.fromRaw({ files: {} })
  const history = new History(snapshot, [])
  const chunk = new Chunk(history, versionNumber)

  chunk.pushChanges(changes)
  return chunk
}
