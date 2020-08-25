/* eslint-disable
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

describe('Applying updates to a doc', function () {
  beforeEach(function (done) {
    this.project_id = ObjectId()
    this.doc_id = ObjectId()
    this.originalLines = ['original', 'lines']
    this.newLines = ['new', 'lines']
    this.originalRanges = {
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
    this.newRanges = {
      changes: [
        {
          id: ObjectId().toString(),
          op: { i: 'bar', p: 6 },
          meta: {
            user_id: ObjectId().toString(),
            ts: new Date().toString()
          }
        }
      ]
    }
    this.version = 42
    return DocstoreApp.ensureRunning(() => {
      return DocstoreClient.createDoc(
        this.project_id,
        this.doc_id,
        this.originalLines,
        this.version,
        this.originalRanges,
        (error) => {
          if (error != null) {
            throw error
          }
          return done()
        }
      )
    })
  })

  describe('when nothing has been updated', function () {
    beforeEach(function (done) {
      return DocstoreClient.updateDoc(
        this.project_id,
        this.doc_id,
        this.originalLines,
        this.version,
        this.originalRanges,
        (error, res, body) => {
          this.body = body
          return done()
        }
      )
    })

    it('should return modified = false', function () {
      return this.body.modified.should.equal(false)
    })

    return it('should not update the doc in the API', function (done) {
      return DocstoreClient.getDoc(
        this.project_id,
        this.doc_id,
        {},
        (error, res, doc) => {
          doc.lines.should.deep.equal(this.originalLines)
          doc.version.should.equal(this.version)
          doc.ranges.should.deep.equal(this.originalRanges)
          return done()
        }
      )
    })
  })

  describe('when the lines have changed', function () {
    beforeEach(function (done) {
      return DocstoreClient.updateDoc(
        this.project_id,
        this.doc_id,
        this.newLines,
        this.version,
        this.originalRanges,
        (error, res, body) => {
          this.body = body
          return done()
        }
      )
    })

    it('should return modified = true', function () {
      return this.body.modified.should.equal(true)
    })

    it('should return the rev', function () {
      return this.body.rev.should.equal(2)
    })

    return it('should update the doc in the API', function (done) {
      return DocstoreClient.getDoc(
        this.project_id,
        this.doc_id,
        {},
        (error, res, doc) => {
          doc.lines.should.deep.equal(this.newLines)
          doc.version.should.equal(this.version)
          doc.ranges.should.deep.equal(this.originalRanges)
          return done()
        }
      )
    })
  })

  describe('when the version has changed', function () {
    beforeEach(function (done) {
      return DocstoreClient.updateDoc(
        this.project_id,
        this.doc_id,
        this.originalLines,
        this.version + 1,
        this.originalRanges,
        (error, res, body) => {
          this.body = body
          return done()
        }
      )
    })

    it('should return modified = true', function () {
      return this.body.modified.should.equal(true)
    })

    it('should return the rev', function () {
      return this.body.rev.should.equal(1)
    })

    return it('should update the doc in the API', function (done) {
      return DocstoreClient.getDoc(
        this.project_id,
        this.doc_id,
        {},
        (error, res, doc) => {
          doc.lines.should.deep.equal(this.originalLines)
          doc.version.should.equal(this.version + 1)
          doc.ranges.should.deep.equal(this.originalRanges)
          return done()
        }
      )
    })
  })

  describe('when the ranges have changed', function () {
    beforeEach(function (done) {
      return DocstoreClient.updateDoc(
        this.project_id,
        this.doc_id,
        this.originalLines,
        this.version,
        this.newRanges,
        (error, res, body) => {
          this.body = body
          return done()
        }
      )
    })

    it('should return modified = true', function () {
      return this.body.modified.should.equal(true)
    })

    it('should return the rev', function () {
      return this.body.rev.should.equal(2)
    })

    return it('should update the doc in the API', function (done) {
      return DocstoreClient.getDoc(
        this.project_id,
        this.doc_id,
        {},
        (error, res, doc) => {
          doc.lines.should.deep.equal(this.originalLines)
          doc.version.should.equal(this.version)
          doc.ranges.should.deep.equal(this.newRanges)
          return done()
        }
      )
    })
  })

  describe('when the doc does not exist', function () {
    beforeEach(function (done) {
      this.missing_doc_id = ObjectId()
      return DocstoreClient.updateDoc(
        this.project_id,
        this.missing_doc_id,
        this.originalLines,
        0,
        this.originalRanges,
        (error, res, body) => {
          this.res = res
          this.body = body
          return done()
        }
      )
    })

    it('should create the doc', function () {
      return this.body.rev.should.equal(1)
    })

    return it('should be retreivable', function (done) {
      return DocstoreClient.getDoc(
        this.project_id,
        this.missing_doc_id,
        {},
        (error, res, doc) => {
          doc.lines.should.deep.equal(this.originalLines)
          doc.version.should.equal(0)
          doc.ranges.should.deep.equal(this.originalRanges)
          return done()
        }
      )
    })
  })

  describe('when malformed doc lines are provided', function () {
    describe('when the lines are not an array', function () {
      beforeEach(function (done) {
        return DocstoreClient.updateDoc(
          this.project_id,
          this.doc_id,
          { foo: 'bar' },
          this.version,
          this.originalRanges,
          (error, res, body) => {
            this.res = res
            this.body = body
            return done()
          }
        )
      })

      it('should return 400', function () {
        return this.res.statusCode.should.equal(400)
      })

      return it('should not update the doc in the API', function (done) {
        return DocstoreClient.getDoc(
          this.project_id,
          this.doc_id,
          {},
          (error, res, doc) => {
            doc.lines.should.deep.equal(this.originalLines)
            return done()
          }
        )
      })
    })

    return describe('when the lines are not present', function () {
      beforeEach(function (done) {
        return DocstoreClient.updateDoc(
          this.project_id,
          this.doc_id,
          null,
          this.version,
          this.originalRanges,
          (error, res, body) => {
            this.res = res
            this.body = body
            return done()
          }
        )
      })

      it('should return 400', function () {
        return this.res.statusCode.should.equal(400)
      })

      return it('should not update the doc in the API', function (done) {
        return DocstoreClient.getDoc(
          this.project_id,
          this.doc_id,
          {},
          (error, res, doc) => {
            doc.lines.should.deep.equal(this.originalLines)
            return done()
          }
        )
      })
    })
  })

  describe('when no version is provided', function () {
    beforeEach(function (done) {
      return DocstoreClient.updateDoc(
        this.project_id,
        this.doc_id,
        this.originalLines,
        null,
        this.originalRanges,
        (error, res, body) => {
          this.res = res
          this.body = body
          return done()
        }
      )
    })

    it('should return 400', function () {
      return this.res.statusCode.should.equal(400)
    })

    return it('should not update the doc in the API', function (done) {
      return DocstoreClient.getDoc(
        this.project_id,
        this.doc_id,
        {},
        (error, res, doc) => {
          doc.lines.should.deep.equal(this.originalLines)
          doc.version.should.equal(this.version)
          return done()
        }
      )
    })
  })

  describe('when the content is large', function () {
    beforeEach(function (done) {
      const line = new Array(1025).join('x') // 1kb
      this.largeLines = Array.apply(null, Array(1024)).map(() => line) // 1mb
      return DocstoreClient.updateDoc(
        this.project_id,
        this.doc_id,
        this.largeLines,
        this.version,
        this.originalRanges,
        (error, res, body) => {
          this.body = body
          return done()
        }
      )
    })

    it('should return modified = true', function () {
      return this.body.modified.should.equal(true)
    })

    return it('should update the doc in the API', function (done) {
      return DocstoreClient.getDoc(
        this.project_id,
        this.doc_id,
        {},
        (error, res, doc) => {
          doc.lines.should.deep.equal(this.largeLines)
          return done()
        }
      )
    })
  })

  describe('when there is a large json payload', function () {
    beforeEach(function (done) {
      const line = new Array(1025).join('x') // 1kb
      this.largeLines = Array.apply(null, Array(1024)).map(() => line) // 1kb
      this.originalRanges.padding = Array.apply(null, Array(2049)).map(
        () => line
      ) // 2mb + 1kb
      return DocstoreClient.updateDoc(
        this.project_id,
        this.doc_id,
        this.largeLines,
        this.version,
        this.originalRanges,
        (error, res, body) => {
          this.res = res
          this.body = body
          return done()
        }
      )
    })

    it('should return modified = true', function () {
      return this.body.modified.should.equal(true)
    })

    return it('should update the doc in the API', function (done) {
      return DocstoreClient.getDoc(
        this.project_id,
        this.doc_id,
        {},
        (error, res, doc) => {
          doc.lines.should.deep.equal(this.largeLines)
          return done()
        }
      )
    })
  })

  describe('when the document body is too large', function () {
    beforeEach(function (done) {
      const line = new Array(1025).join('x') // 1kb
      this.largeLines = Array.apply(null, Array(2049)).map(() => line) // 2mb + 1kb
      return DocstoreClient.updateDoc(
        this.project_id,
        this.doc_id,
        this.largeLines,
        this.version,
        this.originalRanges,
        (error, res, body) => {
          this.res = res
          this.body = body
          return done()
        }
      )
    })

    it('should return 413', function () {
      return this.res.statusCode.should.equal(413)
    })

    it('should report body too large', function () {
      return this.res.body.should.equal('document body too large')
    })

    return it('should not update the doc in the API', function (done) {
      return DocstoreClient.getDoc(
        this.project_id,
        this.doc_id,
        {},
        (error, res, doc) => {
          doc.lines.should.deep.equal(this.originalLines)
          return done()
        }
      )
    })
  })

  return describe('when the json payload is too large', function () {
    beforeEach(function (done) {
      const line = new Array(1025).join('x') // 1kb
      this.largeLines = Array.apply(null, Array(1024)).map(() => line) // 1kb
      this.originalRanges.padding = Array.apply(null, Array(4096)).map(
        () => line
      ) // 4mb
      return DocstoreClient.updateDoc(
        this.project_id,
        this.doc_id,
        this.largeLines,
        this.version,
        this.originalRanges,
        (error, res, body) => {
          this.res = res
          this.body = body
          return done()
        }
      )
    })

    return it('should not update the doc in the API', function (done) {
      return DocstoreClient.getDoc(
        this.project_id,
        this.doc_id,
        {},
        (error, res, doc) => {
          doc.lines.should.deep.equal(this.originalLines)
          return done()
        }
      )
    })
  })
})
