/* eslint-disable
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
const sinon = require('sinon')
const { expect } = require('chai')

const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')

describe('Getting documents for project', function () {
  before(function (done) {
    this.lines = ['one', 'two', 'three']
    this.version = 42
    return DocUpdaterApp.ensureRunning(done)
  })

  describe('when project state hash does not match', function () {
    before(function (done) {
      this.projectStateHash = DocUpdaterClient.randomId()
      ;[this.project_id, this.doc_id] = Array.from([
        DocUpdaterClient.randomId(),
        DocUpdaterClient.randomId(),
      ])

      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
      })
      return DocUpdaterClient.preloadDoc(
        this.project_id,
        this.doc_id,
        error => {
          if (error != null) {
            throw error
          }
          return DocUpdaterClient.getProjectDocs(
            this.project_id,
            this.projectStateHash,
            (error, res, returnedDocs) => {
              this.res = res
              this.returnedDocs = returnedDocs
              return done()
            }
          )
        }
      )
    })

    return it('should return a 409 Conflict response', function () {
      return this.res.statusCode.should.equal(409)
    })
  })

  describe('when project state hash matches', function () {
    before(function (done) {
      this.projectStateHash = DocUpdaterClient.randomId()
      ;[this.project_id, this.doc_id] = Array.from([
        DocUpdaterClient.randomId(),
        DocUpdaterClient.randomId(),
      ])

      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
      })
      return DocUpdaterClient.preloadDoc(
        this.project_id,
        this.doc_id,
        error => {
          if (error != null) {
            throw error
          }
          return DocUpdaterClient.getProjectDocs(
            this.project_id,
            this.projectStateHash,
            (error, res0, returnedDocs0) => {
              // set the hash
              this.res0 = res0
              this.returnedDocs0 = returnedDocs0
              return DocUpdaterClient.getProjectDocs(
                this.project_id,
                this.projectStateHash,
                (error, res, returnedDocs) => {
                  // the hash should now match
                  this.res = res
                  this.returnedDocs = returnedDocs
                  return done()
                }
              )
            }
          )
        }
      )
    })

    it('should return a 200 response', function () {
      return this.res.statusCode.should.equal(200)
    })

    return it('should return the documents', function () {
      return this.returnedDocs.should.deep.equal([
        { _id: this.doc_id, lines: this.lines, v: this.version },
      ])
    })
  })

  return describe('when the doc has been removed', function () {
    before(function (done) {
      this.projectStateHash = DocUpdaterClient.randomId()
      ;[this.project_id, this.doc_id] = Array.from([
        DocUpdaterClient.randomId(),
        DocUpdaterClient.randomId(),
      ])

      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
      })
      return DocUpdaterClient.preloadDoc(
        this.project_id,
        this.doc_id,
        error => {
          if (error != null) {
            throw error
          }
          return DocUpdaterClient.getProjectDocs(
            this.project_id,
            this.projectStateHash,
            (error, res0, returnedDocs0) => {
              // set the hash
              this.res0 = res0
              this.returnedDocs0 = returnedDocs0
              return DocUpdaterClient.deleteDoc(
                this.project_id,
                this.doc_id,
                (error, res, body) => {
                  // delete the doc
                  return DocUpdaterClient.getProjectDocs(
                    this.project_id,
                    this.projectStateHash,
                    (error, res1, returnedDocs) => {
                      // the hash would match, but the doc has been deleted
                      this.res = res1
                      this.returnedDocs = returnedDocs
                      return done()
                    }
                  )
                }
              )
            }
          )
        }
      )
    })

    return it('should return a 409 Conflict response', function () {
      return this.res.statusCode.should.equal(409)
    })
  })
})
