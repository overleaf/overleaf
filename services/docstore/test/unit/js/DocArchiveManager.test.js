import sinon from 'sinon'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ObjectId } from 'mongodb-legacy'
import Errors from '../../../app/js/Errors.js'
import * as StreamToBuffer from '../../../app/js/StreamToBuffer.js'

const modulePath = '../../../app/js/DocArchiveManager.js'

describe('DocArchiveManager', () => {
  let DocArchiveManager,
    PersistorManager,
    MongoManager,
    RangeManager,
    Settings,
    Crypto,
    StreamUtils,
    HashDigest,
    HashUpdate,
    archivedDocs,
    mongoDocs,
    archivedDoc,
    archivedDocJson,
    md5Sum,
    projectId,
    readStream,
    stream,
    streamToBuffer

  beforeEach(async () => {
    md5Sum = 'decafbad'

    RangeManager = {
      jsonRangesToMongo: sinon.stub().returns({ mongo: 'ranges' }),
      fixCommentIds: sinon.stub(),
    }
    Settings = {
      docstore: {
        backend: 'gcs',
        bucket: 'wombat',
      },
      parallelArchiveJobs: 3,
    }
    HashDigest = sinon.stub().returns(md5Sum)
    HashUpdate = sinon.stub().returns({ digest: HashDigest })
    Crypto = {
      createHash: sinon.stub().returns({ update: HashUpdate }),
    }
    StreamUtils = {
      ReadableString: sinon.stub().returns({ stream: 'readStream' }),
    }

    projectId = new ObjectId()
    archivedDocs = [
      {
        _id: new ObjectId(),
        inS3: true,
        rev: 2,
      },
      {
        _id: new ObjectId(),
        inS3: true,
        rev: 4,
      },
      {
        _id: new ObjectId(),
        inS3: true,
        rev: 6,
      },
    ]
    mongoDocs = [
      {
        _id: new ObjectId(),
        lines: ['one', 'two', 'three'],
        rev: 2,
      },
      {
        _id: new ObjectId(),
        lines: ['aaa', 'bbb', 'ccc'],
        rev: 4,
      },
      {
        _id: new ObjectId(),
        inS3: true,
        rev: 6,
      },
      {
        _id: new ObjectId(),
        inS3: true,
        rev: 6,
      },
      {
        _id: new ObjectId(),
        lines: ['111', '222', '333'],
        rev: 6,
      },
    ]

    archivedDoc = {
      lines: mongoDocs[0].lines,
      rev: mongoDocs[0].rev,
    }

    archivedDocJson = JSON.stringify({ ...archivedDoc, schema_v: 1 })

    stream = {
      on: sinon.stub(),
      resume: sinon.stub(),
    }
    stream.on.withArgs('data').yields(Buffer.from(archivedDocJson, 'utf8'))
    stream.on.withArgs('end').yields()

    readStream = {
      stream: 'readStream',
    }

    PersistorManager = {
      getObjectStream: sinon.stub().resolves(stream),
      sendStream: sinon.stub().resolves(),
      getObjectMd5Hash: sinon.stub().resolves(md5Sum),
      deleteObject: sinon.stub().resolves(),
      deleteDirectory: sinon.stub().resolves(),
    }

    const getNonArchivedProjectDocIds = sinon.stub()
    getNonArchivedProjectDocIds
      .onCall(0)
      .resolves(mongoDocs.filter(doc => !doc.inS3).map(doc => doc._id))
    getNonArchivedProjectDocIds.onCall(1).resolves([])

    const getArchivedProjectDocs = sinon.stub()
    getArchivedProjectDocs.onCall(0).resolves(archivedDocs)
    getArchivedProjectDocs.onCall(1).resolves([])

    const fakeGetDoc = async (_projectId, _docId) => {
      if (_projectId.equals(projectId)) {
        for (const mongoDoc of mongoDocs.concat(archivedDocs)) {
          if (mongoDoc._id.equals(_docId)) {
            return mongoDoc
          }
        }
      }
      throw new Errors.NotFoundError()
    }

    MongoManager = {
      markDocAsArchived: sinon.stub().resolves(),
      restoreArchivedDoc: sinon.stub().resolves(),
      upsertIntoDocCollection: sinon.stub().resolves(),
      getProjectsDocs: sinon.stub().resolves(mongoDocs),
      getNonDeletedArchivedProjectDocs: getArchivedProjectDocs,
      getNonArchivedProjectDocIds,
      getArchivedProjectDocs,
      findDoc: sinon.stub().callsFake(fakeGetDoc),
      getDocForArchiving: sinon.stub().callsFake(fakeGetDoc),
      destroyProject: sinon.stub().resolves(),
    }

    // Wrap streamToBuffer so that we can pass in something that it expects (in
    // this case, a Promise) rather than a stubbed stream object
    streamToBuffer = {
      streamToBuffer: async () => {
        const inputStream = new Promise(resolve => {
          stream.on('data', data => resolve(data))
        })

        const value = await StreamToBuffer.streamToBuffer(
          'testProjectId',
          'testDocId',
          inputStream
        )

        return value
      },
    }

    vi.doMock('@overleaf/settings', () => ({
      default: Settings,
    }))

    vi.doMock('crypto', () => ({
      default: Crypto,
    }))

    vi.doMock('@overleaf/stream-utils', () => StreamUtils)

    vi.doMock('../../../app/js/MongoManager', () => ({
      default: MongoManager,
    }))

    vi.doMock('../../../app/js/RangeManager', () => ({
      default: RangeManager,
    }))

    vi.doMock('../../../app/js/PersistorManager', () => ({
      default: PersistorManager,
    }))

    vi.doMock('../../../app/js/Errors', () => ({
      default: Errors,
    }))

    vi.doMock('../../../app/js/StreamToBuffer', () => streamToBuffer)

    DocArchiveManager = (await import(modulePath)).default
  })

  describe('archiveDoc', () => {
    it('should resolve when passed a valid document', async () => {
      await expect(DocArchiveManager.archiveDoc(projectId, mongoDocs[0]._id)).to
        .eventually.be.fulfilled
    })

    it('should fix comment ids', async () => {
      await DocArchiveManager.archiveDoc(projectId, mongoDocs[1]._id)
      expect(RangeManager.fixCommentIds).to.have.been.called
    })

    it('should throw an error if the doc has no lines', async () => {
      const doc = mongoDocs[0]
      doc.lines = null

      await expect(
        DocArchiveManager.archiveDoc(projectId, doc._id)
      ).to.eventually.be.rejectedWith('doc has no lines')
    })

    it('should add the schema version', async () => {
      await DocArchiveManager.archiveDoc(projectId, mongoDocs[1]._id)
      expect(StreamUtils.ReadableString).to.have.been.calledWith(
        sinon.match(/"schema_v":1/)
      )
    })

    it('should calculate the hex md5 sum of the content', async () => {
      await DocArchiveManager.archiveDoc(projectId, mongoDocs[0]._id)
      expect(Crypto.createHash).to.have.been.calledWith('md5')
      expect(HashUpdate).to.have.been.calledWith(archivedDocJson)
      expect(HashDigest).to.have.been.calledWith('hex')
    })

    it('should pass the md5 hash to the object persistor for verification', async () => {
      await DocArchiveManager.archiveDoc(projectId, mongoDocs[0]._id)

      expect(PersistorManager.sendStream).to.have.been.calledWith(
        sinon.match.any,
        sinon.match.any,
        sinon.match.any,
        { sourceMd5: md5Sum }
      )
    })

    describe('with S3 persistor', () => {
      beforeEach(async () => {
        Settings.docstore.backend = 's3'
        await DocArchiveManager.archiveDoc(projectId, mongoDocs[0]._id)
      })

      it('should not calculate the hex md5 sum of the content', () => {
        expect(Crypto.createHash).not.to.have.been.called
        expect(HashUpdate).not.to.have.been.called
        expect(HashDigest).not.to.have.been.called
      })

      it('should not pass an md5 hash to the object persistor for verification', () => {
        expect(PersistorManager.sendStream).not.to.have.been.calledWithMatch({
          sourceMd5: sinon.match.any,
        })
      })
    })

    it('should pass the correct bucket and key to the persistor', async () => {
      await DocArchiveManager.archiveDoc(projectId, mongoDocs[0]._id)

      expect(PersistorManager.sendStream).to.have.been.calledWith(
        Settings.docstore.bucket,
        `${projectId}/${mongoDocs[0]._id}`
      )
    })

    it('should create a stream from the encoded json and send it', async () => {
      await DocArchiveManager.archiveDoc(projectId, mongoDocs[0]._id)
      expect(StreamUtils.ReadableString).to.have.been.calledWith(
        archivedDocJson
      )
      expect(PersistorManager.sendStream).to.have.been.calledWith(
        sinon.match.any,
        sinon.match.any,
        readStream
      )
    })

    it('should mark the doc as archived', async () => {
      await DocArchiveManager.archiveDoc(projectId, mongoDocs[0]._id)
      expect(MongoManager.markDocAsArchived).to.have.been.calledWith(
        projectId,
        mongoDocs[0]._id,
        mongoDocs[0].rev
      )
    })

    describe('when archiving is not configured', () => {
      beforeEach(() => {
        Settings.docstore.backend = undefined
      })

      it('should bail out early', async () => {
        await DocArchiveManager.archiveDoc(projectId, mongoDocs[0]._id)
        expect(MongoManager.getDocForArchiving).to.not.have.been.called
      })
    })

    describe('with null bytes in the result', () => {
      const _stringify = JSON.stringify

      beforeEach(() => {
        JSON.stringify = sinon.stub().returns('{"bad": "\u0000"}')
      })

      afterEach(() => {
        JSON.stringify = _stringify
      })

      it('should return an error', async () => {
        await expect(
          DocArchiveManager.archiveDoc(projectId, mongoDocs[0]._id)
        ).to.eventually.be.rejectedWith('null bytes detected')
      })
    })
  })

  describe('unarchiveDoc', () => {
    let docId, lines, rev

    describe('when the doc is in S3', () => {
      beforeEach(() => {
        MongoManager.findDoc = sinon.stub().resolves({ inS3: true, rev })
        docId = mongoDocs[0]._id
        lines = ['doc', 'lines']
        rev = 123
      })

      it('should resolve when passed a valid document', async () => {
        await expect(DocArchiveManager.unarchiveDoc(projectId, docId)).to
          .eventually.be.fulfilled
      })

      it('should test md5 validity with the raw buffer', async () => {
        await DocArchiveManager.unarchiveDoc(projectId, docId)
        expect(HashUpdate).to.have.been.calledWith(
          sinon.match.instanceOf(Buffer)
        )
      })

      it('should throw an error if the md5 does not match', async () => {
        PersistorManager.getObjectMd5Hash.resolves('badf00d')
        await expect(
          DocArchiveManager.unarchiveDoc(projectId, docId)
        ).to.eventually.be.rejected.and.be.instanceof(Errors.Md5MismatchError)
      })

      it('should restore the doc in Mongo', async () => {
        await DocArchiveManager.unarchiveDoc(projectId, docId)
        expect(MongoManager.restoreArchivedDoc).to.have.been.calledWith(
          projectId,
          docId,
          archivedDoc
        )
      })

      describe('when archiving is not configured', () => {
        beforeEach(() => {
          Settings.docstore.backend = undefined
        })

        it('should error out on archived doc', async () => {
          await expect(
            DocArchiveManager.unarchiveDoc(projectId, docId)
          ).to.eventually.be.rejected.and.match(
            /found archived doc, but archiving backend is not configured/
          )
        })

        it('should return early on non-archived doc', async () => {
          MongoManager.findDoc = sinon.stub().resolves({ rev })
          await DocArchiveManager.unarchiveDoc(projectId, docId)
          expect(PersistorManager.getObjectMd5Hash).to.not.have.been.called
        })
      })

      describe('doc contents', () => {
        let archivedDoc

        describe('when the doc has the old schema', () => {
          beforeEach(() => {
            archivedDoc = lines
            archivedDocJson = JSON.stringify(archivedDoc)
            stream.on
              .withArgs('data')
              .yields(Buffer.from(archivedDocJson, 'utf8'))
          })

          it('should return the docs lines', async () => {
            await DocArchiveManager.unarchiveDoc(projectId, docId)
            expect(MongoManager.restoreArchivedDoc).to.have.been.calledWith(
              projectId,
              docId,
              { lines, rev }
            )
          })
        })

        describe('with the new schema and ranges', () => {
          beforeEach(() => {
            archivedDoc = {
              lines,
              ranges: { json: 'ranges' },
              rev: 456,
              schema_v: 1,
            }
            archivedDocJson = JSON.stringify(archivedDoc)
            stream.on
              .withArgs('data')
              .yields(Buffer.from(archivedDocJson, 'utf8'))
          })

          it('should return the doc lines and ranges', async () => {
            await DocArchiveManager.unarchiveDoc(projectId, docId)
            expect(MongoManager.restoreArchivedDoc).to.have.been.calledWith(
              projectId,
              docId,
              {
                lines,
                ranges: { mongo: 'ranges' },
                rev: 456,
              }
            )
          })
        })

        describe('with the new schema and no ranges', () => {
          beforeEach(() => {
            archivedDoc = { lines, rev: 456, schema_v: 1 }
            archivedDocJson = JSON.stringify(archivedDoc)
            stream.on
              .withArgs('data')
              .yields(Buffer.from(archivedDocJson, 'utf8'))
          })

          it('should return only the doc lines', async () => {
            await DocArchiveManager.unarchiveDoc(projectId, docId)
            expect(MongoManager.restoreArchivedDoc).to.have.been.calledWith(
              projectId,
              docId,
              { lines, rev: 456 }
            )
          })
        })

        describe('with the new schema and no rev', () => {
          beforeEach(() => {
            archivedDoc = { lines, schema_v: 1 }
            archivedDocJson = JSON.stringify(archivedDoc)
            stream.on
              .withArgs('data')
              .yields(Buffer.from(archivedDocJson, 'utf8'))
          })

          it('should use the rev obtained from Mongo', async () => {
            await DocArchiveManager.unarchiveDoc(projectId, docId)
            expect(MongoManager.restoreArchivedDoc).to.have.been.calledWith(
              projectId,
              docId,
              { lines, rev }
            )
          })
        })

        describe('with an unrecognised schema', () => {
          beforeEach(() => {
            archivedDoc = { lines, schema_v: 2 }
            archivedDocJson = JSON.stringify(archivedDoc)
            stream.on
              .withArgs('data')
              .yields(Buffer.from(archivedDocJson, 'utf8'))
          })

          it('should throw an error', async () => {
            await expect(
              DocArchiveManager.unarchiveDoc(projectId, docId)
            ).to.eventually.be.rejectedWith(
              "I don't understand the doc format in s3"
            )
          })
        })
      })
    })

    it('should not do anything if the file is already unarchived', async () => {
      MongoManager.findDoc.resolves({ inS3: false })
      await DocArchiveManager.unarchiveDoc(projectId, docId)
      expect(PersistorManager.getObjectStream).not.to.have.been.called
    })

    it('should throw an error if the file is not found', async () => {
      PersistorManager.getObjectStream = sinon
        .stub()
        .rejects(new Errors.NotFoundError())
      await expect(
        DocArchiveManager.unarchiveDoc(projectId, docId)
      ).to.eventually.be.rejected.and.be.instanceof(Errors.NotFoundError)
    })
  })

  describe('destroyProject', () => {
    describe('when archiving is enabled', () => {
      beforeEach(async () => {
        await DocArchiveManager.destroyProject(projectId)
      })

      it('should delete the project in Mongo', () => {
        expect(MongoManager.destroyProject).to.have.been.calledWith(projectId)
      })

      it('should delete the project in the persistor', () => {
        expect(PersistorManager.deleteDirectory).to.have.been.calledWith(
          Settings.docstore.bucket,
          projectId
        )
      })
    })

    describe('when archiving is disabled', () => {
      beforeEach(async () => {
        Settings.docstore.backend = ''
        await DocArchiveManager.destroyProject(projectId)
      })

      it('should delete the project in Mongo', () => {
        expect(MongoManager.destroyProject).to.have.been.calledWith(projectId)
      })

      it('should not delete the project in the persistor', () => {
        expect(PersistorManager.deleteDirectory).not.to.have.been.called
      })
    })
  })

  describe('archiveAllDocs', () => {
    it('should resolve with valid arguments', async () => {
      await expect(DocArchiveManager.archiveAllDocs(projectId)).to.eventually.be
        .fulfilled
    })

    it('should archive all project docs which are not in s3', async () => {
      await DocArchiveManager.archiveAllDocs(projectId)
      // not inS3
      expect(MongoManager.markDocAsArchived).to.have.been.calledWith(
        projectId,
        mongoDocs[0]._id
      )
      expect(MongoManager.markDocAsArchived).to.have.been.calledWith(
        projectId,
        mongoDocs[1]._id
      )
      expect(MongoManager.markDocAsArchived).to.have.been.calledWith(
        projectId,
        mongoDocs[4]._id
      )

      // inS3
      expect(MongoManager.markDocAsArchived).not.to.have.been.calledWith(
        projectId,
        mongoDocs[2]._id
      )
      expect(MongoManager.markDocAsArchived).not.to.have.been.calledWith(
        projectId,
        mongoDocs[3]._id
      )
    })

    describe('when archiving is not configured', () => {
      beforeEach(() => {
        Settings.docstore.backend = undefined
      })

      it('should bail out early', async () => {
        await DocArchiveManager.archiveDoc(projectId, mongoDocs[0]._id)
        expect(MongoManager.getNonArchivedProjectDocIds).to.not.have.been.called
      })
    })
  })

  describe('unArchiveAllDocs', () => {
    it('should resolve with valid arguments', async () => {
      await expect(DocArchiveManager.unArchiveAllDocs(projectId)).to.eventually
        .be.fulfilled
    })

    it('should unarchive all inS3 docs', async () => {
      await DocArchiveManager.unArchiveAllDocs(projectId)

      for (const doc of archivedDocs) {
        expect(PersistorManager.getObjectStream).to.have.been.calledWith(
          Settings.docstore.bucket,
          `${projectId}/${doc._id}`
        )
      }
    })

    describe('when archiving is not configured', () => {
      beforeEach(() => {
        Settings.docstore.backend = undefined
      })

      it('should bail out early', async () => {
        await DocArchiveManager.archiveDoc(projectId, mongoDocs[0]._id)
        expect(MongoManager.getNonDeletedArchivedProjectDocs).to.not.have.been
          .called
      })
    })
  })
})
