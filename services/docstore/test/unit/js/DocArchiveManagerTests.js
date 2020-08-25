const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai
const modulePath = '../../../app/js/DocArchiveManager.js'
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongodb')
const Errors = require('../../../app/js/Errors')

chai.use(require('chai-as-promised'))
chai.use(require('sinon-chai'))

describe('DocArchiveManager', function () {
  let DocArchiveManager,
    PersistorManager,
    MongoManager,
    RangeManager,
    Settings,
    Logger,
    Crypto,
    Streamifier,
    HashDigest,
    HashUpdate,
    archivedDocs,
    mongoDocs,
    docJson,
    md5Sum,
    projectId,
    readStream,
    stream

  beforeEach(function () {
    md5Sum = 'decafbad'

    RangeManager = {
      jsonRangesToMongo: sinon.stub().returns({ mongo: 'ranges' })
    }
    Settings = {
      docstore: {
        bucket: 'wombat'
      }
    }
    Logger = {
      log: sinon.stub(),
      err: sinon.stub()
    }
    HashDigest = sinon.stub().returns(md5Sum)
    HashUpdate = sinon.stub().returns({ digest: HashDigest })
    Crypto = {
      createHash: sinon.stub().returns({ update: HashUpdate })
    }
    Streamifier = {
      createReadStream: sinon.stub().returns({ stream: 'readStream' })
    }

    projectId = ObjectId()
    archivedDocs = [
      {
        _id: ObjectId(),
        inS3: true,
        rev: 2
      },
      {
        _id: ObjectId(),
        inS3: true,
        rev: 4
      },
      {
        _id: ObjectId(),
        inS3: true,
        rev: 6
      }
    ]
    mongoDocs = [
      {
        _id: ObjectId(),
        lines: ['one', 'two', 'three'],
        rev: 2
      },
      {
        _id: ObjectId(),
        lines: ['aaa', 'bbb', 'ccc'],
        rev: 4
      },
      {
        _id: ObjectId(),
        inS3: true,
        rev: 6
      },
      {
        _id: ObjectId(),
        inS3: true,
        rev: 6
      },
      {
        _id: ObjectId(),
        lines: ['111', '222', '333'],
        rev: 6
      }
    ]

    docJson = JSON.stringify({
      lines: mongoDocs[0].lines,
      ranges: mongoDocs[0].ranges,
      schema_v: 1
    })

    stream = {
      on: sinon.stub(),
      resume: sinon.stub()
    }
    stream.on.withArgs('data').yields(Buffer.from(docJson, 'utf8'))
    stream.on.withArgs('end').yields()

    readStream = {
      stream: 'readStream'
    }

    PersistorManager = {
      getObjectStream: sinon.stub().resolves(stream),
      sendStream: sinon.stub().resolves(),
      getObjectMd5Hash: sinon.stub().resolves(md5Sum),
      deleteObject: sinon.stub().resolves()
    }

    MongoManager = {
      promises: {
        markDocAsArchived: sinon.stub().resolves(),
        upsertIntoDocCollection: sinon.stub().resolves(),
        getProjectsDocs: sinon.stub().resolves(mongoDocs),
        getArchivedProjectDocs: sinon.stub().resolves(archivedDocs),
        findDoc: sinon.stub().resolves(),
        destroyDoc: sinon.stub().resolves()
      }
    }
    for (const mongoDoc of mongoDocs) {
      MongoManager.promises.findDoc
        .withArgs(projectId, mongoDoc._id)
        .resolves(mongoDoc)
    }

    DocArchiveManager = SandboxedModule.require(modulePath, {
      requires: {
        'settings-sharelatex': Settings,
        'logger-sharelatex': Logger,
        crypto: Crypto,
        streamifier: Streamifier,
        './MongoManager': MongoManager,
        './RangeManager': RangeManager,
        './PersistorManager': PersistorManager,
        './Errors': Errors
      },
      globals: {
        console,
        JSON
      }
    })
  })

  describe('archiveDoc', function () {
    it('should resolve when passed a valid document', async function () {
      await expect(
        DocArchiveManager.promises.archiveDoc(projectId, mongoDocs[0])
      ).to.eventually.be.fulfilled
    })

    it('should throw an error if the doc has no lines', async function () {
      const doc = mongoDocs[0]
      doc.lines = null

      await expect(
        DocArchiveManager.promises.archiveDoc(projectId, doc)
      ).to.eventually.be.rejectedWith('doc has no lines')
    })

    it('should add the schema version', async function () {
      await DocArchiveManager.promises.archiveDoc(projectId, mongoDocs[1])
      expect(Streamifier.createReadStream).to.have.been.calledWith(
        sinon.match(/"schema_v":1/)
      )
    })

    it('should calculate the hex md5 sum of the content', async function () {
      const json = JSON.stringify({
        lines: mongoDocs[0].lines,
        ranges: mongoDocs[0].ranges,
        schema_v: 1
      })

      await DocArchiveManager.promises.archiveDoc(projectId, mongoDocs[0])

      expect(Crypto.createHash).to.have.been.calledWith('md5')
      expect(HashUpdate).to.have.been.calledWith(json)
      expect(HashDigest).to.have.been.calledWith('hex')
    })

    it('should pass the md5 hash to the object persistor for verification', async function () {
      await DocArchiveManager.promises.archiveDoc(projectId, mongoDocs[0])

      expect(PersistorManager.sendStream).to.have.been.calledWith(
        sinon.match.any,
        sinon.match.any,
        sinon.match.any,
        { sourceMd5: md5Sum }
      )
    })

    it('should pass the correct bucket and key to the persistor', async function () {
      await DocArchiveManager.promises.archiveDoc(projectId, mongoDocs[0])

      expect(PersistorManager.sendStream).to.have.been.calledWith(
        Settings.docstore.bucket,
        `${projectId}/${mongoDocs[0]._id}`
      )
    })

    it('should create a stream from the encoded json and send it', async function () {
      await DocArchiveManager.promises.archiveDoc(projectId, mongoDocs[0])
      expect(Streamifier.createReadStream).to.have.been.calledWith(docJson)
      expect(PersistorManager.sendStream).to.have.been.calledWith(
        sinon.match.any,
        sinon.match.any,
        readStream
      )
    })

    it('should mark the doc as archived', async function () {
      await DocArchiveManager.promises.archiveDoc(projectId, mongoDocs[0])
      expect(MongoManager.promises.markDocAsArchived).to.have.been.calledWith(
        mongoDocs[0]._id,
        mongoDocs[0].rev
      )
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
          DocArchiveManager.promises.archiveDoc(projectId, mongoDocs[0])
        ).to.eventually.be.rejectedWith('null bytes detected')
      })
    })
  })

  describe('unarchiveDoc', function () {
    let docId

    beforeEach(function () {
      docId = mongoDocs[0]._id
    })

    it('should resolve when passed a valid document', async function () {
      await expect(DocArchiveManager.promises.unarchiveDoc(projectId, docId)).to
        .eventually.be.fulfilled
    })

    it('should throw an error if the md5 does not match', async function () {
      PersistorManager.getObjectMd5Hash.resolves('badf00d')
      await expect(
        DocArchiveManager.promises.unarchiveDoc(projectId, docId)
      ).to.eventually.be.rejected.and.be.instanceof(Errors.Md5MismatchError)
    })

    it('should update the doc lines in mongo', async function () {
      await DocArchiveManager.promises.unarchiveDoc(projectId, docId)
      expect(
        MongoManager.promises.upsertIntoDocCollection
      ).to.have.been.calledWith(projectId, docId, { lines: mongoDocs[0].lines })
    })

    it('should delete the doc in s3', async function () {
      await DocArchiveManager.promises.unarchiveDoc(projectId, docId)
      expect(PersistorManager.deleteObject).to.have.been.calledWith(
        Settings.docstore.bucket,
        `${projectId}/${docId}`
      )
    })

    describe('doc contents', function () {
      let mongoDoc, s3Doc

      describe('when the doc has the old schema', function () {
        beforeEach(function () {
          mongoDoc = {
            lines: ['doc', 'lines']
          }
          s3Doc = ['doc', 'lines']
          docJson = JSON.stringify(s3Doc)
          stream.on.withArgs('data').yields(Buffer.from(docJson, 'utf8'))
        })

        it('should return the docs lines', async function () {
          await DocArchiveManager.promises.unarchiveDoc(projectId, docId)
          expect(
            MongoManager.promises.upsertIntoDocCollection
          ).to.have.been.calledWith(projectId, docId, mongoDoc)
        })
      })

      describe('with the new schema and ranges', function () {
        beforeEach(function () {
          s3Doc = {
            lines: ['doc', 'lines'],
            ranges: { json: 'ranges' },
            schema_v: 1
          }
          mongoDoc = {
            lines: ['doc', 'lines'],
            ranges: { mongo: 'ranges' }
          }
          docJson = JSON.stringify(s3Doc)
          stream.on.withArgs('data').yields(Buffer.from(docJson, 'utf8'))
        })

        it('should return the doc lines and ranges', async function () {
          await DocArchiveManager.promises.unarchiveDoc(projectId, docId)
          expect(
            MongoManager.promises.upsertIntoDocCollection
          ).to.have.been.calledWith(projectId, docId, mongoDoc)
        })
      })

      describe('with the new schema and no ranges', function () {
        beforeEach(function () {
          s3Doc = {
            lines: ['doc', 'lines'],
            schema_v: 1
          }
          mongoDoc = {
            lines: ['doc', 'lines']
          }
          docJson = JSON.stringify(s3Doc)
          stream.on.withArgs('data').yields(Buffer.from(docJson, 'utf8'))
        })

        it('should return only the doc lines', async function () {
          await DocArchiveManager.promises.unarchiveDoc(projectId, docId)
          expect(
            MongoManager.promises.upsertIntoDocCollection
          ).to.have.been.calledWith(projectId, docId, mongoDoc)
        })
      })

      describe('with an unrecognised schema', function () {
        beforeEach(function () {
          s3Doc = {
            lines: ['doc', 'lines'],
            schema_v: 2
          }
          docJson = JSON.stringify(s3Doc)
          stream.on.withArgs('data').yields(Buffer.from(docJson, 'utf8'))
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

  describe('destroyDoc', function () {
    let docId

    beforeEach(function () {
      docId = mongoDocs[0]._id
    })

    it('should resolve when passed a valid document', async function () {
      await expect(DocArchiveManager.promises.destroyDoc(projectId, docId)).to
        .eventually.be.fulfilled
    })

    it('should throw a not found error when there is no document', async function () {
      await expect(
        DocArchiveManager.promises.destroyDoc(projectId, 'wombat')
      ).to.eventually.be.rejected.and.be.instanceof(Errors.NotFoundError)
    })

    describe('when the doc is in s3', function () {
      beforeEach(function () {
        mongoDocs[0].inS3 = true
      })

      it('should delete the document from s3, if it is in s3', async function () {
        await DocArchiveManager.promises.destroyDoc(projectId, docId)
        expect(PersistorManager.deleteObject).to.have.been.calledWith(
          Settings.docstore.bucket,
          `${projectId}/${docId}`
        )
      })

      it('should delete the doc in mongo', async function () {
        await DocArchiveManager.promises.destroyDoc(projectId, docId)
      })
    })

    describe('when the doc is not in s3', function () {
      beforeEach(function () {
        mongoDocs[0].inS3 = false
      })

      it('should not delete the document from s3, if it is not in s3', async function () {
        await DocArchiveManager.promises.destroyDoc(projectId, docId)
        expect(PersistorManager.deleteObject).not.to.have.been.called
      })

      it('should delete the doc in mongo', async function () {
        await DocArchiveManager.promises.destroyDoc(projectId, docId)
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
        mongoDocs[0]._id
      )
      expect(MongoManager.promises.markDocAsArchived).to.have.been.calledWith(
        mongoDocs[1]._id
      )
      expect(MongoManager.promises.markDocAsArchived).to.have.been.calledWith(
        mongoDocs[4]._id
      )

      // inS3
      expect(
        MongoManager.promises.markDocAsArchived
      ).not.to.have.been.calledWith(mongoDocs[2]._id)
      expect(
        MongoManager.promises.markDocAsArchived
      ).not.to.have.been.calledWith(mongoDocs[3]._id)
    })

    it('should return error if the project has no docs', async function () {
      MongoManager.promises.getProjectsDocs.resolves(null)

      await expect(
        DocArchiveManager.promises.archiveAllDocs(projectId)
      ).to.eventually.be.rejected.and.be.instanceof(Errors.NotFoundError)
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

    it('should return error if the project has no docs', async function () {
      MongoManager.promises.getArchivedProjectDocs.resolves(null)

      await expect(
        DocArchiveManager.promises.unArchiveAllDocs(projectId)
      ).to.eventually.be.rejected.and.be.instanceof(Errors.NotFoundError)
    })
  })

  describe('destroyAllDocs', function () {
    it('should resolve with valid arguments', async function () {
      await expect(DocArchiveManager.promises.destroyAllDocs(projectId)).to
        .eventually.be.fulfilled
    })

    it('should delete all docs that are in s3 from s3', async function () {
      await DocArchiveManager.promises.destroyAllDocs(projectId)

      // not inS3
      for (const index of [0, 1, 4]) {
        expect(PersistorManager.deleteObject).not.to.have.been.calledWith(
          Settings.docstore.bucket,
          `${projectId}/${mongoDocs[index]._id}`
        )
      }

      // inS3
      for (const index of [2, 3]) {
        expect(PersistorManager.deleteObject).to.have.been.calledWith(
          Settings.docstore.bucket,
          `${projectId}/${mongoDocs[index]._id}`
        )
      }
    })

    it('should destroy all docs in mongo', async function () {
      await DocArchiveManager.promises.destroyAllDocs(projectId)

      for (const mongoDoc of mongoDocs) {
        expect(MongoManager.promises.destroyDoc).to.have.been.calledWith(
          mongoDoc._id
        )
      }
    })
  })
})
