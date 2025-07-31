/* eslint-disable
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
const sinon = require('sinon')
const { ObjectId } = require('mongodb-legacy')
const DocstoreApp = require('./helpers/DocstoreApp')

const DocstoreClient = require('./helpers/DocstoreClient')

describe('Getting a doc', function () {
  beforeEach(function (done) {
    this.project_id = new ObjectId()
    this.doc_id = new ObjectId()
    this.lines = ['original', 'lines']
    this.version = 42
    this.ranges = {
      changes: [
        {
          id: new ObjectId().toString(),
          op: { i: 'foo', p: 3 },
          meta: {
            user_id: new ObjectId().toString(),
            ts: new Date().toJSON(),
          },
        },
      ],
      comments: [
        {
          id: new ObjectId().toString(),
          op: { c: 'comment', p: 1, t: new ObjectId().toString() },
          metadata: {
            user_id: new ObjectId().toString(),
            ts: new Date().toJSON(),
          },
        },
      ],
    }
    this.fixedRanges = {
      ...this.ranges,
      comments: [
        { ...this.ranges.comments[0], id: this.ranges.comments[0].op.t },
      ],
    }
    return DocstoreApp.ensureRunning(() => {
      return DocstoreClient.createDoc(
        this.project_id,
        this.doc_id,
        this.lines,
        this.version,
        this.ranges,
        error => {
          if (error != null) {
            throw error
          }
          return done()
        }
      )
    })
  })

  describe('when the doc exists', function () {
    return it('should get the doc lines and version', function (done) {
      return DocstoreClient.getDoc(
        this.project_id,
        this.doc_id,
        {},
        (error, res, doc) => {
          if (error) return done(error)
          doc.lines.should.deep.equal(this.lines)
          doc.version.should.equal(this.version)
          doc.ranges.should.deep.equal(this.fixedRanges)
          return done()
        }
      )
    })
  })

  describe('when the doc does not exist', function () {
    return it('should return a 404', function (done) {
      const missingDocId = new ObjectId()
      return DocstoreClient.getDoc(
        this.project_id,
        missingDocId,
        {},
        (error, res, doc) => {
          if (error) return done(error)
          res.statusCode.should.equal(404)
          return done()
        }
      )
    })
  })

  return describe('when the doc is a deleted doc', function () {
    beforeEach(function (done) {
      this.deleted_doc_id = new ObjectId()
      return DocstoreClient.createDoc(
        this.project_id,
        this.deleted_doc_id,
        this.lines,
        this.version,
        this.ranges,
        error => {
          if (error != null) {
            throw error
          }
          return DocstoreClient.deleteDoc(
            this.project_id,
            this.deleted_doc_id,
            done
          )
        }
      )
    })

    it('should return the doc', function (done) {
      return DocstoreClient.getDoc(
        this.project_id,
        this.deleted_doc_id,
        { include_deleted: true },
        (error, res, doc) => {
          if (error) return done(error)
          doc.lines.should.deep.equal(this.lines)
          doc.version.should.equal(this.version)
          doc.ranges.should.deep.equal(this.fixedRanges)
          doc.deleted.should.equal(true)
          return done()
        }
      )
    })

    return it('should return a 404 when the query string is not set', function (done) {
      return DocstoreClient.getDoc(
        this.project_id,
        this.deleted_doc_id,
        {},
        (error, res, doc) => {
          if (error) return done(error)
          res.statusCode.should.equal(404)
          return done()
        }
      )
    })
  })
})
