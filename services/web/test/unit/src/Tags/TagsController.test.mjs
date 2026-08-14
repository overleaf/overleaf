import { afterEach, assert, beforeEach, describe, it, vi } from 'vitest'
import sinon from 'sinon'
import {
  InvalidRequestError,
  setReqValidationModeForTests,
} from '@overleaf/validation-tools'

const modulePath = '../../../../app/src/Features/Tags/TagsController.mjs'

describe('TagsController', function () {
  const userId = '507f191e810c19729de860ea'
  const projectId = '507f191e810c19729de860eb'
  const tagId = '507f191e810c19729de860ec'
  const projectId2 = '507f191e810c19729de860ed'

  beforeEach(async function (ctx) {
    ctx.TagsHandler = {
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
    ctx.SessionManager = {
      getLoggedInUserId: session => {
        return session.user._id
      },
    }

    vi.doMock('../../../../app/src/Features/Tags/TagsHandler', () => ({
      default: ctx.TagsHandler,
    }))

    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager',
      () => ({
        default: ctx.SessionManager,
      })
    )

    ctx.TagsController = (await import(modulePath)).default
    ctx.req = {
      params: {},
      session: {
        user: {
          _id: userId,
        },
      },
      body: {},
    }

    ctx.res = {}
    ctx.res.status = sinon.stub().returns(ctx.res)
    ctx.res.end = sinon.stub()
    ctx.res.json = sinon.stub()
  })

  afterEach(function () {
    setReqValidationModeForTests(null)
  })

  it('get all tags', async function (ctx) {
    await new Promise(resolve => {
      const allTags = [{ name: 'tag', projects: ['123423', '423423'] }]
      ctx.TagsHandler.promises.getAllTags = sinon.stub().resolves(allTags)
      ctx.TagsController.getAllTags(ctx.req, {
        json: body => {
          body.should.equal(allTags)
          sinon.assert.calledWith(ctx.TagsHandler.promises.getAllTags, userId)
          resolve()
          return {
            end: () => {},
          }
        },
      })
    })
  })

  describe('create a tag', function (done) {
    it('without a color', async function (ctx) {
      await new Promise(resolve => {
        ctx.tag = { mock: 'tag' }
        ctx.TagsHandler.promises.createTag = sinon.stub().resolves(ctx.tag)
        ctx.req.session.user._id = ctx.userId = 'user-id-123'
        ctx.req.body = { name: (ctx.tagName = 'tag-name') }
        ctx.TagsController.createTag(ctx.req, {
          json: () => {
            sinon.assert.calledWith(
              ctx.TagsHandler.promises.createTag,
              ctx.userId,
              ctx.tagName
            )
            resolve()
            return {
              end: () => {},
            }
          },
        })
      })
    })

    it('with a color', async function (ctx) {
      await new Promise(resolve => {
        ctx.tag = { mock: 'tag' }
        ctx.TagsHandler.promises.createTag = sinon.stub().resolves(ctx.tag)
        ctx.req.session.user._id = ctx.userId = 'user-id-123'
        ctx.req.body = {
          name: (ctx.tagName = 'tag-name'),
          color: (ctx.color = '#123456'),
        }
        ctx.TagsController.createTag(ctx.req, {
          json: () => {
            sinon.assert.calledWith(
              ctx.TagsHandler.promises.createTag,
              ctx.userId,
              ctx.tagName,
              ctx.color
            )
            resolve()
            return {
              end: () => {},
            }
          },
        })
      })
    })
  })

  it('delete a tag', async function (ctx) {
    await new Promise(resolve => {
      ctx.req.params.tagId = ctx.tagId = tagId
      ctx.req.session.user._id = ctx.userId = userId
      ctx.TagsController.deleteTag(ctx.req, {
        status: code => {
          assert.equal(code, 204)
          sinon.assert.calledWith(
            ctx.TagsHandler.promises.deleteTag,
            ctx.userId,
            ctx.tagId
          )
          resolve()
          return {
            end: () => {},
          }
        },
      })
    })
  })

  describe('rename a tag', function () {
    beforeEach(function (ctx) {
      ctx.req.params.tagId = ctx.tagId = tagId
      ctx.req.session.user._id = ctx.userId = userId
    })

    it('with a name', async function (ctx) {
      await new Promise(resolve => {
        ctx.req.body = {
          name: (ctx.tagName = 'new-name'),
        }
        ctx.TagsController.renameTag(ctx.req, {
          status: code => {
            assert.equal(code, 204)
            sinon.assert.calledWith(
              ctx.TagsHandler.promises.renameTag,
              ctx.userId,
              ctx.tagId,
              ctx.tagName
            )
            resolve()
            return {
              end: () => {},
            }
          },
        })
      })
    })

    it('with an empty name, even when the schema is in log-only mode', async function (ctx) {
      setReqValidationModeForTests('log')
      ctx.req.body = { name: '' }
      await ctx.TagsController.renameTag(ctx.req, ctx.res)
      sinon.assert.calledWith(ctx.res.status, 400)
      sinon.assert.notCalled(ctx.TagsHandler.promises.renameTag)
    })
  })

  describe('edit a tag', function () {
    beforeEach(function (ctx) {
      ctx.req.params.tagId = ctx.tagId = tagId
      ctx.req.session.user._id = ctx.userId = userId
    })

    it('with a name and no color', async function (ctx) {
      await new Promise(resolve => {
        ctx.req.body = {
          name: (ctx.tagName = 'new-name'),
        }
        ctx.TagsController.editTag(ctx.req, {
          status: code => {
            assert.equal(code, 204)
            sinon.assert.calledWith(
              ctx.TagsHandler.promises.editTag,
              ctx.userId,
              ctx.tagId,
              ctx.tagName
            )
            resolve()
            return {
              end: () => {},
            }
          },
        })
      })
    })

    it('with a name and color', async function (ctx) {
      await new Promise(resolve => {
        ctx.req.body = {
          name: (ctx.tagName = 'new-name'),
          color: (ctx.color = '#FF0011'),
        }
        ctx.TagsController.editTag(ctx.req, {
          status: code => {
            assert.equal(code, 204)
            sinon.assert.calledWith(
              ctx.TagsHandler.promises.editTag,
              ctx.userId,
              ctx.tagId,
              ctx.tagName,
              ctx.color
            )
            resolve()
            return {
              end: () => {},
            }
          },
        })
      })
    })

    it('without a name', function (ctx) {
      ctx.req.body = { name: undefined }
      ctx.TagsController.editTag(ctx.req, ctx.res).should.be.rejectedWith(
        InvalidRequestError
      )
    })

    it('with an empty name, even when the schema is in log-only mode', async function (ctx) {
      setReqValidationModeForTests('log')
      ctx.req.body = { name: '' }
      await ctx.TagsController.editTag(ctx.req, ctx.res)
      sinon.assert.calledWith(ctx.res.status, 400)
      sinon.assert.notCalled(ctx.TagsHandler.promises.editTag)
    })
  })

  it('add a project to a tag', async function (ctx) {
    await new Promise(resolve => {
      ctx.req.params.tagId = ctx.tagId = tagId
      ctx.req.params.projectId = ctx.projectId = projectId
      ctx.req.session.user._id = ctx.userId = userId
      ctx.TagsController.addProjectToTag(ctx.req, {
        status: code => {
          assert.equal(code, 204)
          sinon.assert.calledWith(
            ctx.TagsHandler.promises.addProjectToTag,
            ctx.userId,
            ctx.tagId,
            ctx.projectId
          )
          resolve()
          return {
            end: () => {},
          }
        },
      })
    })
  })

  it('add projects to a tag', async function (ctx) {
    await new Promise(resolve => {
      ctx.req.params.tagId = ctx.tagId = tagId
      ctx.req.body.projectIds = ctx.projectIds = [projectId, projectId2]
      ctx.req.session.user._id = ctx.userId = userId
      ctx.TagsController.addProjectsToTag(ctx.req, {
        status: code => {
          assert.equal(code, 204)
          sinon.assert.calledWith(
            ctx.TagsHandler.promises.addProjectsToTag,
            ctx.userId,
            ctx.tagId,
            ctx.projectIds
          )
          resolve()
          return {
            end: () => {},
          }
        },
      })
    })
  })

  it('remove a project from a tag', async function (ctx) {
    await new Promise(resolve => {
      ctx.req.params.tagId = ctx.tagId = tagId
      ctx.req.params.projectId = ctx.projectId = projectId
      ctx.req.session.user._id = ctx.userId = userId
      ctx.TagsController.removeProjectFromTag(ctx.req, {
        status: code => {
          assert.equal(code, 204)
          sinon.assert.calledWith(
            ctx.TagsHandler.promises.removeProjectFromTag,
            ctx.userId,
            ctx.tagId,
            ctx.projectId
          )
          resolve()
          return {
            end: () => {},
          }
        },
      })
    })
  })

  it('remove projects from a tag', async function (ctx) {
    await new Promise(resolve => {
      ctx.req.params.tagId = ctx.tagId = tagId
      ctx.req.body.projectIds = ctx.projectIds = [projectId, projectId2]
      ctx.req.session.user._id = ctx.userId = userId
      ctx.TagsController.removeProjectsFromTag(ctx.req, {
        status: code => {
          assert.equal(code, 204)
          sinon.assert.calledWith(
            ctx.TagsHandler.promises.removeProjectsFromTag,
            ctx.userId,
            ctx.tagId,
            ctx.projectIds
          )
          resolve()
          return {
            end: () => {},
          }
        },
      })
    })
  })
})
