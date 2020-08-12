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
const chai = require('chai')
chai.should()
const { ObjectId } = require('mongojs')
const async = require('async')
const DocstoreApp = require('./helpers/DocstoreApp')

const DocstoreClient = require('./helpers/DocstoreClient')

describe('Getting all docs', function () {
  beforeEach(function (done) {
    this.project_id = ObjectId()
    this.docs = [
      {
        _id: ObjectId(),
        lines: ['one', 'two', 'three'],
        ranges: { mock: 'one' },
        rev: 2,
      },
      {
        _id: ObjectId(),
        lines: ['aaa', 'bbb', 'ccc'],
        ranges: { mock: 'two' },
        rev: 4,
      },
      {
        _id: ObjectId(),
        lines: ['111', '222', '333'],
        ranges: { mock: 'three' },
        rev: 6,
      },
    ]
    this.deleted_doc = {
      _id: ObjectId(),
      lines: ['deleted'],
      ranges: { mock: 'four' },
      rev: 8,
    }
    const version = 42
    const jobs = Array.from(this.docs).map((doc) =>
      ((doc) => {
        return (callback) => {
          return DocstoreClient.createDoc(
            this.project_id,
            doc._id,
            doc.lines,
            version,
            doc.ranges,
            callback
          )
        }
      })(doc)
    )
    jobs.push((cb) => {
      return DocstoreClient.createDoc(
        this.project_id,
        this.deleted_doc._id,
        this.deleted_doc.lines,
        version,
        this.deleted_doc.ranges,
        (err) => {
          return DocstoreClient.deleteDoc(
            this.project_id,
            this.deleted_doc._id,
            cb
          )
        }
      )
    })
    jobs.unshift((cb) => DocstoreApp.ensureRunning(cb))
    return async.series(jobs, done)
  })

  it('getAllDocs should return all the (non-deleted) docs', function (done) {
    return DocstoreClient.getAllDocs(this.project_id, (error, res, docs) => {
      if (error != null) {
        throw error
      }
      docs.length.should.equal(this.docs.length)
      for (let i = 0; i < docs.length; i++) {
        const doc = docs[i]
        doc.lines.should.deep.equal(this.docs[i].lines)
      }
      return done()
    })
  })

  return it('getAllRanges should return all the (non-deleted) doc ranges', function (done) {
    return DocstoreClient.getAllRanges(this.project_id, (error, res, docs) => {
      if (error != null) {
        throw error
      }
      docs.length.should.equal(this.docs.length)
      for (let i = 0; i < docs.length; i++) {
        const doc = docs[i]
        doc.ranges.should.deep.equal(this.docs[i].ranges)
      }
      return done()
    })
  })
})
