/* eslint-disable
    camelcase,
    handle-callback-err,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const chai = require('chai')
chai.should()
const Settings = require('settings-sharelatex')
const rclient_project_history = require('redis-sharelatex').createClient(
  Settings.redis.project_history
)
const ProjectHistoryKeys = Settings.redis.project_history.key_schema

const MockProjectHistoryApi = require('./helpers/MockProjectHistoryApi')
const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')

describe("Applying updates to a project's structure", function () {
  before(function () {
    this.user_id = 'user-id-123'
    return (this.version = 1234)
  })

  describe('renaming a file', function () {
    before(function (done) {
      this.project_id = DocUpdaterClient.randomId()
      this.fileUpdate = {
        id: DocUpdaterClient.randomId(),
        pathname: '/file-path',
        newPathname: '/new-file-path'
      }
      this.fileUpdates = [this.fileUpdate]
      return DocUpdaterApp.ensureRunning((error) => {
        if (error) {
          throw error
        }
        return DocUpdaterClient.sendProjectUpdate(
          this.project_id,
          this.user_id,
          [],
          this.fileUpdates,
          this.version,
          (error) => {
            if (error) {
              throw error
            }
            return setTimeout(done, 200)
          }
        )
      })
    })

    return it('should push the applied file renames to the project history api', function (done) {
      rclient_project_history.lrange(
        ProjectHistoryKeys.projectHistoryOps({ project_id: this.project_id }),
        0,
        -1,
        (error, updates) => {
          if (error) {
            throw error
          }

          const update = JSON.parse(updates[0])
          update.file.should.equal(this.fileUpdate.id)
          update.pathname.should.equal('/file-path')
          update.new_pathname.should.equal('/new-file-path')
          update.meta.user_id.should.equal(this.user_id)
          update.meta.ts.should.be.a('string')
          update.version.should.equal(`${this.version}.0`)

          return done()
        }
      )
    })
  })

  describe('renaming a document', function () {
    before(function () {
      this.docUpdate = {
        id: DocUpdaterClient.randomId(),
        pathname: '/doc-path',
        newPathname: '/new-doc-path'
      }
      return (this.docUpdates = [this.docUpdate])
    })

    describe('when the document is not loaded', function () {
      before(function (done) {
        this.project_id = DocUpdaterClient.randomId()
        DocUpdaterClient.sendProjectUpdate(
          this.project_id,
          this.user_id,
          this.docUpdates,
          [],
          this.version,
          (error) => {
            if (error) {
              throw error
            }
            return setTimeout(done, 200)
          }
        )
      })

      return it('should push the applied doc renames to the project history api', function (done) {
        rclient_project_history.lrange(
          ProjectHistoryKeys.projectHistoryOps({ project_id: this.project_id }),
          0,
          -1,
          (error, updates) => {
            if (error) {
              throw error
            }

            const update = JSON.parse(updates[0])
            update.doc.should.equal(this.docUpdate.id)
            update.pathname.should.equal('/doc-path')
            update.new_pathname.should.equal('/new-doc-path')
            update.meta.user_id.should.equal(this.user_id)
            update.meta.ts.should.be.a('string')
            update.version.should.equal(`${this.version}.0`)

            return done()
          }
        )
      })
    })

    return describe('when the document is loaded', function () {
      before(function (done) {
        this.project_id = DocUpdaterClient.randomId()
        MockWebApi.insertDoc(this.project_id, this.docUpdate.id, {})
        DocUpdaterClient.preloadDoc(
          this.project_id,
          this.docUpdate.id,
          (error) => {
            if (error) {
              throw error
            }
            sinon.spy(MockWebApi, 'getDocument')
            return DocUpdaterClient.sendProjectUpdate(
              this.project_id,
              this.user_id,
              this.docUpdates,
              [],
              this.version,
              (error) => {
                if (error) {
                  throw error
                }
                return setTimeout(done, 200)
              }
            )
          }
        )
      })

      after(function () {
        return MockWebApi.getDocument.restore()
      })

      it('should update the doc', function (done) {
        DocUpdaterClient.getDoc(
          this.project_id,
          this.docUpdate.id,
          (error, res, doc) => {
            doc.pathname.should.equal(this.docUpdate.newPathname)
            return done()
          }
        )
      })

      return it('should push the applied doc renames to the project history api', function (done) {
        rclient_project_history.lrange(
          ProjectHistoryKeys.projectHistoryOps({ project_id: this.project_id }),
          0,
          -1,
          (error, updates) => {
            if (error) {
              throw error
            }

            const update = JSON.parse(updates[0])
            update.doc.should.equal(this.docUpdate.id)
            update.pathname.should.equal('/doc-path')
            update.new_pathname.should.equal('/new-doc-path')
            update.meta.user_id.should.equal(this.user_id)
            update.meta.ts.should.be.a('string')
            update.version.should.equal(`${this.version}.0`)

            return done()
          }
        )
      })
    })
  })

  describe('renaming multiple documents and files', function () {
    before(function () {
      this.docUpdate0 = {
        id: DocUpdaterClient.randomId(),
        pathname: '/doc-path0',
        newPathname: '/new-doc-path0'
      }
      this.docUpdate1 = {
        id: DocUpdaterClient.randomId(),
        pathname: '/doc-path1',
        newPathname: '/new-doc-path1'
      }
      this.docUpdates = [this.docUpdate0, this.docUpdate1]
      this.fileUpdate0 = {
        id: DocUpdaterClient.randomId(),
        pathname: '/file-path0',
        newPathname: '/new-file-path0'
      }
      this.fileUpdate1 = {
        id: DocUpdaterClient.randomId(),
        pathname: '/file-path1',
        newPathname: '/new-file-path1'
      }
      return (this.fileUpdates = [this.fileUpdate0, this.fileUpdate1])
    })

    return describe('when the documents are not loaded', function () {
      before(function (done) {
        this.project_id = DocUpdaterClient.randomId()
        DocUpdaterClient.sendProjectUpdate(
          this.project_id,
          this.user_id,
          this.docUpdates,
          this.fileUpdates,
          this.version,
          (error) => {
            if (error) {
              throw error
            }
            return setTimeout(done, 200)
          }
        )
      })

      return it('should push the applied doc renames to the project history api', function (done) {
        rclient_project_history.lrange(
          ProjectHistoryKeys.projectHistoryOps({ project_id: this.project_id }),
          0,
          -1,
          (error, updates) => {
            if (error) {
              throw error
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

            return done()
          }
        )
      })
    })
  })

  describe('adding a file', function () {
    before(function (done) {
      this.project_id = DocUpdaterClient.randomId()
      this.fileUpdate = {
        id: DocUpdaterClient.randomId(),
        pathname: '/file-path',
        url: 'filestore.example.com'
      }
      this.fileUpdates = [this.fileUpdate]
      DocUpdaterClient.sendProjectUpdate(
        this.project_id,
        this.user_id,
        [],
        this.fileUpdates,
        this.version,
        (error) => {
          if (error) {
            throw error
          }
          return setTimeout(done, 200)
        }
      )
    })

    return it('should push the file addition to the project history api', function (done) {
      rclient_project_history.lrange(
        ProjectHistoryKeys.projectHistoryOps({ project_id: this.project_id }),
        0,
        -1,
        (error, updates) => {
          if (error) {
            throw error
          }

          const update = JSON.parse(updates[0])
          update.file.should.equal(this.fileUpdate.id)
          update.pathname.should.equal('/file-path')
          update.url.should.equal('filestore.example.com')
          update.meta.user_id.should.equal(this.user_id)
          update.meta.ts.should.be.a('string')
          update.version.should.equal(`${this.version}.0`)

          return done()
        }
      )
    })
  })

  describe('adding a doc', function () {
    before(function (done) {
      this.project_id = DocUpdaterClient.randomId()
      this.docUpdate = {
        id: DocUpdaterClient.randomId(),
        pathname: '/file-path',
        docLines: 'a\nb'
      }
      this.docUpdates = [this.docUpdate]
      DocUpdaterClient.sendProjectUpdate(
        this.project_id,
        this.user_id,
        this.docUpdates,
        [],
        this.version,
        (error) => {
          if (error) {
            throw error
          }
          return setTimeout(done, 200)
        }
      )
    })

    return it('should push the doc addition to the project history api', function (done) {
      rclient_project_history.lrange(
        ProjectHistoryKeys.projectHistoryOps({ project_id: this.project_id }),
        0,
        -1,
        (error, updates) => {
          if (error) {
            throw error
          }

          const update = JSON.parse(updates[0])
          update.doc.should.equal(this.docUpdate.id)
          update.pathname.should.equal('/file-path')
          update.docLines.should.equal('a\nb')
          update.meta.user_id.should.equal(this.user_id)
          update.meta.ts.should.be.a('string')
          update.version.should.equal(`${this.version}.0`)

          return done()
        }
      )
    })
  })

  describe('with enough updates to flush to the history service', function () {
    before(function (done) {
      this.project_id = DocUpdaterClient.randomId()
      this.user_id = DocUpdaterClient.randomId()
      this.version0 = 12345
      this.version1 = this.version0 + 1
      const updates = []
      for (let v = 0; v <= 599; v++) {
        // Should flush after 500 ops
        updates.push({
          id: DocUpdaterClient.randomId(),
          pathname: '/file-' + v,
          docLines: 'a\nb'
        })
      }

      sinon.spy(MockProjectHistoryApi, 'flushProject')

      // Send updates in chunks to causes multiple flushes
      const projectId = this.project_id
      const userId = this.project_id
      DocUpdaterClient.sendProjectUpdate(
        projectId,
        userId,
        updates.slice(0, 250),
        [],
        this.version0,
        function (error) {
          if (error) {
            throw error
          }
          return DocUpdaterClient.sendProjectUpdate(
            projectId,
            userId,
            updates.slice(250),
            [],
            this.version1,
            (error) => {
              if (error) {
                throw error
              }
              return setTimeout(done, 2000)
            }
          )
        }
      )
    })

    after(function () {
      return MockProjectHistoryApi.flushProject.restore()
    })

    return it('should flush project history', function () {
      return MockProjectHistoryApi.flushProject
        .calledWith(this.project_id)
        .should.equal(true)
    })
  })

  return describe('with too few updates to flush to the history service', function () {
    before(function (done) {
      this.project_id = DocUpdaterClient.randomId()
      this.user_id = DocUpdaterClient.randomId()
      this.version0 = 12345
      this.version1 = this.version0 + 1

      const updates = []
      for (let v = 0; v <= 42; v++) {
        // Should flush after 500 ops
        updates.push({
          id: DocUpdaterClient.randomId(),
          pathname: '/file-' + v,
          docLines: 'a\nb'
        })
      }

      sinon.spy(MockProjectHistoryApi, 'flushProject')

      // Send updates in chunks
      const projectId = this.project_id
      const userId = this.project_id
      DocUpdaterClient.sendProjectUpdate(
        projectId,
        userId,
        updates.slice(0, 10),
        [],
        this.version0,
        function (error) {
          if (error) {
            throw error
          }
          return DocUpdaterClient.sendProjectUpdate(
            projectId,
            userId,
            updates.slice(10),
            [],
            this.version1,
            (error) => {
              if (error) {
                throw error
              }
              return setTimeout(done, 2000)
            }
          )
        }
      )
    })

    after(function () {
      return MockProjectHistoryApi.flushProject.restore()
    })

    return it('should not flush project history', function () {
      return MockProjectHistoryApi.flushProject
        .calledWith(this.project_id)
        .should.equal(false)
    })
  })
})
