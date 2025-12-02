import mongodb from 'mongodb-legacy'
import { expect } from 'chai'
import DocstoreApp from './helpers/DocstoreApp.js'
import DocstoreClient from './helpers/DocstoreClient.js'

const { ObjectId } = mongodb

describe('Getting a doc', function () {
  beforeEach(async function () {
    this.project_id = new ObjectId()
    this.doc_id = new ObjectId()
    this.lines = ['original', 'lines']
    this.version = 42
    this.ranges = {
      changes: [
        {
          id: new ObjectId().toString(),
          op: { i: 'foo', p: 3 },
          meta: {
            user_id: new ObjectId().toString(),
            ts: new Date().toJSON(),
          },
        },
      ],
      comments: [
        {
          id: new ObjectId().toString(),
          op: { c: 'comment', p: 1, t: new ObjectId().toString() },
          metadata: {
            user_id: new ObjectId().toString(),
            ts: new Date().toJSON(),
          },
        },
      ],
    }
    this.fixedRanges = {
      ...this.ranges,
      comments: [
        { ...this.ranges.comments[0], id: this.ranges.comments[0].op.t },
      ],
    }
    await DocstoreApp.ensureRunning()
    await DocstoreClient.createDoc(
      this.project_id,
      this.doc_id,
      this.lines,
      this.version,
      this.ranges
    )
  })

  describe('when the doc exists', function () {
    it('should get the doc lines and version', async function () {
      const doc = await DocstoreClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(this.lines)
      doc.version.should.equal(this.version)
      doc.ranges.should.deep.equal(this.fixedRanges)
    })
  })

  describe('when the doc does not exist', function () {
    it('should return a 404', async function () {
      const missingDocId = new ObjectId()
      await expect(DocstoreClient.getDoc(this.project_id, missingDocId))
        .to.eventually.be.rejected.and.have.property('info')
        .to.contain({ status: 404 })
    })
  })

  describe('when the doc is a deleted doc', function () {
    beforeEach(async function () {
      this.deleted_doc_id = new ObjectId()
      await DocstoreClient.createDoc(
        this.project_id,
        this.deleted_doc_id,
        this.lines,
        this.version,
        this.ranges
      )
      await DocstoreClient.deleteDoc(this.project_id, this.deleted_doc_id)
    })

    it('should return the doc', async function () {
      const doc = await DocstoreClient.getDoc(
        this.project_id,
        this.deleted_doc_id,
        { include_deleted: true }
      )
      doc.lines.should.deep.equal(this.lines)
      doc.version.should.equal(this.version)
      doc.ranges.should.deep.equal(this.fixedRanges)
      doc.deleted.should.equal(true)
    })

    it('should return a 404 when the query string is not set', async function () {
      await expect(DocstoreClient.getDoc(this.project_id, this.deleted_doc_id))
        .to.eventually.be.rejected.and.have.property('info')
        .to.contain({ status: 404 })
    })
  })
})
