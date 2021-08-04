const Settings = require('@overleaf/settings')
const { ObjectId } = require('../../../app/js/mongodb')
const DocstoreApp = require('./helpers/DocstoreApp')
const DocstoreClient = require('./helpers/DocstoreClient')
const { Storage } = require('@google-cloud/storage')

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
