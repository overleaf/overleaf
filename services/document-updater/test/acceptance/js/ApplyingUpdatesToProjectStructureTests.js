const sinon = require('sinon')
const { expect } = require('chai')
const { setTimeout } = require('node:timers/promises')
const { RequestFailedError } = require('@overleaf/fetch-utils')
const Settings = require('@overleaf/settings')
const rclientProjectHistory = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.project_history
)
const ProjectHistoryKeys = Settings.redis.project_history.key_schema

const MockProjectHistoryApi = require('./helpers/MockProjectHistoryApi')
const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')

async function sendProjectUpdateAndWait(
  projectId,
  docId,
  update,
  version,
  source
) {
  await DocUpdaterClient.sendProjectUpdate(
    projectId,
    docId,
    update,
    version,
    source
  )

  // It seems that we need to wait for a little while
  await setTimeout(200)
}

describe("Applying updates to a project's structure", function () {
  before(async function () {
    this.user_id = DocUpdaterClient.randomId()
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

    describe('with importedAt metadata', function () {
      before(async function () {
        this.project_id = DocUpdaterClient.randomId()
        this.metadata = { importedAt: new Date().toISOString() }
        this.fileUpdate = {
          type: 'add-file',
          id: DocUpdaterClient.randomId(),
          pathname: '/file-path',
          url: 'filestore.example.com',
          metadata: this.metadata,
        }
        this.updates = [this.fileUpdate]
        await sendProjectUpdateAndWait(
          this.project_id,
          this.user_id,
          this.updates,
          this.version
        )
      })

      it('should push the file addition to the project history api with the metadata', function (done) {
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
            expect(update.metadata).to.deep.equal(this.metadata)

            done()
          }
        )
      })
    })

    describe('with main and importedAt metadata', function () {
      before(async function () {
        this.project_id = DocUpdaterClient.randomId()
        this.metadata = { main: true, importedAt: new Date().toISOString() }
        this.fileUpdate = {
          type: 'add-file',
          id: DocUpdaterClient.randomId(),
          pathname: '/file-path',
          url: 'filestore.example.com',
          metadata: this.metadata,
        }
        this.updates = [this.fileUpdate]
        await sendProjectUpdateAndWait(
          this.project_id,
          this.user_id,
          this.updates,
          this.version
        )
      })

      it('should push the file addition to the project history api with the metadata', function (done) {
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
            expect(update.metadata).to.deep.equal(this.metadata)

            done()
          }
        )
      })
    })

    describe('with linked-file metadata for a personal reference library', function () {
      before(async function () {
        this.project_id = DocUpdaterClient.randomId()
        this.metadata = {
          provider: 'zotero',
          format: 'bibtex',
          // web persists the absent group as null, see the rawLinkedFileData
          // comment in overleaf-editor-core
          group_id: null,
          importer_id: this.user_id,
          importedAt: new Date().toISOString(),
        }
        this.fileUpdate = {
          type: 'add-file',
          id: DocUpdaterClient.randomId(),
          pathname: '/references.bib',
          url: 'filestore.example.com',
          metadata: this.metadata,
        }
        this.updates = [this.fileUpdate]
        await sendProjectUpdateAndWait(
          this.project_id,
          this.user_id,
          this.updates,
          this.version
        )
      })

      it('should push the file addition to the project history api with the metadata', function (done) {
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
            expect(update.metadata).to.deep.equal(this.metadata)

            done()
          }
        )
      })
    })

    describe('with invalid metadata', function () {
      before(async function () {
        this.project_id = DocUpdaterClient.randomId()
        this.fileUpdate = {
          type: 'add-file',
          id: DocUpdaterClient.randomId(),
          pathname: '/file-path',
          url: 'filestore.example.com',
          metadata: { provider: 'not-a-real-provider' },
        }
        this.updates = [this.fileUpdate]
        try {
          await sendProjectUpdateAndWait(
            this.project_id,
            this.user_id,
            this.updates,
            this.version
          )
          this.statusCode = 200
        } catch (err) {
          if (err instanceof RequestFailedError) {
            this.statusCode = err.response.status
          } else {
            throw err
          }
        }
      })

      it('should return a 400 status code', function () {
        this.statusCode.should.equal(400)
      })

      it('should not push anything to the project history api', function (done) {
        rclientProjectHistory.lrange(
          ProjectHistoryKeys.projectHistoryOps({ project_id: this.project_id }),
          0,
          -1,
          (error, updates) => {
            if (error) {
              return done(error)
            }

            updates.should.deep.equal([])

            done()
          }
        )
      })
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

  describe('adding a doc with a null source (e.g. project creation)', function () {
    // web sends an explicit `null` source (not an omitted field) when
    // creating the root/bib doc for a new project, duplicating a project, or
    // importing a zip upload -- see
    // web/app/src/Features/Project/ProjectCreationHandler.mjs _createRootDoc.
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
        this.version,
        null
      )
    })

    it('should push the doc addition to the project history api without a source', function (done) {
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
          update.meta.user_id.should.equal(this.user_id)
          expect(update.meta.source).to.not.exist

          done()
        }
      )
    })
  })

  describe('adding a doc with an origin object source (e.g. restoring a project from history)', function () {
    // web's RestoreManager.mjs sends the richer Origin/RestoreProjectOrigin
    // raw shape (not a plain string) as the "source" of a project-structure
    // change when restoring a file or project from history -- see
    // overleaf-editor-core/lib/origin/restore_project_origin.js. It carries
    // the version/timestamp of the restored version, needed downstream to
    // build a valid history Change origin.
    before(async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.docUpdate = {
        type: 'add-doc',
        id: DocUpdaterClient.randomId(),
        pathname: '/file-path',
        docLines: 'a\nb',
      }
      this.updates = [this.docUpdate]
      this.origin = {
        kind: 'project-restore',
        version: 3,
        timestamp: new Date().toISOString(),
      }
      await sendProjectUpdateAndWait(
        this.project_id,
        this.user_id,
        this.updates,
        this.version,
        this.origin
      )
    })

    it('should push the doc addition to the project history api with the origin', function (done) {
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
          update.meta.user_id.should.equal(this.user_id)
          expect(update.meta.source).to.not.exist
          expect(update.meta.origin).to.deep.equal(this.origin)
          expect(update.meta.type).to.equal('external')

          done()
        }
      )
    })
  })

  describe('adding a doc with a null userId (e.g. a TPDS/GitHub-sync update)', function () {
    // web sends an explicit `null` userId (not an omitted field) for
    // system-initiated project-structure changes that aren't attributable to
    // a specific user -- e.g. TpdsController.mjs's updateProjectContents
    // calls UpdateMerger.promises.mergeUpdate(null, ...) for GitHub-sync
    // updates.
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
        null,
        this.updates,
        this.version
      )
    })

    it('should push the doc addition to the project history api without a user_id', function (done) {
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
          expect(update.meta.user_id).to.be.null

          done()
        }
      )
    })
  })

  describe('adding a doc with an invalid userId', function () {
    before(async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.docUpdate = {
        type: 'add-doc',
        id: DocUpdaterClient.randomId(),
        pathname: '/file-path',
        docLines: 'a\nb',
      }
      this.updates = [this.docUpdate]
      try {
        await sendProjectUpdateAndWait(
          this.project_id,
          'not-an-object-id',
          this.updates,
          this.version
        )
        this.statusCode = 200
      } catch (err) {
        if (err instanceof RequestFailedError) {
          this.statusCode = err.response.status
        } else {
          throw err
        }
      }
    })

    it('should return a 400 status code', function () {
      this.statusCode.should.equal(400)
    })

    it('should not push anything to the project history api', function (done) {
      rclientProjectHistory.lrange(
        ProjectHistoryKeys.projectHistoryOps({ project_id: this.project_id }),
        0,
        -1,
        (error, updates) => {
          if (error) {
            return done(error)
          }

          updates.should.deep.equal([])

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
