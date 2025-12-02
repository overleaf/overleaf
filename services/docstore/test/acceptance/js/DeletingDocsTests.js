import mongodb from '../../../app/js/mongodb.js'
import { expect } from 'chai'
import DocstoreApp from './helpers/DocstoreApp.js'
import Errors from '../../../app/js/Errors.js'
import Settings from '@overleaf/settings'
import { Storage } from '@google-cloud/storage'
import { setTimeout as sleep } from 'node:timers/promises'

import DocstoreClient from './helpers/DocstoreClient.js'

const { db, ObjectId } = mongodb

function deleteTestSuite(deleteDoc) {
  before(async function () {
    // Create buckets needed by the archiving part of these tests
    const storage = new Storage(Settings.docstore.gcs.endpoint)
    await storage.createBucket(Settings.docstore.bucket)
    await storage.createBucket(`${Settings.docstore.bucket}-deleted`)
  })

  after(async function () {
    // Tear down the buckets created above
    const storage = new Storage(Settings.docstore.gcs.endpoint)
    await storage.bucket(Settings.docstore.bucket).deleteFiles()
    await storage.bucket(Settings.docstore.bucket).delete()
    await storage.bucket(`${Settings.docstore.bucket}-deleted`).deleteFiles()
    await storage.bucket(`${Settings.docstore.bucket}-deleted`).delete()
  })

  beforeEach(async function () {
    this.project_id = new ObjectId()
    this.doc_id = new ObjectId()
    this.lines = ['original', 'lines']
    this.version = 42
    this.ranges = []
    await DocstoreApp.ensureRunning()
    await DocstoreClient.createDoc(
      this.project_id,
      this.doc_id,
      this.lines,
      this.version,
      this.ranges
    )
  })

  it('should show as not deleted on /deleted', async function () {
    const { res, body } = await DocstoreClient.isDocDeleted(
      this.project_id,
      this.doc_id
    )
    expect(res.status).to.equal(200)
    expect(body).to.have.property('deleted').to.equal(false)
  })

  describe('when the doc exists', function () {
    beforeEach(async function () {
      this.res = await deleteDoc(this.project_id, this.doc_id)
    })

    afterEach(async function () {
      await db.docs.deleteOne({ _id: this.doc_id })
    })

    it('should mark the doc as deleted on /deleted', async function () {
      const { res, body } = await DocstoreClient.isDocDeleted(
        this.project_id,
        this.doc_id
      )
      expect(res.status).to.equal(200)
      expect(body).to.have.property('deleted').to.equal(true)
    })

    it('should insert a deleted doc into the docs collection', async function () {
      const docs = await db.docs.find({ _id: this.doc_id }).toArray()
      docs[0]._id.should.deep.equal(this.doc_id)
      docs[0].lines.should.deep.equal(this.lines)
      docs[0].deleted.should.equal(true)
    })

    it('should not export the doc to s3', async function () {
      await sleep(1000)
      try {
        await DocstoreClient.getS3Doc(this.project_id, this.doc_id)
      } catch (error) {
        expect(error).to.be.instanceOf(Errors.NotFoundError)
      }
    })
  })

  describe('when archiveOnSoftDelete is enabled', function () {
    let archiveOnSoftDelete
    beforeEach('overwrite settings', function () {
      archiveOnSoftDelete = Settings.docstore.archiveOnSoftDelete
      Settings.docstore.archiveOnSoftDelete = true
    })
    afterEach('restore settings', function () {
      Settings.docstore.archiveOnSoftDelete = archiveOnSoftDelete
    })

    beforeEach('delete Doc', async function () {
      this.res = await deleteDoc(this.project_id, this.doc_id)
    })

    beforeEach(function waitForBackgroundFlush(done) {
      setTimeout(done, 500)
    })

    afterEach(function cleanupDoc(done) {
      db.docs.deleteOne({ _id: this.doc_id }, done)
    })

    it('should set the deleted flag in the doc', async function () {
      const doc = await db.docs.findOne({ _id: this.doc_id })
      expect(doc.deleted).to.equal(true)
    })

    it('should set inS3 and unset lines and ranges in the doc', async function () {
      const doc = await db.docs.findOne({ _id: this.doc_id })
      expect(doc.lines).to.not.exist
      expect(doc.ranges).to.not.exist
      expect(doc.inS3).to.equal(true)
    })

    it('should set the doc in s3 correctly', async function () {
      const s3doc = await DocstoreClient.getS3Doc(this.project_id, this.doc_id)
      expect(s3doc.lines).to.deep.equal(this.lines)
      expect(s3doc.ranges).to.deep.equal(this.ranges)
    })
  })

  describe('when the doc exists in another project', function () {
    const otherProjectId = new ObjectId()

    it('should show as not existing on /deleted', async function () {
      expect(DocstoreClient.isDocDeleted(otherProjectId, this.doc_id))
        .to.eventually.be.rejected.and.have.property('info')
        .to.contain({ status: 404 })
    })

    it('should return a 404 when trying to delete', async function () {
      expect(deleteDoc(otherProjectId, this.doc_id))
        .to.eventually.be.rejected.and.have.property('info')
        .to.contain({ status: 404 })
    })
  })

  describe('when the doc does not exist', function () {
    it('should show as not existing on /deleted', async function () {
      const missingDocId = new ObjectId()
      expect(DocstoreClient.isDocDeleted(this.project_id, missingDocId))
        .to.eventually.be.rejected.and.have.property('info')
        .to.contain({ status: 404 })
    })

    it('should return a 404', async function () {
      const missingDocId = new ObjectId()
      await expect(deleteDoc(this.project_id, missingDocId))
        .to.eventually.be.rejected.and.have.property('info')
        .to.contain({ status: 404 })
    })
  })
}

describe('Delete via PATCH', function () {
  deleteTestSuite(DocstoreClient.deleteDoc)

  describe('when providing a custom doc name in the delete request', function () {
    beforeEach(async function () {
      await DocstoreClient.deleteDocWithName(
        this.project_id,
        this.doc_id,
        'wombat.tex'
      )
    })

    it('should insert the doc name into the docs collection', async function () {
      const docs = await db.docs.find({ _id: this.doc_id }).toArray()
      expect(docs[0].name).to.equal('wombat.tex')
    })
  })

  describe('when providing a custom deletedAt date in the delete request', function () {
    beforeEach('record date and delay', function (done) {
      this.deletedAt = new Date()
      setTimeout(done, 5)
    })

    beforeEach('perform deletion with past date', async function () {
      await DocstoreClient.deleteDocWithDate(
        this.project_id,
        this.doc_id,
        this.deletedAt
      )
    })

    it('should insert the date into the docs collection', async function () {
      const docs = await db.docs.find({ _id: this.doc_id }).toArray()
      expect(docs[0].deletedAt.toISOString()).to.equal(
        this.deletedAt.toISOString()
      )
    })
  })

  describe('when providing no doc name in the delete request', function () {
    it('should reject the request', function () {
      expect(DocstoreClient.deleteDocWithName(this.project_id, this.doc_id))
        .to.eventually.be.rejected.and.have.property('info')
        .to.contain({ status: 400 })
    })
  })

  describe('when providing no date in the delete request', function () {
    it('should reject the request', function () {
      expect(DocstoreClient.deleteDocWithDate(this.project_id, this.doc_id))
        .to.eventually.be.rejected.and.have.property('info')
        .to.contain({ status: 400 })
    })
  })

  describe('before deleting anything', function () {
    it('should show nothing in deleted docs response', async function () {
      const deletedDocs = await DocstoreClient.getAllDeletedDocs(
        this.project_id
      )
      expect(deletedDocs).to.deep.equal([])
    })
  })

  describe('when the doc gets a name on delete', function () {
    beforeEach(async function () {
      this.deletedAt = new Date()
      await DocstoreClient.deleteDocWithDate(
        this.project_id,
        this.doc_id,
        this.deletedAt
      )
    })

    it('should show the doc in deleted docs response', async function () {
      const deletedDocs = await DocstoreClient.getAllDeletedDocs(
        this.project_id
      )
      expect(deletedDocs).to.deep.equal([
        {
          _id: this.doc_id.toString(),
          name: 'main.tex',
          deletedAt: this.deletedAt.toISOString(),
        },
      ])
    })

    describe('after deleting multiple docs', function () {
      beforeEach('create doc2', async function () {
        this.doc_id2 = new ObjectId()
        await DocstoreClient.createDoc(
          this.project_id,
          this.doc_id2,
          this.lines,
          this.version,
          this.ranges
        )
      })
      beforeEach('delete doc2', async function () {
        this.deletedAt2 = new Date()
        await DocstoreClient.deleteDocWithDateAndName(
          this.project_id,
          this.doc_id2,
          this.deletedAt2,
          'two.tex'
        )
      })
      beforeEach('create doc3', async function () {
        this.doc_id3 = new ObjectId()
        await DocstoreClient.createDoc(
          this.project_id,
          this.doc_id3,
          this.lines,
          this.version,
          this.ranges
        )
      })
      beforeEach('delete doc3', async function () {
        this.deletedAt3 = new Date()
        await DocstoreClient.deleteDocWithDateAndName(
          this.project_id,
          this.doc_id3,
          this.deletedAt3,
          'three.tex'
        )
      })
      it('should show all the docs as deleted', async function () {
        const deletedDocs = await DocstoreClient.getAllDeletedDocs(
          this.project_id
        )
        expect(deletedDocs).to.deep.equal([
          {
            _id: this.doc_id3.toString(),
            name: 'three.tex',
            deletedAt: this.deletedAt3.toISOString(),
          },
          {
            _id: this.doc_id2.toString(),
            name: 'two.tex',
            deletedAt: this.deletedAt2.toISOString(),
          },
          {
            _id: this.doc_id.toString(),
            name: 'main.tex',
            deletedAt: this.deletedAt.toISOString(),
          },
        ])
      })

      describe('with one more than max_deleted_docs permits', function () {
        let maxDeletedDocsBefore
        beforeEach(function () {
          maxDeletedDocsBefore = Settings.max_deleted_docs
          Settings.max_deleted_docs = 2
        })
        afterEach(function () {
          Settings.max_deleted_docs = maxDeletedDocsBefore
        })

        it('should omit the first deleted doc', async function () {
          const deletedDocs = await DocstoreClient.getAllDeletedDocs(
            this.project_id
          )
          expect(deletedDocs).to.deep.equal([
            {
              _id: this.doc_id3.toString(),
              name: 'three.tex',
              deletedAt: this.deletedAt3.toISOString(),
            },
            {
              _id: this.doc_id2.toString(),
              name: 'two.tex',
              deletedAt: this.deletedAt2.toISOString(),
            },
            // dropped main.tex
          ])
        })
      })
    })
  })
})

describe("Destroying a project's documents", function () {
  beforeEach(async function () {
    this.project_id = new ObjectId()
    this.doc_id = new ObjectId()
    this.lines = ['original', 'lines']
    this.version = 42
    this.ranges = []
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
    beforeEach(async function () {
      await DocstoreClient.destroyAllDoc(this.project_id)
    })

    it('should remove the doc from the docs collection', async function () {
      const docs = await db.docs.find({ _id: this.doc_id }).toArray()
      expect(docs).to.deep.equal([])
    })
  })

  describe('when the doc is archived', function () {
    beforeEach(async function () {
      try {
        await DocstoreClient.archiveAllDoc(this.project_id)
      } catch (error) {
        // noop
      }
      await DocstoreClient.destroyAllDoc(this.project_id)
    })

    it('should remove the doc from the docs collection', async function () {
      const docs = await db.docs.find({ _id: this.doc_id }).toArray()
      expect(docs).to.deep.equal([])
    })

    it('should remove the doc contents from s3', async function () {
      try {
        await DocstoreClient.getS3Doc(this.project_id, this.doc_id)
      } catch (error) {
        expect(error).to.be.instanceOf(Errors.NotFoundError)
      }
    })
  })
})
