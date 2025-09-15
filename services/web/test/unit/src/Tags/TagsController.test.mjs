import { assert, beforeEach, describe, it, vi } from 'vitest'
import sinon from 'sinon'
import { ZodError } from 'zod'

const modulePath = '../../../../app/src/Features/Tags/TagsController.mjs'

describe('TagsController', function () {
  const userId = '123nd3ijdks'
  const projectId = '123njdskj9jlk'

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

    ctx.res = {}
    ctx.res.status = sinon.stub().returns(ctx.res)
    ctx.res.end = sinon.stub()
    ctx.res.json = sinon.stub()
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
      ctx.req.params.tagId = ctx.tagId = 'tag-id-123'
      ctx.req.session.user._id = ctx.userId = 'user-id-123'
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

  describe('edit a tag', function () {
    beforeEach(function (ctx) {
      ctx.req.params.tagId = ctx.tagId = 'tag-id-123'
      ctx.req.session.user._id = ctx.userId = 'user-id-123'
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
      ctx.TagsController.renameTag(ctx.req, ctx.res).should.be.rejectedWith(
        ZodError
      )
    })
  })

  it('add a project to a tag', async function (ctx) {
    await new Promise(resolve => {
      ctx.req.params.tagId = ctx.tagId = 'tag-id-123'
      ctx.req.params.projectId = ctx.projectId = 'project-id-123'
      ctx.req.session.user._id = ctx.userId = 'user-id-123'
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
      ctx.req.params.tagId = ctx.tagId = 'tag-id-123'
      ctx.req.body.projectIds = ctx.projectIds = [
        'project-id-123',
        'project-id-234',
      ]
      ctx.req.session.user._id = ctx.userId = 'user-id-123'
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
      ctx.req.params.tagId = ctx.tagId = 'tag-id-123'
      ctx.req.params.projectId = ctx.projectId = 'project-id-123'
      ctx.req.session.user._id = ctx.userId = 'user-id-123'
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
      ctx.req.params.tagId = ctx.tagId = 'tag-id-123'
      ctx.req.body.projectIds = ctx.projectIds = [
        'project-id-123',
        'project-id-234',
      ]
      ctx.req.session.user._id = ctx.userId = 'user-id-123'
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
