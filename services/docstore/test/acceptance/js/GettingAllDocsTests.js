import mongodb from 'mongodb-legacy'
import async from 'async'
import DocstoreApp from './helpers/DocstoreApp.js'
import { callbackify } from 'node:util'
import DocstoreClient from './helpers/DocstoreClient.js'

const { ObjectId } = mongodb

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
    const jobs = this.docs.map(doc =>
      (
        doc => callback =>
          callbackify(DocstoreClient.createDoc)(
            this.project_id,
            doc._id,
            doc.lines,
            version,
            doc.ranges,
            callback
          )
      )(doc)
    )
    jobs.push(cb =>
      callbackify(DocstoreClient.createDoc)(
        this.project_id,
        this.deleted_doc._id,
        this.deleted_doc.lines,
        version,
        this.deleted_doc.ranges,
        err => {
          if (err) return done(err)
          callbackify(DocstoreClient.deleteDoc)(
            this.project_id,
            this.deleted_doc._id,
            cb
          )
        }
      )
    )
    jobs.unshift(cb => callbackify(DocstoreApp.ensureRunning)(cb))
    async.series(jobs, done)
  })

  it('getAllDocs should return all the (non-deleted) docs', async function () {
    const docs = await DocstoreClient.getAllDocs(this.project_id)
    docs.length.should.equal(this.docs.length)
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i]
      doc.lines.should.deep.equal(this.docs[i].lines)
    }
  })

  it('getAllRanges should return all the (non-deleted) doc ranges', async function () {
    const docs = await DocstoreClient.getAllRanges(this.project_id)
    docs.length.should.equal(this.docs.length)
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i]
      doc.ranges.should.deep.equal(this.fixedRanges[i])
    }
  })

  it('getTrackedChangesUserIds should return all the user ids from (non-deleted) ranges', async function () {
    const userIds = await DocstoreClient.getTrackedChangesUserIds(
      this.project_id
    )
    userIds.should.deep.equal(['user-id-1', 'user-id-2'])
  })

  it('getCommentThreadIds should return all the thread ids from (non-deleted) ranges', async function () {
    const threadIds = await DocstoreClient.getCommentThreadIds(this.project_id)
    threadIds.should.deep.equal({
      [this.docs[0]._id.toString()]: [this.threadId1],
      [this.docs[2]._id.toString()]: [this.threadId2],
    })
  })
})
