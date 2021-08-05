/* eslint-disable
    camelcase,
    handle-callback-err,
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
const async = require('async')

const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')

describe('Flushing a project', function () {
  before(function (done) {
    let doc_id0, doc_id1
    this.project_id = DocUpdaterClient.randomId()
    this.docs = [
      {
        id: (doc_id0 = DocUpdaterClient.randomId()),
        lines: ['one', 'two', 'three'],
        update: {
          doc: doc_id0,
          op: [
            {
              i: 'one and a half\n',
              p: 4,
            },
          ],
          v: 0,
        },
        updatedLines: ['one', 'one and a half', 'two', 'three'],
      },
      {
        id: (doc_id1 = DocUpdaterClient.randomId()),
        lines: ['four', 'five', 'six'],
        update: {
          doc: doc_id1,
          op: [
            {
              i: 'four and a half\n',
              p: 5,
            },
          ],
          v: 0,
        },
        updatedLines: ['four', 'four and a half', 'five', 'six'],
      },
    ]
    for (const doc of Array.from(this.docs)) {
      MockWebApi.insertDoc(this.project_id, doc.id, {
        lines: doc.lines,
        version: doc.update.v,
      })
    }
    return DocUpdaterApp.ensureRunning(done)
  })

  return describe('with documents which have been updated', function () {
    before(function (done) {
      sinon.spy(MockWebApi, 'setDocument')

      return async.series(
        this.docs.map(doc => {
          return callback => {
            return DocUpdaterClient.preloadDoc(
              this.project_id,
              doc.id,
              error => {
                if (error != null) {
                  return callback(error)
                }
                return DocUpdaterClient.sendUpdate(
                  this.project_id,
                  doc.id,
                  doc.update,
                  error => {
                    return callback(error)
                  }
                )
              }
            )
          }
        }),
        error => {
          if (error != null) {
            throw error
          }
          return setTimeout(() => {
            return DocUpdaterClient.flushProject(
              this.project_id,
              (error, res, body) => {
                this.statusCode = res.statusCode
                return done()
              }
            )
          }, 200)
        }
      )
    })

    after(function () {
      return MockWebApi.setDocument.restore()
    })

    it('should return a 204 status code', function () {
      return this.statusCode.should.equal(204)
    })

    it('should send each document to the web api', function () {
      return Array.from(this.docs).map(doc =>
        MockWebApi.setDocument
          .calledWith(this.project_id, doc.id, doc.updatedLines)
          .should.equal(true)
      )
    })

    return it('should update the lines in the doc updater', function (done) {
      return async.series(
        this.docs.map(doc => {
          return callback => {
            return DocUpdaterClient.getDoc(
              this.project_id,
              doc.id,
              (error, res, returnedDoc) => {
                returnedDoc.lines.should.deep.equal(doc.updatedLines)
                return callback()
              }
            )
          }
        }),
        done
      )
    })
  })
})
