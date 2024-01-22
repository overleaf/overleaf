const { db, ObjectId } = require('../../../app/js/mongodb')
const { expect } = require('chai')
const DocstoreApp = require('./helpers/DocstoreApp')
const Errors = require('../../../app/js/Errors')
const Settings = require('@overleaf/settings')
const { Storage } = require('@google-cloud/storage')

const DocstoreClient = require('./helpers/DocstoreClient')

function deleteTestSuite(deleteDoc) {
  before(async function () {
    // Create buckets needed by the archiving part of these tests
    const storage = new Storage(Settings.docstore.gcs.endpoint)
    await storage.createBucket(Settings.docstore.bucket)
    await storage.createBucket(`${Settings.docstore.bucket}-deleted`)
  })

  after(async function () {
    // Tear down the buckets created above
    const storage = new Storage(Settings.docstore.gcs.endpoint)
    await storage.bucket(Settings.docstore.bucket).deleteFiles()
    await storage.bucket(Settings.docstore.bucket).delete()
    await storage.bucket(`${Settings.docstore.bucket}-deleted`).deleteFiles()
    await storage.bucket(`${Settings.docstore.bucket}-deleted`).delete()
  })

  beforeEach(function (done) {
    this.project_id = new ObjectId()
    this.doc_id = new ObjectId()
    this.lines = ['original', 'lines']
    this.version = 42
    this.ranges = []
    DocstoreApp.ensureRunning(() => {
      DocstoreClient.createDoc(
        this.project_id,
        this.doc_id,
        this.lines,
        this.version,
        this.ranges,
        error => {
          if (error) {
            throw error
          }
          done()
        }
      )
    })
  })

  it('should show as not deleted on /deleted', function (done) {
    DocstoreClient.isDocDeleted(
      this.project_id,
      this.doc_id,
      (error, res, body) => {
        if (error) return done(error)
        expect(res.statusCode).to.equal(200)
        expect(body).to.have.property('deleted').to.equal(false)
        done()
      }
    )
  })

  describe('when the doc exists', function () {
    beforeEach(function (done) {
      deleteDoc(this.project_id, this.doc_id, (error, res, doc) => {
        if (error) return done(error)
        this.res = res
        done()
      })
    })

    afterEach(function (done) {
      db.docs.deleteOne({ _id: this.doc_id }, done)
    })

    it('should mark the doc as deleted on /deleted', function (done) {
      DocstoreClient.isDocDeleted(
        this.project_id,
        this.doc_id,
        (error, res, body) => {
          if (error) return done(error)
          expect(res.statusCode).to.equal(200)
          expect(body).to.have.property('deleted').to.equal(true)
          done()
        }
      )
    })

    it('should insert a deleted doc into the docs collection', function (done) {
      db.docs.find({ _id: this.doc_id }).toArray((error, docs) => {
        if (error) return done(error)
        docs[0]._id.should.deep.equal(this.doc_id)
        docs[0].lines.should.deep.equal(this.lines)
        docs[0].deleted.should.equal(true)
        done()
      })
    })

    it('should not export the doc to s3', function (done) {
      setTimeout(() => {
        DocstoreClient.getS3Doc(this.project_id, this.doc_id, error => {
          expect(error).to.be.instanceOf(Errors.NotFoundError)
          done()
        })
      }, 1000)
    })
  })

  describe('when archiveOnSoftDelete is enabled', function () {
    let archiveOnSoftDelete
    beforeEach('overwrite settings', function () {
      archiveOnSoftDelete = Settings.docstore.archiveOnSoftDelete
      Settings.docstore.archiveOnSoftDelete = true
    })
    afterEach('restore settings', function () {
      Settings.docstore.archiveOnSoftDelete = archiveOnSoftDelete
    })

    beforeEach('delete Doc', function (done) {
      deleteDoc(this.project_id, this.doc_id, (error, res) => {
        if (error) return done(error)
        this.res = res
        done()
      })
    })

    beforeEach(function waitForBackgroundFlush(done) {
      setTimeout(done, 500)
    })

    afterEach(function cleanupDoc(done) {
      db.docs.deleteOne({ _id: this.doc_id }, done)
    })

    it('should set the deleted flag in the doc', function (done) {
      db.docs.findOne({ _id: this.doc_id }, (error, doc) => {
        if (error) {
          return done(error)
        }
        expect(doc.deleted).to.equal(true)
        done()
      })
    })

    it('should set inS3 and unset lines and ranges in the doc', function (done) {
      db.docs.findOne({ _id: this.doc_id }, (error, doc) => {
        if (error) {
          return done(error)
        }
        expect(doc.lines).to.not.exist
        expect(doc.ranges).to.not.exist
        expect(doc.inS3).to.equal(true)
        done()
      })
    })

    it('should set the doc in s3 correctly', function (done) {
      DocstoreClient.getS3Doc(this.project_id, this.doc_id, (error, s3doc) => {
        if (error) {
          return done(error)
        }
        expect(s3doc.lines).to.deep.equal(this.lines)
        expect(s3doc.ranges).to.deep.equal(this.ranges)
        done()
      })
    })
  })

  describe('when the doc exists in another project', function () {
    const otherProjectId = new ObjectId()

    it('should show as not existing on /deleted', function (done) {
      DocstoreClient.isDocDeleted(otherProjectId, this.doc_id, (error, res) => {
        if (error) return done(error)
        expect(res.statusCode).to.equal(404)
        done()
      })
    })

    it('should return a 404 when trying to delete', function (done) {
      deleteDoc(otherProjectId, this.doc_id, (error, res) => {
        if (error) return done(error)
        expect(res.statusCode).to.equal(404)
        done()
      })
    })
  })

  describe('when the doc does not exist', function () {
    it('should show as not existing on /deleted', function (done) {
      const missingDocId = new ObjectId()
      DocstoreClient.isDocDeleted(
        this.project_id,
        missingDocId,
        (error, res) => {
          if (error) return done(error)
          expect(res.statusCode).to.equal(404)
          done()
        }
      )
    })

    it('should return a 404', function (done) {
      const missingDocId = new ObjectId()
      deleteDoc(this.project_id, missingDocId, (error, res, doc) => {
        if (error) return done(error)
        res.statusCode.should.equal(404)
        done()
      })
    })
  })
}

describe('Delete via PATCH', function () {
  deleteTestSuite(DocstoreClient.deleteDoc)

  describe('when providing a custom doc name in the delete request', function () {
    beforeEach(function (done) {
      DocstoreClient.deleteDocWithName(
        this.project_id,
        this.doc_id,
        'wombat.tex',
        done
      )
    })

    it('should insert the doc name into the docs collection', function (done) {
      db.docs.find({ _id: this.doc_id }).toArray((error, docs) => {
        if (error) return done(error)
        expect(docs[0].name).to.equal('wombat.tex')
        done()
      })
    })
  })

  describe('when providing a custom deletedAt date in the delete request', function () {
    beforeEach('record date and delay', function (done) {
      this.deletedAt = new Date()
      setTimeout(done, 5)
    })

    beforeEach('perform deletion with past date', function (done) {
      DocstoreClient.deleteDocWithDate(
        this.project_id,
        this.doc_id,
        this.deletedAt,
        done
      )
    })

    it('should insert the date into the docs collection', function (done) {
      db.docs.find({ _id: this.doc_id }).toArray((error, docs) => {
        if (error) return done(error)
        expect(docs[0].deletedAt.toISOString()).to.equal(
          this.deletedAt.toISOString()
        )
        done()
      })
    })
  })

  describe('when providing no doc name in the delete request', function () {
    beforeEach(function (done) {
      DocstoreClient.deleteDocWithName(
        this.project_id,
        this.doc_id,
        '',
        (error, res) => {
          this.res = res
          done(error)
        }
      )
    })

    it('should reject the request', function () {
      expect(this.res.statusCode).to.equal(400)
    })
  })

  describe('when providing no date in the delete request', function () {
    beforeEach(function (done) {
      DocstoreClient.deleteDocWithDate(
        this.project_id,
        this.doc_id,
        '',
        (error, res) => {
          this.res = res
          done(error)
        }
      )
    })

    it('should reject the request', function () {
      expect(this.res.statusCode).to.equal(400)
    })
  })

  describe('before deleting anything', function () {
    it('should show nothing in deleted docs response', function (done) {
      DocstoreClient.getAllDeletedDocs(
        this.project_id,
        (error, deletedDocs) => {
          if (error) return done(error)
          expect(deletedDocs).to.deep.equal([])
          done()
        }
      )
    })
  })

  describe('when the doc gets a name on delete', function () {
    beforeEach(function (done) {
      this.deletedAt = new Date()
      DocstoreClient.deleteDocWithDate(
        this.project_id,
        this.doc_id,
        this.deletedAt,
        done
      )
    })

    it('should show the doc in deleted docs response', function (done) {
      DocstoreClient.getAllDeletedDocs(
        this.project_id,
        (error, deletedDocs) => {
          if (error) return done(error)
          expect(deletedDocs).to.deep.equal([
            {
              _id: this.doc_id.toString(),
              name: 'main.tex',
              deletedAt: this.deletedAt.toISOString(),
            },
          ])
          done()
        }
      )
    })

    describe('after deleting multiple docs', function () {
      beforeEach('create doc2', function (done) {
        this.doc_id2 = new ObjectId()
        DocstoreClient.createDoc(
          this.project_id,
          this.doc_id2,
          this.lines,
          this.version,
          this.ranges,
          done
        )
      })
      beforeEach('delete doc2', function (done) {
        this.deletedAt2 = new Date()
        DocstoreClient.deleteDocWithDateAndName(
          this.project_id,
          this.doc_id2,
          this.deletedAt2,
          'two.tex',
          done
        )
      })
      beforeEach('create doc3', function (done) {
        this.doc_id3 = new ObjectId()
        DocstoreClient.createDoc(
          this.project_id,
          this.doc_id3,
          this.lines,
          this.version,
          this.ranges,
          done
        )
      })
      beforeEach('delete doc3', function (done) {
        this.deletedAt3 = new Date()
        DocstoreClient.deleteDocWithDateAndName(
          this.project_id,
          this.doc_id3,
          this.deletedAt3,
          'three.tex',
          done
        )
      })
      it('should show all the docs as deleted', function (done) {
        DocstoreClient.getAllDeletedDocs(
          this.project_id,
          (error, deletedDocs) => {
            if (error) return done(error)

            expect(deletedDocs).to.deep.equal([
              {
                _id: this.doc_id3.toString(),
                name: 'three.tex',
                deletedAt: this.deletedAt3.toISOString(),
              },
              {
                _id: this.doc_id2.toString(),
                name: 'two.tex',
                deletedAt: this.deletedAt2.toISOString(),
              },
              {
                _id: this.doc_id.toString(),
                name: 'main.tex',
                deletedAt: this.deletedAt.toISOString(),
              },
            ])
            done()
          }
        )
      })

      describe('with one more than max_deleted_docs permits', function () {
        let maxDeletedDocsBefore
        beforeEach(function () {
          maxDeletedDocsBefore = Settings.max_deleted_docs
          Settings.max_deleted_docs = 2
        })
        afterEach(function () {
          Settings.max_deleted_docs = maxDeletedDocsBefore
        })

        it('should omit the first deleted doc', function (done) {
          DocstoreClient.getAllDeletedDocs(
            this.project_id,
            (error, deletedDocs) => {
              if (error) return done(error)

              expect(deletedDocs).to.deep.equal([
                {
                  _id: this.doc_id3.toString(),
                  name: 'three.tex',
                  deletedAt: this.deletedAt3.toISOString(),
                },
                {
                  _id: this.doc_id2.toString(),
                  name: 'two.tex',
                  deletedAt: this.deletedAt2.toISOString(),
                },
                // dropped main.tex
              ])
              done()
            }
          )
        })
      })
    })
  })
})

describe("Destroying a project's documents", function () {
  beforeEach(function (done) {
    this.project_id = new ObjectId()
    this.doc_id = new ObjectId()
    this.lines = ['original', 'lines']
    this.version = 42
    this.ranges = []
    DocstoreApp.ensureRunning(() => {
      DocstoreClient.createDoc(
        this.project_id,
        this.doc_id,
        this.lines,
        this.version,
        this.ranges,
        error => {
          if (error) {
            throw error
          }
          done()
        }
      )
    })
  })

  describe('when the doc exists', function () {
    beforeEach(function (done) {
      DocstoreClient.destroyAllDoc(this.project_id, done)
    })

    it('should remove the doc from the docs collection', function (done) {
      db.docs.find({ _id: this.doc_id }).toArray((err, docs) => {
        expect(err).not.to.exist
        expect(docs).to.deep.equal([])
        done()
      })
    })
  })

  describe('when the doc is archived', function () {
    beforeEach(function (done) {
      DocstoreClient.archiveAllDoc(this.project_id, err => {
        if (err) {
          return done(err)
        }
        DocstoreClient.destroyAllDoc(this.project_id, done)
      })
    })

    it('should remove the doc from the docs collection', function (done) {
      db.docs.find({ _id: this.doc_id }).toArray((err, docs) => {
        expect(err).not.to.exist
        expect(docs).to.deep.equal([])
        done()
      })
    })

    it('should remove the doc contents from s3', function (done) {
      DocstoreClient.getS3Doc(this.project_id, this.doc_id, error => {
        expect(error).to.be.instanceOf(Errors.NotFoundError)
        done()
      })
    })
  })
})
