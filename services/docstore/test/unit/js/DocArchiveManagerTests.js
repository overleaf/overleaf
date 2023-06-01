const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = '../../../app/js/DocArchiveManager.js'
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongodb')
const Errors = require('../../../app/js/Errors')

describe('DocArchiveManager', function () {
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
    stream

  beforeEach(function () {
    md5Sum = 'decafbad'

    RangeManager = {
      jsonRangesToMongo: sinon.stub().returns({ mongo: 'ranges' }),
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

    projectId = ObjectId()
    archivedDocs = [
      {
        _id: ObjectId(),
        inS3: true,
        rev: 2,
      },
      {
        _id: ObjectId(),
        inS3: true,
        rev: 4,
      },
      {
        _id: ObjectId(),
        inS3: true,
        rev: 6,
      },
    ]
    mongoDocs = [
      {
        _id: ObjectId(),
        lines: ['one', 'two', 'three'],
        rev: 2,
      },
      {
        _id: ObjectId(),
        lines: ['aaa', 'bbb', 'ccc'],
        rev: 4,
      },
      {
        _id: ObjectId(),
        inS3: true,
        rev: 6,
      },
      {
        _id: ObjectId(),
        inS3: true,
        rev: 6,
      },
      {
        _id: ObjectId(),
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
      promises: {
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
      },
    }

    DocArchiveManager = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': Settings,
        crypto: Crypto,
        '@overleaf/stream-utils': StreamUtils,
        './MongoManager': MongoManager,
        './RangeManager': RangeManager,
        './PersistorManager': PersistorManager,
        './Errors': Errors,
      },
    })
  })

  describe('archiveDoc', function () {
    it('should resolve when passed a valid document', async function () {
      await expect(
        DocArchiveManager.promises.archiveDoc(projectId, mongoDocs[0]._id)
      ).to.eventually.be.fulfilled
    })

    it('should throw an error if the doc has no lines', async function () {
      const doc = mongoDocs[0]
      doc.lines = null

      await expect(
        DocArchiveManager.promises.archiveDoc(projectId, doc._id)
      ).to.eventually.be.rejectedWith('doc has no lines')
    })

    it('should add the schema version', async function () {
      await DocArchiveManager.promises.archiveDoc(projectId, mongoDocs[1]._id)
      expect(StreamUtils.ReadableString).to.have.been.calledWith(
        sinon.match(/"schema_v":1/)
      )
    })

    it('should calculate the hex md5 sum of the content', async function () {
      await DocArchiveManager.promises.archiveDoc(projectId, mongoDocs[0]._id)
      expect(Crypto.createHash).to.have.been.calledWith('md5')
      expect(HashUpdate).to.have.been.calledWith(archivedDocJson)
      expect(HashDigest).to.have.been.calledWith('hex')
    })

    it('should pass the md5 hash to the object persistor for verification', async function () {
      await DocArchiveManager.promises.archiveDoc(projectId, mongoDocs[0]._id)

      expect(PersistorManager.sendStream).to.have.been.calledWith(
        sinon.match.any,
        sinon.match.any,
        sinon.match.any,
        { sourceMd5: md5Sum }
      )
    })

    it('should pass the correct bucket and key to the persistor', async function () {
      await DocArchiveManager.promises.archiveDoc(projectId, mongoDocs[0]._id)

      expect(PersistorManager.sendStream).to.have.been.calledWith(
        Settings.docstore.bucket,
        `${projectId}/${mongoDocs[0]._id}`
      )
    })

    it('should create a stream from the encoded json and send it', async function () {
      await DocArchiveManager.promises.archiveDoc(projectId, mongoDocs[0]._id)
      expect(StreamUtils.ReadableString).to.have.been.calledWith(
        archivedDocJson
      )
      expect(PersistorManager.sendStream).to.have.been.calledWith(
        sinon.match.any,
        sinon.match.any,
        readStream
      )
    })

    it('should mark the doc as archived', async function () {
      await DocArchiveManager.promises.archiveDoc(projectId, mongoDocs[0]._id)
      expect(MongoManager.promises.markDocAsArchived).to.have.been.calledWith(
        projectId,
        mongoDocs[0]._id,
        mongoDocs[0].rev
      )
    })

    describe('when archiving is not configured', function () {
      beforeEach(function () {
        Settings.docstore.backend = undefined
      })

      it('should bail out early', async function () {
        await DocArchiveManager.promises.archiveDoc(projectId, mongoDocs[0]._id)
        expect(MongoManager.promises.getDocForArchiving).to.not.have.been.called
      })
    })

    describe('with null bytes in the result', function () {
      const _stringify = JSON.stringify

      beforeEach(function () {
        JSON.stringify = sinon.stub().returns('{"bad": "\u0000"}')
      })

      afterEach(function () {
        JSON.stringify = _stringify
      })

      it('should return an error', async function () {
        await expect(
          DocArchiveManager.promises.archiveDoc(projectId, mongoDocs[0]._id)
        ).to.eventually.be.rejectedWith('null bytes detected')
      })
    })
  })

  describe('unarchiveDoc', function () {
    let docId, lines, rev

    describe('when the doc is in S3', function () {
      beforeEach(function () {
        MongoManager.promises.findDoc = sinon
          .stub()
          .resolves({ inS3: true, rev })
        docId = mongoDocs[0]._id
        lines = ['doc', 'lines']
        rev = 123
      })

      it('should resolve when passed a valid document', async function () {
        await expect(DocArchiveManager.promises.unarchiveDoc(projectId, docId))
          .to.eventually.be.fulfilled
      })

      it('should test md5 validity with the raw buffer', async function () {
        await DocArchiveManager.promises.unarchiveDoc(projectId, docId)
        expect(HashUpdate).to.have.been.calledWith(
          sinon.match.instanceOf(Buffer)
        )
      })

      it('should throw an error if the md5 does not match', async function () {
        PersistorManager.getObjectMd5Hash.resolves('badf00d')
        await expect(
          DocArchiveManager.promises.unarchiveDoc(projectId, docId)
        ).to.eventually.be.rejected.and.be.instanceof(Errors.Md5MismatchError)
      })

      it('should restore the doc in Mongo', async function () {
        await DocArchiveManager.promises.unarchiveDoc(projectId, docId)
        expect(
          MongoManager.promises.restoreArchivedDoc
        ).to.have.been.calledWith(projectId, docId, archivedDoc)
      })

      describe('when archiving is not configured', function () {
        beforeEach(function () {
          Settings.docstore.backend = undefined
        })

        it('should error out on archived doc', async function () {
          await expect(
            DocArchiveManager.promises.unarchiveDoc(projectId, docId)
          ).to.eventually.be.rejected.and.match(
            /found archived doc, but archiving backend is not configured/
          )
        })

        it('should return early on non-archived doc', async function () {
          MongoManager.promises.findDoc = sinon.stub().resolves({ rev })
          await DocArchiveManager.promises.unarchiveDoc(projectId, docId)
          expect(PersistorManager.getObjectMd5Hash).to.not.have.been.called
        })
      })

      describe('doc contents', function () {
        let archivedDoc

        describe('when the doc has the old schema', function () {
          beforeEach(function () {
            archivedDoc = lines
            archivedDocJson = JSON.stringify(archivedDoc)
            stream.on
              .withArgs('data')
              .yields(Buffer.from(archivedDocJson, 'utf8'))
          })

          it('should return the docs lines', async function () {
            await DocArchiveManager.promises.unarchiveDoc(projectId, docId)
            expect(
              MongoManager.promises.restoreArchivedDoc
            ).to.have.been.calledWith(projectId, docId, { lines, rev })
          })
        })

        describe('with the new schema and ranges', function () {
          beforeEach(function () {
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

          it('should return the doc lines and ranges', async function () {
            await DocArchiveManager.promises.unarchiveDoc(projectId, docId)
            expect(
              MongoManager.promises.restoreArchivedDoc
            ).to.have.been.calledWith(projectId, docId, {
              lines,
              ranges: { mongo: 'ranges' },
              rev: 456,
            })
          })
        })

        describe('with the new schema and no ranges', function () {
          beforeEach(function () {
            archivedDoc = { lines, rev: 456, schema_v: 1 }
            archivedDocJson = JSON.stringify(archivedDoc)
            stream.on
              .withArgs('data')
              .yields(Buffer.from(archivedDocJson, 'utf8'))
          })

          it('should return only the doc lines', async function () {
            await DocArchiveManager.promises.unarchiveDoc(projectId, docId)
            expect(
              MongoManager.promises.restoreArchivedDoc
            ).to.have.been.calledWith(projectId, docId, { lines, rev: 456 })
          })
        })

        describe('with the new schema and no rev', function () {
          beforeEach(function () {
            archivedDoc = { lines, schema_v: 1 }
            archivedDocJson = JSON.stringify(archivedDoc)
            stream.on
              .withArgs('data')
              .yields(Buffer.from(archivedDocJson, 'utf8'))
          })

          it('should use the rev obtained from Mongo', async function () {
            await DocArchiveManager.promises.unarchiveDoc(projectId, docId)
            expect(
              MongoManager.promises.restoreArchivedDoc
            ).to.have.been.calledWith(projectId, docId, { lines, rev })
          })
        })

        describe('with an unrecognised schema', function () {
          beforeEach(function () {
            archivedDoc = { lines, schema_v: 2 }
            archivedDocJson = JSON.stringify(archivedDoc)
            stream.on
              .withArgs('data')
              .yields(Buffer.from(archivedDocJson, 'utf8'))
          })

          it('should throw an error', async function () {
            await expect(
              DocArchiveManager.promises.unarchiveDoc(projectId, docId)
            ).to.eventually.be.rejectedWith(
              "I don't understand the doc format in s3"
            )
          })
        })
      })
    })

    it('should not do anything if the file is already unarchived', async function () {
      MongoManager.promises.findDoc.resolves({ inS3: false })
      await DocArchiveManager.promises.unarchiveDoc(projectId, docId)
      expect(PersistorManager.getObjectStream).not.to.have.been.called
    })

    it('should throw an error if the file is not found', async function () {
      PersistorManager.getObjectStream = sinon
        .stub()
        .rejects(new Errors.NotFoundError())
      await expect(
        DocArchiveManager.promises.unarchiveDoc(projectId, docId)
      ).to.eventually.be.rejected.and.be.instanceof(Errors.NotFoundError)
    })
  })

  describe('destroyProject', function () {
    describe('when archiving is enabled', function () {
      beforeEach(async function () {
        await DocArchiveManager.promises.destroyProject(projectId)
      })

      it('should delete the project in Mongo', function () {
        expect(MongoManager.promises.destroyProject).to.have.been.calledWith(
          projectId
        )
      })

      it('should delete the project in the persistor', function () {
        expect(PersistorManager.deleteDirectory).to.have.been.calledWith(
          Settings.docstore.bucket,
          projectId
        )
      })
    })

    describe('when archiving is disabled', function () {
      beforeEach(async function () {
        Settings.docstore.backend = ''
        await DocArchiveManager.promises.destroyProject(projectId)
      })

      it('should delete the project in Mongo', function () {
        expect(MongoManager.promises.destroyProject).to.have.been.calledWith(
          projectId
        )
      })

      it('should not delete the project in the persistor', function () {
        expect(PersistorManager.deleteDirectory).not.to.have.been.called
      })
    })
  })

  describe('archiveAllDocs', function () {
    it('should resolve with valid arguments', async function () {
      await expect(DocArchiveManager.promises.archiveAllDocs(projectId)).to
        .eventually.be.fulfilled
    })

    it('should archive all project docs which are not in s3', async function () {
      await DocArchiveManager.promises.archiveAllDocs(projectId)
      // not inS3
      expect(MongoManager.promises.markDocAsArchived).to.have.been.calledWith(
        projectId,
        mongoDocs[0]._id
      )
      expect(MongoManager.promises.markDocAsArchived).to.have.been.calledWith(
        projectId,
        mongoDocs[1]._id
      )
      expect(MongoManager.promises.markDocAsArchived).to.have.been.calledWith(
        projectId,
        mongoDocs[4]._id
      )

      // inS3
      expect(
        MongoManager.promises.markDocAsArchived
      ).not.to.have.been.calledWith(projectId, mongoDocs[2]._id)
      expect(
        MongoManager.promises.markDocAsArchived
      ).not.to.have.been.calledWith(projectId, mongoDocs[3]._id)
    })

    describe('when archiving is not configured', function () {
      beforeEach(function () {
        Settings.docstore.backend = undefined
      })

      it('should bail out early', async function () {
        await DocArchiveManager.promises.archiveDoc(projectId, mongoDocs[0]._id)
        expect(MongoManager.promises.getNonArchivedProjectDocIds).to.not.have
          .been.called
      })
    })
  })

  describe('unArchiveAllDocs', function () {
    it('should resolve with valid arguments', async function () {
      await expect(DocArchiveManager.promises.unArchiveAllDocs(projectId)).to
        .eventually.be.fulfilled
    })

    it('should unarchive all inS3 docs', async function () {
      await DocArchiveManager.promises.unArchiveAllDocs(projectId)

      for (const doc of archivedDocs) {
        expect(PersistorManager.getObjectStream).to.have.been.calledWith(
          Settings.docstore.bucket,
          `${projectId}/${doc._id}`
        )
      }
    })

    describe('when archiving is not configured', function () {
      beforeEach(function () {
        Settings.docstore.backend = undefined
      })

      it('should bail out early', async function () {
        await DocArchiveManager.promises.archiveDoc(projectId, mongoDocs[0]._id)
        expect(MongoManager.promises.getNonDeletedArchivedProjectDocs).to.not
          .have.been.called
      })
    })
  })
})
