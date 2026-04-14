import { vi, expect } from 'vitest'
import sinon from 'sinon'
import ProjectHelper from '../../../../app/src/Features/Project/ProjectHelper.mjs'

const modulePath =
  '../../../../app/src/Features/Templates/TemplatesController.mjs'

describe('TemplatesController', function () {
  beforeEach(async function (ctx) {
    ctx.user_id = 'user-id'

    vi.doMock('../../../../app/src/Features/Project/ProjectHelper', () => ({
      default: ProjectHelper,
    }))

    vi.doMock(
      '../../../../app/src/Features/Authentication/AuthenticationController',
      () => ({
        default: (ctx.AuthenticationController = {
          getLoggedInUserId: sinon.stub().returns(ctx.user_id),
        }),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Templates/TemplatesManager',
      () => ({
        default: (ctx.TemplatesManager = {
          promises: { createProjectFromV1Template: sinon.stub() },
        }),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestHandler',
      () => ({
        default: (ctx.SplitTestHandler = {
          promises: {
            getAssignment: sinon.stub().resolves({ variant: 'default' }),
          },
        }),
      })
    )

    ctx.TemplatesController = (await import(modulePath)).default
    ctx.next = sinon.stub()
    ctx.req = {
      body: {
        brandVariationId: 'brand-variation-id',
        compiler: 'compiler',
        mainFile: 'main-file',
        templateId: 'template-id',
        templateName: 'template-name',
        templateVersionId: 'template-version-id',
      },
      session: {
        templateData: 'template-data',
        user: {
          _id: ctx.user_id,
        },
      },
    }
    return (ctx.res = { redirect: sinon.stub() })
  })

  describe('createProjectFromV1Template', function () {
    describe('on success', function () {
      beforeEach(function (ctx) {
        ctx.project = { _id: 'project-id' }
        ctx.TemplatesManager.promises.createProjectFromV1Template.resolves(
          ctx.project
        )
        return ctx.TemplatesController.createProjectFromV1Template(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should call TemplatesManager', function (ctx) {
        return ctx.TemplatesManager.promises.createProjectFromV1Template.should.have.been.calledWithMatch(
          'brand-variation-id',
          'compiler',
          'main-file',
          'template-id',
          'template-name',
          'template-version-id',
          'user-id'
        )
      })

      it('should redirect to project', function (ctx) {
        return ctx.res.redirect.should.have.been.calledWith(
          '/project/project-id'
        )
      })

      it('should delete session', function (ctx) {
        return expect(ctx.req.session.templateData).to.be.undefined
      })
    })

    describe('on error', function () {
      beforeEach(function (ctx) {
        ctx.TemplatesManager.promises.createProjectFromV1Template.rejects(
          'error'
        )
        return ctx.TemplatesController.createProjectFromV1Template(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should call next with error', function (ctx) {
        return ctx.next.should.have.been.calledWithMatch(
          sinon.match.instanceOf(Error)
        )
      })

      it('should not redirect', function (ctx) {
        return ctx.res.redirect.called.should.equal(false)
      })
    })
  })
})
