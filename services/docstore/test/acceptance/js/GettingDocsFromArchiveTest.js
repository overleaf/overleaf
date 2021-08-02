/* eslint-disable
    camelcase,
    handle-callback-err,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
process.env.BACKEND = 'gcs'
const Settings = require('@overleaf/settings')
const { expect } = require('chai')
const { db, ObjectId } = require('../../../app/js/mongodb')
const async = require('async')
const DocstoreApp = require('./helpers/DocstoreApp')
const DocstoreClient = require('./helpers/DocstoreClient')
const { Storage } = require('@google-cloud/storage')
const Persistor = require('../../../app/js/PersistorManager')
const Streamifier = require('streamifier')

function uploadContent(path, json, callback) {
  const stream = Streamifier.createReadStream(JSON.stringify(json))
  Persistor.sendStream(Settings.docstore.bucket, path, stream)
    .then(() => callback())
    .catch(callback)
}

describe('Getting A Doc from Archive', function () {
  before(function (done) {
    return DocstoreApp.ensureRunning(done)
  })

  before(async function () {
    const storage = new Storage(Settings.docstore.gcs.endpoint)
    await storage.createBucket(Settings.docstore.bucket)
    await storage.createBucket(`${Settings.docstore.bucket}-deleted`)
  })

  describe('for an archived doc', function () {
    before(function (done) {
      this.project_id = ObjectId()
      this.timeout(1000 * 30)
      this.doc = {
        _id: ObjectId(),
        lines: ['foo', 'bar'],
        ranges: {},
        version: 2,
      }
      DocstoreClient.createDoc(
        this.project_id,
        this.doc._id,
        this.doc.lines,
        this.doc.version,
        this.doc.ranges,
        error => {
          if (error) {
            return done(error)
          }
          DocstoreClient.archiveDocById(
            this.project_id,
            this.doc._id,
            (error, res) => {
              this.res = res
              if (error) {
                return done(error)
              }
              done()
            }
          )
        }
      )
    })

    it('should successully archive the doc', function (done) {
      this.res.statusCode.should.equal(204)
      done()
    })

    it('should return the doc lines and version from persistent storage', function (done) {
      return DocstoreClient.peekDoc(
        this.project_id,
        this.doc._id,
        {},
        (error, res, doc) => {
          res.statusCode.should.equal(200)
          res.headers['x-doc-status'].should.equal('archived')
          doc.lines.should.deep.equal(this.doc.lines)
          doc.version.should.equal(this.doc.version)
          doc.ranges.should.deep.equal(this.doc.ranges)
          return done()
        }
      )
    })

    it('should return the doc lines and version from persistent storage on subsequent requests', function (done) {
      return DocstoreClient.peekDoc(
        this.project_id,
        this.doc._id,
        {},
        (error, res, doc) => {
          res.statusCode.should.equal(200)
          res.headers['x-doc-status'].should.equal('archived')
          doc.lines.should.deep.equal(this.doc.lines)
          doc.version.should.equal(this.doc.version)
          doc.ranges.should.deep.equal(this.doc.ranges)
          return done()
        }
      )
    })

    describe('for an non-archived doc', function () {
      before(function (done) {
        this.project_id = ObjectId()
        this.timeout(1000 * 30)
        this.doc = {
          _id: ObjectId(),
          lines: ['foo', 'bar'],
          ranges: {},
          version: 2,
        }
        DocstoreClient.createDoc(
          this.project_id,
          this.doc._id,
          this.doc.lines,
          this.doc.version,
          this.doc.ranges,
          done
        )
      })

      it('should return the doc lines and version from mongo', function (done) {
        return DocstoreClient.peekDoc(
          this.project_id,
          this.doc._id,
          {},
          (error, res, doc) => {
            res.statusCode.should.equal(200)
            res.headers['x-doc-status'].should.equal('active')
            doc.lines.should.deep.equal(this.doc.lines)
            doc.version.should.equal(this.doc.version)
            doc.ranges.should.deep.equal(this.doc.ranges)
            return done()
          }
        )
      })
    })
  })
})
