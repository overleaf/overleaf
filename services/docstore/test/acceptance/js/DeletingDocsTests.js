/* eslint-disable
    camelcase,
    handle-callback-err,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const chai = require('chai')
chai.should()
const { db, ObjectId } = require('../../../app/js/mongodb')
const { expect } = chai
const DocstoreApp = require('./helpers/DocstoreApp')
const Errors = require('../../../app/js/Errors')
const Settings = require('settings-sharelatex')

const DocstoreClient = require('./helpers/DocstoreClient')

describe('Deleting a doc', function () {
  beforeEach(function (done) {
    this.project_id = ObjectId()
    this.doc_id = ObjectId()
    this.lines = ['original', 'lines']
    this.version = 42
    this.ranges = []
    return DocstoreApp.ensureRunning(() => {
      return DocstoreClient.createDoc(
        this.project_id,
        this.doc_id,
        this.lines,
        this.version,
        this.ranges,
        (error) => {
          if (error != null) {
            throw error
          }
          return done()
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
      return DocstoreClient.deleteDoc(
        this.project_id,
        this.doc_id,
        (error, res, doc) => {
          this.res = res
          return done()
        }
      )
    })

    afterEach(function (done) {
      return db.docs.remove({ _id: this.doc_id }, done)
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
      return db.docs.find({ _id: this.doc_id }).toArray((error, docs) => {
        docs[0]._id.should.deep.equal(this.doc_id)
        docs[0].lines.should.deep.equal(this.lines)
        docs[0].deleted.should.equal(true)
        return done()
      })
    })

    it('should not export the doc to s3', function (done) {
      setTimeout(() => {
        DocstoreClient.getS3Doc(this.project_id, this.doc_id, (error) => {
          expect(error).to.be.instanceOf(Errors.NotFoundError)
          done()
        })
      }, 1000)
    })
  })

  describe('when archiveOnSoftDelete is enabled', function () {
    let archiveOnSoftDelete
    beforeEach(function overwriteSetting() {
      archiveOnSoftDelete = Settings.docstore.archiveOnSoftDelete
      Settings.docstore.archiveOnSoftDelete = true
    })
    afterEach(function restoreSetting() {
      Settings.docstore.archiveOnSoftDelete = archiveOnSoftDelete
    })

    beforeEach(function deleteDoc(done) {
      DocstoreClient.deleteDoc(this.project_id, this.doc_id, (error, res) => {
        this.res = res
        done()
      })
    })

    beforeEach(function waitForBackgroundFlush(done) {
      setTimeout(done, 500)
    })

    afterEach(function cleanupDoc(done) {
      db.docs.remove({ _id: this.doc_id }, done)
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
      DocstoreClient.getS3Doc(this.project_id, this.doc_id, (error, s3_doc) => {
        if (error) {
          return done(error)
        }
        expect(s3_doc.lines).to.deep.equal(this.lines)
        expect(s3_doc.ranges).to.deep.equal(this.ranges)
        done()
      })
    })
  })

  describe('when the doc exists in another project', function () {
    const otherProjectId = ObjectId()

    it('should show as not existing on /deleted', function (done) {
      DocstoreClient.isDocDeleted(otherProjectId, this.doc_id, (error, res) => {
        if (error) return done(error)
        expect(res.statusCode).to.equal(404)
        done()
      })
    })

    it('should return a 404 when trying to delete', function (done) {
      DocstoreClient.deleteDoc(otherProjectId, this.doc_id, (error, res) => {
        if (error) return done(error)
        expect(res.statusCode).to.equal(404)
        done()
      })
    })
  })

  return describe('when the doc does not exist', function () {
    it('should show as not existing on /deleted', function (done) {
      const missing_doc_id = ObjectId()
      DocstoreClient.isDocDeleted(
        this.project_id,
        missing_doc_id,
        (error, res) => {
          if (error) return done(error)
          expect(res.statusCode).to.equal(404)
          done()
        }
      )
    })

    return it('should return a 404', function (done) {
      const missing_doc_id = ObjectId()
      return DocstoreClient.deleteDoc(
        this.project_id,
        missing_doc_id,
        (error, res, doc) => {
          res.statusCode.should.equal(404)
          return done()
        }
      )
    })
  })
})

describe("Destroying a project's documents", function () {
  describe('when the doc exists', function () {
    beforeEach(function (done) {
      return db.docOps.insert(
        { doc_id: ObjectId(this.doc_id), version: 1 },
        function (err) {
          if (err != null) {
            return done(err)
          }
          return DocstoreClient.destroyAllDoc(this.project_id, done)
        }
      )
    })

    it('should remove the doc from the docs collection', function (done) {
      return db.docs.find({ _id: this.doc_id }).toArray((err, docs) => {
        expect(err).not.to.exist
        expect(docs).to.deep.equal([])
        return done()
      })
    })

    return it('should remove the docOps from the docOps collection', function (done) {
      return db.docOps.find({ doc_id: this.doc_id }).toArray((err, docOps) => {
        expect(err).not.to.exist
        expect(docOps).to.deep.equal([])
        return done()
      })
    })
  })

  return describe('when the doc is archived', function () {
    beforeEach(function (done) {
      return DocstoreClient.archiveAllDoc(this.project_id, (err) => {
        if (err != null) {
          return done(err)
        }
        return DocstoreClient.destroyAllDoc(this.project_id, done)
      })
    })

    it('should remove the doc from the docs collection', function (done) {
      return db.docs.find({ _id: this.doc_id }).toArray((err, docs) => {
        expect(err).not.to.exist
        expect(docs).to.deep.equal([])
        return done()
      })
    })

    it('should remove the docOps from the docOps collection', function (done) {
      return db.docOps.find({ doc_id: this.doc_id }).toArray((err, docOps) => {
        expect(err).not.to.exist
        expect(docOps).to.deep.equal([])
        return done()
      })
    })

    return it('should remove the doc contents from s3', function (done) {
      return DocstoreClient.getS3Doc(this.project_id, this.doc_id, (error) => {
        expect(error).to.be.instanceOf(Errors.NotFoundError)
        done()
      })
    })
  })
})
