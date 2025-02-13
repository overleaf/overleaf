'use strict'

const cleanup = require('./support/cleanup')
const fixtures = require('./support/fixtures')
const { expect } = require('chai')
const sinon = require('sinon')
const { ObjectId } = require('mongodb')
const { projects } = require('../../../../storage/lib/mongodb')

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
const { chunkStore, historyStore } = require('../../../../storage')

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

      beforeEach(async function () {
        projectId = await scenario.createProject()
        // create a record in the mongo projects collection
        projectRecord = await projects.insertOne({
          overleaf: { history: { id: scenario.idMapping(projectId) } },
        })
      })

      it('loads empty latest chunk for a new project', async function () {
        const chunk = await chunkStore.loadLatest(projectId)
        expect(chunk.getSnapshot().countFiles()).to.equal(0)
        expect(chunk.getChanges().length).to.equal(0)
        expect(chunk.getEndTimestamp()).not.to.exist
      })

      describe('adding and editing a blank file', function () {
        const testPathname = 'foo.txt'
        const testTextOperation = TextOperation.fromJSON({
          textOperation: ['a'],
        }) // insert an a
        let lastChangeTimestamp

        beforeEach(async function () {
          const chunk = await chunkStore.loadLatest(projectId)
          const oldEndVersion = chunk.getEndVersion()
          const changes = [
            makeChange(Operation.addFile(testPathname, File.fromString(''))),
            makeChange(Operation.editFile(testPathname, testTextOperation)),
          ]
          lastChangeTimestamp = changes[1].getTimestamp()
          chunk.pushChanges(changes)
          await chunkStore.update(projectId, oldEndVersion, chunk)
        })

        it('records the correct metadata in db readOnly=false', async function () {
          const raw = await chunkStore.loadLatestRaw(projectId)
          expect(raw).to.deep.include({
            startVersion: 0,
            endVersion: 2,
            endTimestamp: lastChangeTimestamp,
          })
        })

        it('records the correct metadata in db readOnly=true', async function () {
          const raw = await chunkStore.loadLatestRaw(projectId, {
            readOnly: true,
          })
          expect(raw).to.deep.include({
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
            lastChangeTimestamp
          )
        })
      })

      describe('multiple chunks', async function () {
        // Two chunks are 1 year apart
        const firstChunkTimestamp = new Date('2015-01-01T00:00:00')
        const secondChunkTimestamp = new Date('2016-01-01T00:00:00')
        const thirdChunkTimestamp = new Date('2017-01-01T00:00:00')
        let firstChunk, secondChunk, thirdChunk

        beforeEach(async function () {
          firstChunk = makeChunk(
            [
              makeChange(
                Operation.addFile('foo.tex', File.fromString('')),
                new Date(firstChunkTimestamp - 5000)
              ),
              makeChange(
                Operation.addFile('bar.tex', File.fromString('')),
                firstChunkTimestamp
              ),
            ],
            0
          )
          await chunkStore.update(projectId, 0, firstChunk)
          firstChunk = await chunkStore.loadLatest(projectId)

          secondChunk = makeChunk(
            [
              makeChange(
                Operation.addFile('baz.tex', File.fromString('')),
                new Date(secondChunkTimestamp - 5000)
              ),
              makeChange(
                Operation.addFile('qux.tex', File.fromString('')),
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
                Operation.addFile('quux.tex', File.fromString('')),
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
          expect(project.overleaf.history.currentEndVersion).to.equal(5)
          expect(project.overleaf.history.currentEndTimestamp).to.deep.equal(
            thirdChunkTimestamp
          )
        })

        it('updates the pending change timestamp to match the first chunk', async function () {
          const project = await projects.findOne({
            _id: new ObjectId(projectRecord.insertedId),
          })
          expect(project.overleaf.backup.pendingChangeAt).to.deep.equal(
            firstChunkTimestamp
          )
        })

        describe('after updating the last chunk', function () {
          let newChunk

          beforeEach(async function () {
            newChunk = makeChunk(
              [
                ...thirdChunk.getChanges(),
                makeChange(
                  Operation.addFile('onemore.tex', File.fromString('')),
                  thirdChunkTimestamp
                ),
              ],
              4
            )
            await chunkStore.update(projectId, 5, newChunk)
            newChunk = await chunkStore.loadLatest(projectId)
          })

          it('replaces the latest chunk', function () {
            expect(newChunk.getChanges()).to.have.length(2)
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
            expect(project.overleaf.history.currentEndVersion).to.equal(6)
            expect(project.overleaf.history.currentEndTimestamp).to.deep.equal(
              thirdChunkTimestamp
            )
          })

          it('does not modify the existing pending change timestamp in the project record', async function () {
            const project = await projects.findOne({
              _id: new ObjectId(projectRecord.insertedId),
            })
            expect(project.overleaf.backup.pendingChangeAt).to.deep.equal(
              firstChunkTimestamp
            )
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

          const changes = [
            makeChange(Operation.addFile(testPathname, File.fromString(''))),
            makeChange(Operation.editFile(testPathname, testTextOperation)),
          ]
          chunk.pushChanges(changes)

          await expect(
            chunkStore.update(projectId, oldEndVersion, chunk)
          ).to.be.rejectedWith('S3 Error')
          chunk = await chunkStore.loadLatest(projectId)
          expect(chunk.getEndVersion()).to.equal(oldEndVersion)
        })
      })

      describe('version checks', function () {
        beforeEach(async function () {
          // Create a chunk with start version 0, end version 3
          const chunk = makeChunk(
            [
              makeChange(Operation.addFile('main.tex', File.fromString('abc'))),
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
          await chunkStore.update(projectId, 0, chunk)
        })

        it('refuses to create a chunk with the same start version', async function () {
          const chunk = makeChunk(
            [makeChange(Operation.addFile('main.tex', File.fromString('abc')))],
            0
          )
          await expect(chunkStore.create(projectId, chunk)).to.be.rejectedWith(
            chunkStore.ChunkVersionConflictError
          )
        })

        it("allows creating chunks that don't have version conflicts", async function () {
          const chunk = makeChunk(
            [makeChange(Operation.addFile('main.tex', File.fromString('abc')))],
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
