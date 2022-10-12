const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { assert } = require('chai')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Tags/TagsController.js'
)

describe('TagsController', function () {
  const userId = '123nd3ijdks'
  const projectId = '123njdskj9jlk'

  beforeEach(function () {
    this.TagsHandler = {
      promises: {
        addProjectToTag: sinon.stub().resolves(),
        removeProjectFromTag: sinon.stub().resolves(),
        deleteTag: sinon.stub().resolves(),
        renameTag: sinon.stub().resolves(),
        createTag: sinon.stub().resolves(),
      },
    }
    this.SessionManager = {
      getLoggedInUserId: session => {
        return session.user._id
      },
    }
    this.TagsController = SandboxedModule.require(modulePath, {
      requires: {
        './TagsHandler': this.TagsHandler,
        '../Authentication/SessionManager': this.SessionManager,
      },
    })
    this.req = {
      params: {
        projectId,
      },
      session: {
        user: {
          _id: userId,
        },
      },
    }

    this.res = {}
    this.res.status = sinon.stub().returns(this.res)
    this.res.end = sinon.stub()
    this.res.json = sinon.stub()
  })

  it('get all tags', function (done) {
    const allTags = [{ name: 'tag', projects: ['123423', '423423'] }]
    this.TagsHandler.promises.getAllTags = sinon.stub().resolves(allTags)
    this.TagsController.getAllTags(this.req, {
      json: body => {
        body.should.equal(allTags)
        sinon.assert.calledWith(this.TagsHandler.promises.getAllTags, userId)
        done()
        return {
          end: () => {},
        }
      },
    })
  })

  it('create a tag', function (done) {
    this.tag = { mock: 'tag' }
    this.TagsHandler.promises.createTag = sinon.stub().resolves(this.tag)
    this.req.session.user._id = this.userId = 'user-id-123'
    this.req.body = { name: (this.name = 'tag-name') }
    this.TagsController.createTag(this.req, {
      json: () => {
        sinon.assert.calledWith(
          this.TagsHandler.promises.createTag,
          this.userId,
          this.name
        )
        done()
        return {
          end: () => {},
        }
      },
    })
  })

  it('delete a tag', function (done) {
    this.req.params.tagId = this.tagId = 'tag-id-123'
    this.req.session.user._id = this.userId = 'user-id-123'
    this.TagsController.deleteTag(this.req, {
      status: code => {
        assert.equal(code, 204)
        sinon.assert.calledWith(
          this.TagsHandler.promises.deleteTag,
          this.userId,
          this.tagId
        )
        done()
        return {
          end: () => {},
        }
      },
    })
  })

  describe('rename a tag', function () {
    beforeEach(function () {
      this.req.params.tagId = this.tagId = 'tag-id-123'
      this.req.session.user._id = this.userId = 'user-id-123'
    })

    it('with a name', function (done) {
      this.req.body = { name: (this.name = 'new-name') }
      this.TagsController.renameTag(this.req, {
        status: code => {
          assert.equal(code, 204)
          sinon.assert.calledWith(
            this.TagsHandler.promises.renameTag,
            this.userId,
            this.tagId,
            this.name
          )
          done()
          return {
            end: () => {},
          }
        },
      })
    })

    it('without a name', function (done) {
      this.req.body = { name: undefined }
      this.TagsController.renameTag(this.req, {
        status: code => {
          assert.equal(code, 400)
          sinon.assert.notCalled(this.TagsHandler.promises.renameTag)
          done()
          return {
            end: () => {},
          }
        },
      })
    })
  })

  it('add a project to a tag', function (done) {
    this.req.params.tagId = this.tagId = 'tag-id-123'
    this.req.params.projectId = this.projectId = 'project-id-123'
    this.req.session.user._id = this.userId = 'user-id-123'
    this.TagsController.addProjectToTag(this.req, {
      status: code => {
        assert.equal(code, 204)
        sinon.assert.calledWith(
          this.TagsHandler.promises.addProjectToTag,
          this.userId,
          this.tagId,
          this.projectId
        )
        done()
        return {
          end: () => {},
        }
      },
    })
  })

  it('remove a project from a tag', function (done) {
    this.req.params.tagId = this.tagId = 'tag-id-123'
    this.req.params.projectId = this.projectId = 'project-id-123'
    this.req.session.user._id = this.userId = 'user-id-123'
    this.TagsController.removeProjectFromTag(this.req, {
      status: code => {
        assert.equal(code, 204)
        sinon.assert.calledWith(
          this.TagsHandler.promises.removeProjectFromTag,
          this.userId,
          this.tagId,
          this.projectId
        )
        done()
        return {
          end: () => {},
        }
      },
    })
  })
})
