import esmock from 'esmock'
import sinon from 'sinon'
import { assert } from 'chai'
const modulePath = new URL(
  '../../../../app/src/Features/Tags/TagsController.mjs',
  import.meta.url
).pathname

describe('TagsController', function () {
  const userId = '123nd3ijdks'
  const projectId = '123njdskj9jlk'

  beforeEach(async function () {
    this.TagsHandler = {
      promises: {
        addProjectToTag: sinon.stub().resolves(),
        addProjectsToTag: sinon.stub().resolves(),
        removeProjectFromTag: sinon.stub().resolves(),
        removeProjectsFromTag: sinon.stub().resolves(),
        deleteTag: sinon.stub().resolves(),
        editTag: sinon.stub().resolves(),
        renameTag: sinon.stub().resolves(),
        createTag: sinon.stub().resolves(),
      },
    }
    this.SessionManager = {
      getLoggedInUserId: session => {
        return session.user._id
      },
    }
    this.TagsController = await esmock.strict(modulePath, {
      '../../../../app/src/Features/Tags/TagsHandler': this.TagsHandler,
      '../../../../app/src/Features/Authentication/SessionManager':
        this.SessionManager,
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
      body: {},
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

  describe('create a tag', function (done) {
    it('without a color', function (done) {
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

    it('with a color', function (done) {
      this.tag = { mock: 'tag' }
      this.TagsHandler.promises.createTag = sinon.stub().resolves(this.tag)
      this.req.session.user._id = this.userId = 'user-id-123'
      this.req.body = {
        name: (this.name = 'tag-name'),
        color: (this.color = '#123456'),
      }
      this.TagsController.createTag(this.req, {
        json: () => {
          sinon.assert.calledWith(
            this.TagsHandler.promises.createTag,
            this.userId,
            this.name,
            this.color
          )
          done()
          return {
            end: () => {},
          }
        },
      })
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

  describe('edit a tag', function () {
    beforeEach(function () {
      this.req.params.tagId = this.tagId = 'tag-id-123'
      this.req.session.user._id = this.userId = 'user-id-123'
    })

    it('with a name and no color', function (done) {
      this.req.body = {
        name: (this.name = 'new-name'),
      }
      this.TagsController.editTag(this.req, {
        status: code => {
          assert.equal(code, 204)
          sinon.assert.calledWith(
            this.TagsHandler.promises.editTag,
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

    it('with a name and color', function (done) {
      this.req.body = {
        name: (this.name = 'new-name'),
        color: (this.color = '#FF0011'),
      }
      this.TagsController.editTag(this.req, {
        status: code => {
          assert.equal(code, 204)
          sinon.assert.calledWith(
            this.TagsHandler.promises.editTag,
            this.userId,
            this.tagId,
            this.name,
            this.color
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

  it('add projects to a tag', function (done) {
    this.req.params.tagId = this.tagId = 'tag-id-123'
    this.req.body.projectIds = this.projectIds = [
      'project-id-123',
      'project-id-234',
    ]
    this.req.session.user._id = this.userId = 'user-id-123'
    this.TagsController.addProjectsToTag(this.req, {
      status: code => {
        assert.equal(code, 204)
        sinon.assert.calledWith(
          this.TagsHandler.promises.addProjectsToTag,
          this.userId,
          this.tagId,
          this.projectIds
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

  it('remove projects from a tag', function (done) {
    this.req.params.tagId = this.tagId = 'tag-id-123'
    this.req.body.projectIds = this.projectIds = [
      'project-id-123',
      'project-id-234',
    ]
    this.req.session.user._id = this.userId = 'user-id-123'
    this.TagsController.removeProjectsFromTag(this.req, {
      status: code => {
        assert.equal(code, 204)
        sinon.assert.calledWith(
          this.TagsHandler.promises.removeProjectsFromTag,
          this.userId,
          this.tagId,
          this.projectIds
        )
        done()
        return {
          end: () => {},
        }
      },
    })
  })
})
