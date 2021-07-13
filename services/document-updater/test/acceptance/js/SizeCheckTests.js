const { expect } = require('chai')
const Settings = require('@overleaf/settings')

const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')

describe('SizeChecks', function () {
  before(function (done) {
    DocUpdaterApp.ensureRunning(done)
  })
  beforeEach(function () {
    this.version = 0
    this.update = {
      doc: this.doc_id,
      op: [
        {
          i: 'insert some more lines that will bring it above the limit\n',
          p: 42,
        },
      ],
      v: this.version,
    }
    this.project_id = DocUpdaterClient.randomId()
    this.doc_id = DocUpdaterClient.randomId()
  })

  describe('when a doc is above the doc size limit already', function () {
    beforeEach(function () {
      this.lines = ['0123456789'.repeat(Settings.max_doc_length / 10 + 1)]
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        v: this.version,
      })
    })

    it('should error when fetching the doc', function (done) {
      DocUpdaterClient.getDoc(this.project_id, this.doc_id, (error, res) => {
        if (error) return done(error)
        expect(res.statusCode).to.equal(500)
        done()
      })
    })

    describe('when trying to update', function () {
      beforeEach(function (done) {
        const update = {
          doc: this.doc_id,
          op: this.update.op,
          v: this.version,
        }
        DocUpdaterClient.sendUpdate(
          this.project_id,
          this.doc_id,
          update,
          error => {
            if (error != null) {
              throw error
            }
            setTimeout(done, 200)
          }
        )
      })

      it('should still error when fetching the doc', function (done) {
        DocUpdaterClient.getDoc(this.project_id, this.doc_id, (error, res) => {
          if (error) return done(error)
          expect(res.statusCode).to.equal(500)
          done()
        })
      })
    })
  })

  describe('when a doc is just below the doc size limit', function () {
    beforeEach(function () {
      this.lines = ['0123456789'.repeat(Settings.max_doc_length / 10 - 1)]
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        v: this.version,
      })
    })

    it('should be able to fetch the doc', function (done) {
      DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id,
        (error, res, doc) => {
          if (error) return done(error)
          expect(doc.lines).to.deep.equal(this.lines)
          done()
        }
      )
    })

    describe('when trying to update', function () {
      beforeEach(function (done) {
        const update = {
          doc: this.doc_id,
          op: this.update.op,
          v: this.version,
        }
        DocUpdaterClient.sendUpdate(
          this.project_id,
          this.doc_id,
          update,
          error => {
            if (error != null) {
              throw error
            }
            setTimeout(done, 200)
          }
        )
      })

      it('should not update the doc', function (done) {
        DocUpdaterClient.getDoc(
          this.project_id,
          this.doc_id,
          (error, res, doc) => {
            if (error) return done(error)
            expect(doc.lines).to.deep.equal(this.lines)
            done()
          }
        )
      })
    })
  })
})
