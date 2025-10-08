const sinon = require('sinon')
const { setTimeout } = require('node:timers/promises')
const Settings = require('@overleaf/settings')
const rclientProjectHistory = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.project_history
)
const ProjectHistoryKeys = Settings.redis.project_history.key_schema

const MockProjectHistoryApi = require('./helpers/MockProjectHistoryApi')
const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')

async function sendProjectUpdateAndWait(projectId, docId, update, version) {
  await DocUpdaterClient.sendProjectUpdate(projectId, docId, update, version)

  // It seems that we need to wait for a little while
  await setTimeout(200)
}

describe("Applying updates to a project's structure", function () {
  before(async function () {
    this.user_id = 'user-id-123'
    this.version = 1234

    await DocUpdaterApp.ensureRunning()
  })

  describe('renaming a file', function () {
    before(async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.fileUpdate = {
        type: 'rename-file',
        id: DocUpdaterClient.randomId(),
        pathname: '/file-path',
        newPathname: '/new-file-path',
      }
      this.updates = [this.fileUpdate]
      await sendProjectUpdateAndWait(
        this.project_id,
        this.user_id,
        this.updates,
        this.version
      )
    })

    it('should push the applied file renames to the project history api', function (done) {
      rclientProjectHistory.lrange(
        ProjectHistoryKeys.projectHistoryOps({ project_id: this.project_id }),
        0,
        -1,
        (error, updates) => {
          if (error) {
            return done(error)
          }

          const update = JSON.parse(updates[0])
          update.file.should.equal(this.fileUpdate.id)
          update.pathname.should.equal('/file-path')
          update.new_pathname.should.equal('/new-file-path')
          update.meta.user_id.should.equal(this.user_id)
          update.meta.ts.should.be.a('string')
          update.version.should.equal(`${this.version}.0`)

          done()
        }
      )
    })
  })

  describe('deleting a file', function () {
    before(async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.fileUpdate = {
        type: 'rename-file',
        id: DocUpdaterClient.randomId(),
        pathname: '/file-path',
        newPathname: '',
      }
      this.updates = [this.fileUpdate]
      await sendProjectUpdateAndWait(
        this.project_id,
        this.user_id,
        this.updates,
        this.version
      )
    })

    it('should push the applied file renames to the project history api', function (done) {
      rclientProjectHistory.lrange(
        ProjectHistoryKeys.projectHistoryOps({ project_id: this.project_id }),
        0,
        -1,
        (error, updates) => {
          if (error) {
            return done(error)
          }

          const update = JSON.parse(updates[0])
          update.file.should.equal(this.fileUpdate.id)
          update.pathname.should.equal('/file-path')
          update.new_pathname.should.equal('')
          update.meta.user_id.should.equal(this.user_id)
          update.meta.ts.should.be.a('string')
          update.version.should.equal(`${this.version}.0`)

          done()
        }
      )
    })
  })

  describe('renaming a document', function () {
    before(function () {
      this.update = {
        type: 'rename-doc',
        id: DocUpdaterClient.randomId(),
        pathname: '/doc-path',
        newPathname: '/new-doc-path',
      }
      this.updates = [this.update]
    })

    describe('when the document is not loaded', function () {
      before(async function () {
        this.project_id = DocUpdaterClient.randomId()
        await sendProjectUpdateAndWait(
          this.project_id,
          this.user_id,
          this.updates,
          this.version
        )
      })

      it('should push the applied doc renames to the project history api', function (done) {
        rclientProjectHistory.lrange(
          ProjectHistoryKeys.projectHistoryOps({ project_id: this.project_id }),
          0,
          -1,
          (error, updates) => {
            if (error) {
              return done(error)
            }

            const update = JSON.parse(updates[0])
            update.doc.should.equal(this.update.id)
            update.pathname.should.equal('/doc-path')
            update.new_pathname.should.equal('/new-doc-path')
            update.meta.user_id.should.equal(this.user_id)
            update.meta.ts.should.be.a('string')
            update.version.should.equal(`${this.version}.0`)

            done()
          }
        )
      })
    })

    describe('when the document is loaded', function () {
      before(async function () {
        this.project_id = DocUpdaterClient.randomId()
        MockWebApi.insertDoc(this.project_id, this.update.id, {})
        await DocUpdaterClient.preloadDoc(this.project_id, this.update.id)
        sinon.spy(MockWebApi, 'getDocument')
        await sendProjectUpdateAndWait(
          this.project_id,
          this.user_id,
          this.updates,
          this.version
        )
      })

      after(function () {
        MockWebApi.getDocument.restore()
      })

      it('should update the doc', async function () {
        const doc = await DocUpdaterClient.getDoc(
          this.project_id,
          this.update.id
        )
        doc.pathname.should.equal(this.update.newPathname)
      })

      it('should push the applied doc renames to the project history api', function (done) {
        rclientProjectHistory.lrange(
          ProjectHistoryKeys.projectHistoryOps({ project_id: this.project_id }),
          0,
          -1,
          (error, updates) => {
            if (error) {
              return done(error)
            }

            const update = JSON.parse(updates[0])
            update.doc.should.equal(this.update.id)
            update.pathname.should.equal('/doc-path')
            update.new_pathname.should.equal('/new-doc-path')
            update.meta.user_id.should.equal(this.user_id)
            update.meta.ts.should.be.a('string')
            update.version.should.equal(`${this.version}.0`)

            done()
          }
        )
      })
    })
  })

  describe('renaming multiple documents and files', function () {
    before(function () {
      this.docUpdate0 = {
        type: 'rename-doc',
        id: DocUpdaterClient.randomId(),
        pathname: '/doc-path0',
        newPathname: '/new-doc-path0',
      }
      this.docUpdate1 = {
        type: 'rename-doc',
        id: DocUpdaterClient.randomId(),
        pathname: '/doc-path1',
        newPathname: '/new-doc-path1',
      }
      this.fileUpdate0 = {
        type: 'rename-file',
        id: DocUpdaterClient.randomId(),
        pathname: '/file-path0',
        newPathname: '/new-file-path0',
      }
      this.fileUpdate1 = {
        type: 'rename-file',
        id: DocUpdaterClient.randomId(),
        pathname: '/file-path1',
        newPathname: '/new-file-path1',
      }
      this.updates = [
        this.docUpdate0,
        this.docUpdate1,
        this.fileUpdate0,
        this.fileUpdate1,
      ]
    })

    describe('when the documents are not loaded', function () {
      before(async function () {
        this.project_id = DocUpdaterClient.randomId()
        await sendProjectUpdateAndWait(
          this.project_id,
          this.user_id,
          this.updates,
          this.version
        )
      })

      it('should push the applied doc renames to the project history api', function (done) {
        rclientProjectHistory.lrange(
          ProjectHistoryKeys.projectHistoryOps({ project_id: this.project_id }),
          0,
          -1,
          (error, updates) => {
            if (error) {
              return done(error)
            }

            let update = JSON.parse(updates[0])
            update.doc.should.equal(this.docUpdate0.id)
            update.pathname.should.equal('/doc-path0')
            update.new_pathname.should.equal('/new-doc-path0')
            update.meta.user_id.should.equal(this.user_id)
            update.meta.ts.should.be.a('string')
            update.version.should.equal(`${this.version}.0`)

            update = JSON.parse(updates[1])
            update.doc.should.equal(this.docUpdate1.id)
            update.pathname.should.equal('/doc-path1')
            update.new_pathname.should.equal('/new-doc-path1')
            update.meta.user_id.should.equal(this.user_id)
            update.meta.ts.should.be.a('string')
            update.version.should.equal(`${this.version}.1`)

            update = JSON.parse(updates[2])
            update.file.should.equal(this.fileUpdate0.id)
            update.pathname.should.equal('/file-path0')
            update.new_pathname.should.equal('/new-file-path0')
            update.meta.user_id.should.equal(this.user_id)
            update.meta.ts.should.be.a('string')
            update.version.should.equal(`${this.version}.2`)

            update = JSON.parse(updates[3])
            update.file.should.equal(this.fileUpdate1.id)
            update.pathname.should.equal('/file-path1')
            update.new_pathname.should.equal('/new-file-path1')
            update.meta.user_id.should.equal(this.user_id)
            update.meta.ts.should.be.a('string')
            update.version.should.equal(`${this.version}.3`)

            done()
          }
        )
      })
    })
  })

  describe('deleting a document', function () {
    before(function () {
      this.update = {
        type: 'rename-doc',
        id: DocUpdaterClient.randomId(),
        pathname: '/doc-path',
        newPathname: '',
      }
      this.updates = [this.update]
    })

    describe('when the document is not loaded', function () {
      before(async function () {
        this.project_id = DocUpdaterClient.randomId()
        await sendProjectUpdateAndWait(
          this.project_id,
          this.user_id,
          this.updates,
          this.version
        )
      })

      it('should push the applied doc update to the project history api', function (done) {
        rclientProjectHistory.lrange(
          ProjectHistoryKeys.projectHistoryOps({ project_id: this.project_id }),
          0,
          -1,
          (error, updates) => {
            if (error) {
              return done(error)
            }

            const update = JSON.parse(updates[0])
            update.doc.should.equal(this.update.id)
            update.pathname.should.equal('/doc-path')
            update.new_pathname.should.equal('')
            update.meta.user_id.should.equal(this.user_id)
            update.meta.ts.should.be.a('string')
            update.version.should.equal(`${this.version}.0`)

            done()
          }
        )
      })
    })

    describe('when the document is loaded', function () {
      before(async function () {
        this.project_id = DocUpdaterClient.randomId()
        MockWebApi.insertDoc(this.project_id, this.update.id, {})
        await DocUpdaterClient.preloadDoc(this.project_id, this.update.id)
        sinon.spy(MockWebApi, 'getDocument')
        await sendProjectUpdateAndWait(
          this.project_id,
          this.user_id,
          this.updates,
          this.version
        )
      })

      after(function () {
        MockWebApi.getDocument.restore()
      })

      it('should not modify the doc', async function () {
        const doc = await DocUpdaterClient.getDoc(
          this.project_id,
          this.update.id
        )
        doc.pathname.should.equal('/a/b/c.tex') // default pathname from MockWebApi
      })

      it('should push the applied doc update to the project history api', function (done) {
        rclientProjectHistory.lrange(
          ProjectHistoryKeys.projectHistoryOps({ project_id: this.project_id }),
          0,
          -1,
          (error, updates) => {
            if (error) {
              return done(error)
            }

            const update = JSON.parse(updates[0])
            update.doc.should.equal(this.update.id)
            update.pathname.should.equal('/doc-path')
            update.new_pathname.should.equal('')
            update.meta.user_id.should.equal(this.user_id)
            update.meta.ts.should.be.a('string')
            update.version.should.equal(`${this.version}.0`)

            done()
          }
        )
      })
    })
  })

  describe('adding a file', function () {
    before(async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.fileUpdate = {
        type: 'add-file',
        id: DocUpdaterClient.randomId(),
        pathname: '/file-path',
        url: 'filestore.example.com',
      }
      this.updates = [this.fileUpdate]
      await sendProjectUpdateAndWait(
        this.project_id,
        this.user_id,
        this.updates,
        this.version
      )
    })

    it('should push the file addition to the project history api', function (done) {
      rclientProjectHistory.lrange(
        ProjectHistoryKeys.projectHistoryOps({ project_id: this.project_id }),
        0,
        -1,
        (error, updates) => {
          if (error) {
            return done(error)
          }

          const update = JSON.parse(updates[0])
          update.file.should.equal(this.fileUpdate.id)
          update.pathname.should.equal('/file-path')
          update.url.should.equal('filestore.example.com')
          update.meta.user_id.should.equal(this.user_id)
          update.meta.ts.should.be.a('string')
          update.version.should.equal(`${this.version}.0`)

          done()
        }
      )
    })
  })

  describe('adding a doc', function () {
    before(async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.docUpdate = {
        type: 'add-doc',
        id: DocUpdaterClient.randomId(),
        pathname: '/file-path',
        docLines: 'a\nb',
      }
      this.updates = [this.docUpdate]
      await sendProjectUpdateAndWait(
        this.project_id,
        this.user_id,
        this.updates,
        this.version
      )
    })

    it('should push the doc addition to the project history api', function (done) {
      rclientProjectHistory.lrange(
        ProjectHistoryKeys.projectHistoryOps({ project_id: this.project_id }),
        0,
        -1,
        (error, updates) => {
          if (error) {
            return done(error)
          }

          const update = JSON.parse(updates[0])
          update.doc.should.equal(this.docUpdate.id)
          update.pathname.should.equal('/file-path')
          update.docLines.should.equal('a\nb')
          update.meta.user_id.should.equal(this.user_id)
          update.meta.ts.should.be.a('string')
          update.version.should.equal(`${this.version}.0`)

          done()
        }
      )
    })
  })

  describe('with enough updates to flush to the history service', function () {
    before(async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.user_id = DocUpdaterClient.randomId()
      this.version0 = 12345
      this.version1 = this.version0 + 1
      const updates = []
      for (let v = 0; v <= 599; v++) {
        // Should flush after 500 ops
        updates.push({
          type: 'add-doc',
          id: DocUpdaterClient.randomId(),
          pathname: '/file-' + v,
          docLines: 'a\nb',
        })
      }

      sinon.spy(MockProjectHistoryApi, 'flushProject')

      // Send updates in chunks to causes multiple flushes
      const projectId = this.project_id
      const userId = this.project_id
      await DocUpdaterClient.sendProjectUpdate(
        projectId,
        userId,
        updates.slice(0, 250),
        this.version0
      )
      await DocUpdaterClient.sendProjectUpdate(
        projectId,
        userId,
        updates.slice(250),
        this.version1
      )
      await setTimeout(200)
    })

    after(function () {
      MockProjectHistoryApi.flushProject.restore()
    })

    it('should flush project history', function () {
      MockProjectHistoryApi.flushProject
        .calledWith(this.project_id)
        .should.equal(true)
    })
  })

  describe('with too few updates to flush to the history service', function () {
    before(async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.user_id = DocUpdaterClient.randomId()
      this.version0 = 12345
      this.version1 = this.version0 + 1

      const updates = []
      for (let v = 0; v <= 42; v++) {
        // Should flush after 500 ops
        updates.push({
          type: 'add-doc',
          id: DocUpdaterClient.randomId(),
          pathname: '/file-' + v,
          docLines: 'a\nb',
        })
      }

      sinon.spy(MockProjectHistoryApi, 'flushProject')

      // Send updates in chunks
      const projectId = this.project_id
      const userId = this.project_id
      await DocUpdaterClient.sendProjectUpdate(
        projectId,
        userId,
        updates.slice(0, 10),
        this.version0
      )
      await DocUpdaterClient.sendProjectUpdate(
        projectId,
        userId,
        updates.slice(10),
        this.version1
      )
      await setTimeout(200)
    })

    after(function () {
      MockProjectHistoryApi.flushProject.restore()
    })

    it('should not flush project history', function () {
      MockProjectHistoryApi.flushProject
        .calledWith(this.project_id)
        .should.equal(false)
    })
  })
})
