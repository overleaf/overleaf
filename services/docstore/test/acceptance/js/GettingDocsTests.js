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
const sinon = require('sinon')
const chai = require('chai')
chai.should()
const { ObjectId } = require('mongodb')
const DocstoreApp = require('./helpers/DocstoreApp')

const DocstoreClient = require('./helpers/DocstoreClient')

describe('Getting a doc', function () {
  beforeEach(function (done) {
    this.project_id = ObjectId()
    this.doc_id = ObjectId()
    this.lines = ['original', 'lines']
    this.version = 42
    this.ranges = {
      changes: [
        {
          id: ObjectId().toString(),
          op: { i: 'foo', p: 3 },
          meta: {
            user_id: ObjectId().toString(),
            ts: new Date().toString()
          }
        }
      ]
    }
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

  describe('when the doc exists', function () {
    return it('should get the doc lines and version', function (done) {
      return DocstoreClient.getDoc(
        this.project_id,
        this.doc_id,
        {},
        (error, res, doc) => {
          doc.lines.should.deep.equal(this.lines)
          doc.version.should.equal(this.version)
          doc.ranges.should.deep.equal(this.ranges)
          return done()
        }
      )
    })
  })

  describe('when the doc does not exist', function () {
    return it('should return a 404', function (done) {
      const missing_doc_id = ObjectId()
      return DocstoreClient.getDoc(
        this.project_id,
        missing_doc_id,
        {},
        (error, res, doc) => {
          res.statusCode.should.equal(404)
          return done()
        }
      )
    })
  })

  return describe('when the doc is a deleted doc', function () {
    beforeEach(function (done) {
      this.deleted_doc_id = ObjectId()
      return DocstoreClient.createDoc(
        this.project_id,
        this.deleted_doc_id,
        this.lines,
        this.version,
        this.ranges,
        (error) => {
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
          doc.lines.should.deep.equal(this.lines)
          doc.version.should.equal(this.version)
          doc.ranges.should.deep.equal(this.ranges)
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
          res.statusCode.should.equal(404)
          return done()
        }
      )
    })
  })
})
