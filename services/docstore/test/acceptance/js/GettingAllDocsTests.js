/* eslint-disable
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
const { ObjectId } = require('mongodb-legacy')
const async = require('async')
const DocstoreApp = require('./helpers/DocstoreApp')

const DocstoreClient = require('./helpers/DocstoreClient')

describe('Getting all docs', function () {
  beforeEach(function (done) {
    this.project_id = new ObjectId()
    this.threadId1 = new ObjectId().toString()
    this.threadId2 = new ObjectId().toString()
    this.docs = [
      {
        _id: new ObjectId(),
        lines: ['one', 'two', 'three'],
        ranges: {
          comments: [
            { id: new ObjectId().toString(), op: { t: this.threadId1 } },
          ],
          changes: [
            {
              id: new ObjectId().toString(),
              metadata: { user_id: 'user-id-1' },
            },
          ],
        },
        rev: 2,
      },
      {
        _id: new ObjectId(),
        lines: ['aaa', 'bbb', 'ccc'],
        ranges: {
          changes: [
            {
              id: new ObjectId().toString(),
              metadata: { user_id: 'user-id-2' },
            },
          ],
        },
        rev: 4,
      },
      {
        _id: new ObjectId(),
        lines: ['111', '222', '333'],
        ranges: {
          comments: [
            { id: new ObjectId().toString(), op: { t: this.threadId2 } },
          ],
          changes: [
            {
              id: new ObjectId().toString(),
              metadata: { user_id: 'anonymous-user' },
            },
          ],
        },
        rev: 6,
      },
    ]
    this.fixedRanges = this.docs.map(doc => {
      if (!doc.ranges?.comments?.length) return doc.ranges
      return {
        ...doc.ranges,
        comments: [
          { ...doc.ranges.comments[0], id: doc.ranges.comments[0].op.t },
        ],
      }
    })
    this.deleted_doc = {
      _id: new ObjectId(),
      lines: ['deleted'],
      ranges: {
        comments: [{ id: new ObjectId().toString(), op: { t: 'thread-id-3' } }],
        changes: [
          { id: new ObjectId().toString(), metadata: { user_id: 'user-id-3' } },
        ],
      },
      rev: 8,
    }
    const version = 42
    const jobs = Array.from(this.docs).map(doc =>
      (doc => {
        return callback => {
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
    jobs.push(cb => {
      return DocstoreClient.createDoc(
        this.project_id,
        this.deleted_doc._id,
        this.deleted_doc.lines,
        version,
        this.deleted_doc.ranges,
        err => {
          if (err) return done(err)
          return DocstoreClient.deleteDoc(
            this.project_id,
            this.deleted_doc._id,
            cb
          )
        }
      )
    })
    jobs.unshift(cb => DocstoreApp.ensureRunning(cb))
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

  it('getAllRanges should return all the (non-deleted) doc ranges', function (done) {
    return DocstoreClient.getAllRanges(this.project_id, (error, res, docs) => {
      if (error != null) {
        throw error
      }
      docs.length.should.equal(this.docs.length)
      for (let i = 0; i < docs.length; i++) {
        const doc = docs[i]
        doc.ranges.should.deep.equal(this.fixedRanges[i])
      }
      return done()
    })
  })

  it('getTrackedChangesUserIds should return all the user ids from (non-deleted) ranges', function (done) {
    DocstoreClient.getTrackedChangesUserIds(
      this.project_id,
      (error, res, userIds) => {
        if (error != null) {
          throw error
        }
        userIds.should.deep.equal(['user-id-1', 'user-id-2'])
        done()
      }
    )
  })

  it('getCommentThreadIds should return all the thread ids from (non-deleted) ranges', function (done) {
    DocstoreClient.getCommentThreadIds(
      this.project_id,
      (error, res, threadIds) => {
        if (error != null) {
          throw error
        }
        threadIds.should.deep.equal({
          [this.docs[0]._id.toString()]: [this.threadId1],
          [this.docs[2]._id.toString()]: [this.threadId2],
        })
        done()
      }
    )
  })
})
