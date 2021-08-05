/* eslint-disable
    camelcase,
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Tags/TagsController.js'
)

describe('TagsController', function () {
  const userId = '123nd3ijdks'
  const projectId = '123njdskj9jlk'
  const tag = 'some_class101'

  beforeEach(function () {
    this.handler = {
      addProjectToTag: sinon.stub().callsArgWith(3),
      removeProjectFromTag: sinon.stub().callsArgWith(3),
      deleteTag: sinon.stub().callsArg(2),
      renameTag: sinon.stub().callsArg(3),
      createTag: sinon.stub(),
    }
    this.SessionManager = {
      getLoggedInUserId: session => {
        return session.user._id
      },
    }
    this.controller = SandboxedModule.require(modulePath, {
      requires: {
        './TagsHandler': this.handler,
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
    return (this.res.json = sinon.stub())
  })

  describe('getAllTags', function () {
    it('should ask the handler for all tags', function (done) {
      const allTags = [{ name: 'tag', projects: ['123423', '423423'] }]
      this.handler.getAllTags = sinon.stub().callsArgWith(1, null, allTags)
      return this.controller.getAllTags(this.req, {
        json: body => {
          body.should.equal(allTags)
          this.handler.getAllTags.calledWith(userId).should.equal(true)
          return done()
        },
      })
    })
  })

  describe('createTag', function () {
    beforeEach(function () {
      this.handler.createTag.callsArgWith(2, null, (this.tag = { mock: 'tag' }))
      this.req.session.user._id = this.userId = 'user-id-123'
      this.req.body = { name: (this.name = 'tag-name') }
      return this.controller.createTag(this.req, this.res)
    })

    it('should create the tag in the backend', function () {
      return this.handler.createTag
        .calledWith(this.userId, this.name)
        .should.equal(true)
    })

    it('should return the tag', function () {
      return this.res.json.calledWith(this.tag).should.equal(true)
    })
  })

  describe('deleteTag', function () {
    beforeEach(function () {
      this.req.params.tagId = this.tagId = 'tag-id-123'
      this.req.session.user._id = this.userId = 'user-id-123'
      return this.controller.deleteTag(this.req, this.res)
    })

    it('should delete the tag in the backend', function () {
      return this.handler.deleteTag
        .calledWith(this.userId, this.tagId)
        .should.equal(true)
    })

    it('should return 204 status code', function () {
      this.res.status.calledWith(204).should.equal(true)
      return this.res.end.called.should.equal(true)
    })
  })

  describe('renameTag', function () {
    beforeEach(function () {
      this.req.params.tagId = this.tagId = 'tag-id-123'
      return (this.req.session.user._id = this.userId = 'user-id-123')
    })

    describe('with a name', function () {
      beforeEach(function () {
        this.req.body = { name: (this.name = 'new-name') }
        return this.controller.renameTag(this.req, this.res)
      })

      it('should delete the tag in the backend', function () {
        return this.handler.renameTag
          .calledWith(this.userId, this.tagId, this.name)
          .should.equal(true)
      })

      it('should return 204 status code', function () {
        this.res.status.calledWith(204).should.equal(true)
        return this.res.end.called.should.equal(true)
      })
    })

    describe('without a name', function () {
      beforeEach(function () {
        return this.controller.renameTag(this.req, this.res)
      })

      it('should not call the backend', function () {
        return this.handler.renameTag.called.should.equal(false)
      })

      it('should return 400 (bad request) status code', function () {
        this.res.status.calledWith(400).should.equal(true)
        return this.res.end.called.should.equal(true)
      })
    })
  })

  describe('addProjectToTag', function () {
    beforeEach(function () {
      this.req.params.tagId = this.tagId = 'tag-id-123'
      this.req.params.projectId = this.projectId = 'project-id-123'
      this.req.session.user._id = this.userId = 'user-id-123'
      return this.controller.addProjectToTag(this.req, this.res)
    })

    it('should add the tag to the project in the backend', function () {
      return this.handler.addProjectToTag
        .calledWith(this.userId, this.tagId, this.projectId)
        .should.equal(true)
    })

    it('should return 204 status code', function () {
      this.res.status.calledWith(204).should.equal(true)
      return this.res.end.called.should.equal(true)
    })
  })

  describe('removeProjectFromTag', function () {
    beforeEach(function () {
      this.req.params.tagId = this.tagId = 'tag-id-123'
      this.req.params.projectId = this.projectId = 'project-id-123'
      this.req.session.user._id = this.userId = 'user-id-123'
      return this.controller.removeProjectFromTag(this.req, this.res)
    })

    it('should remove the tag from the project in the backend', function () {
      return this.handler.removeProjectFromTag
        .calledWith(this.userId, this.tagId, this.projectId)
        .should.equal(true)
    })

    it('should return 204 status code', function () {
      this.res.status.calledWith(204).should.equal(true)
      return this.res.end.called.should.equal(true)
    })
  })
})
