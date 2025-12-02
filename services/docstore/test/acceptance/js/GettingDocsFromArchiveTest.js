import Settings from '@overleaf/settings'
import mongodb from '../../../app/js/mongodb.js'
import DocstoreApp from './helpers/DocstoreApp.js'
import DocstoreClient from './helpers/DocstoreClient.js'
import { Storage } from '@google-cloud/storage'

const { ObjectId } = mongodb

describe('Getting A Doc from Archive', function () {
  before(async function () {
    await DocstoreApp.ensureRunning()
  })

  before(async function () {
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

  describe('for an archived doc', function () {
    before(async function () {
      this.project_id = new ObjectId()
      this.timeout(1000 * 30)
      this.doc = {
        _id: new ObjectId(),
        lines: ['foo', 'bar'],
        ranges: {},
        version: 2,
      }
      await DocstoreClient.createDoc(
        this.project_id,
        this.doc._id,
        this.doc.lines,
        this.doc.version,
        this.doc.ranges
      )
      this.res = await DocstoreClient.archiveDoc(this.project_id, this.doc._id)
    })

    it('should successully archive the doc', function () {
      this.res.status.should.equal(204)
    })

    it('should return the doc lines and version from persistent storage', async function () {
      const { res, doc } = await DocstoreClient.peekDoc(
        this.project_id,
        this.doc._id
      )
      res.status.should.equal(200)
      res.headers.get('x-doc-status').should.equal('archived')
      doc.lines.should.deep.equal(this.doc.lines)
      doc.version.should.equal(this.doc.version)
      doc.ranges.should.deep.equal(this.doc.ranges)
    })

    it('should return the doc lines and version from persistent storage on subsequent requests', async function () {
      const { res, doc } = await DocstoreClient.peekDoc(
        this.project_id,
        this.doc._id
      )
      res.status.should.equal(200)
      res.headers.get('x-doc-status').should.equal('archived')
      doc.lines.should.deep.equal(this.doc.lines)
      doc.version.should.equal(this.doc.version)
      doc.ranges.should.deep.equal(this.doc.ranges)
    })

    describe('for an non-archived doc', function () {
      before(async function () {
        this.project_id = new ObjectId()
        this.timeout(1000 * 30)
        this.doc = {
          _id: new ObjectId(),
          lines: ['foo', 'bar'],
          ranges: {},
          version: 2,
        }
        await DocstoreClient.createDoc(
          this.project_id,
          this.doc._id,
          this.doc.lines,
          this.doc.version,
          this.doc.ranges
        )
      })

      it('should return the doc lines and version from mongo', async function () {
        const { res, doc } = await DocstoreClient.peekDoc(
          this.project_id,
          this.doc._id
        )
        res.status.should.equal(200)
        res.headers.get('x-doc-status').should.equal('active')
        doc.lines.should.deep.equal(this.doc.lines)
        doc.version.should.equal(this.doc.version)
        doc.ranges.should.deep.equal(this.doc.ranges)
      })
    })
  })
})
