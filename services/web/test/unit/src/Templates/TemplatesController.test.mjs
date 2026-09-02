import { beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'

const modulePath =
  '../../../../app/src/Features/Templates/TemplatesController.mjs'

describe('TemplatesController', function () {
  beforeEach(async function (ctx) {
    ctx.user_id = 'user-id'

    ctx.ProjectHelper = {
      compilerFromV1Engine: sinon.stub(),
    }

    vi.doMock('../../../../app/src/Features/Project/ProjectHelper', () => ({
      default: ctx.ProjectHelper,
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
        brandVariationId: '789',
        compiler: 'compiler',
        mainFile: 'main-file',
        templateId: '123',
        templateName: 'template-name',
        templateVersionId: '456',
      },
      session: {
        templateData: 'template-data',
        user: {
          _id: ctx.user_id,
        },
      },
    }
    return (ctx.res = {
      redirect: sinon.stub(),
      sendStatus: sinon.stub(),
      render: sinon.stub(),
    })
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
          789,
          'compiler',
          'main-file',
          '123',
          'template-name',
          '456',
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

    describe('input validation', function () {
      it('should reject an invalid templateVersionId', async function (ctx) {
        ctx.req.body.templateVersionId = '../../../../../../123'
        await ctx.TemplatesController.createProjectFromV1Template(
          ctx.req,
          ctx.res,
          ctx.next
        )
        ctx.next.should.have.been.calledWithMatch(sinon.match.instanceOf(Error))
        ctx.TemplatesManager.promises.createProjectFromV1Template.should.not
          .have.been.called
        ctx.res.redirect.called.should.equal(false)
      })

      it('should reject a non-numeric templateId', async function (ctx) {
        ctx.req.body.templateId = 'not-a-number'
        await ctx.TemplatesController.createProjectFromV1Template(
          ctx.req,
          ctx.res,
          ctx.next
        )
        ctx.next.should.have.been.calledWithMatch(sinon.match.instanceOf(Error))
        ctx.TemplatesManager.promises.createProjectFromV1Template.should.not
          .have.been.called
        ctx.res.redirect.called.should.equal(false)
      })

      it('should reject a missing templateVersionId', async function (ctx) {
        delete ctx.req.body.templateVersionId
        await ctx.TemplatesController.createProjectFromV1Template(
          ctx.req,
          ctx.res,
          ctx.next
        )
        ctx.next.should.have.been.calledWithMatch(sinon.match.instanceOf(Error))
        ctx.TemplatesManager.promises.createProjectFromV1Template.should.not
          .have.been.called
      })

      it('should reject a path-traversal-shaped brandVariationId', async function (ctx) {
        ctx.req.body.brandVariationId = '1/../../v1/x'
        await ctx.TemplatesController.createProjectFromV1Template(
          ctx.req,
          ctx.res,
          ctx.next
        )
        ctx.next.should.have.been.calledWithMatch(sinon.match.instanceOf(Error))
        ctx.TemplatesManager.promises.createProjectFromV1Template.should.not
          .have.been.called
        ctx.res.redirect.called.should.equal(false)
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

  describe('getV1Template', function () {
    beforeEach(function (ctx) {
      ctx.req.params = { Template_version_id: '456' }
      ctx.req.query = { id: '123' }
      ctx.ProjectHelper.compilerFromV1Engine.returns('pdflatex')
    })

    it('should render the template page for valid ids', async function (ctx) {
      ctx.req.query.templateName = 'template-name'
      ctx.req.query.latexEngine = 'latex_dvipdf'
      await ctx.TemplatesController.getV1Template(ctx.req, ctx.res, ctx.next)
      ctx.next.called.should.equal(false)
      ctx.res.render.should.have.been.calledWithMatch(sinon.match.string, {
        templateVersionId: '456',
        templateId: '123',
        name: 'template-name',
        compiler: 'pdflatex',
      })
    })

    it('should reject an invalid Template_version_id', async function (ctx) {
      ctx.req.params.Template_version_id = '../../../../123'
      await ctx.TemplatesController.getV1Template(ctx.req, ctx.res, ctx.next)
      ctx.next.should.have.been.calledWithMatch(sinon.match.instanceOf(Error))
      ctx.res.render.called.should.equal(false)
    })

    it('should reject a missing Template_version_id param', async function (ctx) {
      delete ctx.req.params.Template_version_id
      await ctx.TemplatesController.getV1Template(ctx.req, ctx.res, ctx.next)
      ctx.next.should.have.been.calledWithMatch(sinon.match.instanceOf(Error))
      ctx.res.render.called.should.equal(false)
    })

    it('should reject a non-numeric id query param', async function (ctx) {
      ctx.req.query.id = 'not-a-number'
      await ctx.TemplatesController.getV1Template(ctx.req, ctx.res, ctx.next)
      ctx.next.should.have.been.calledWithMatch(sinon.match.instanceOf(Error))
      ctx.res.render.called.should.equal(false)
    })

    it('should reject a missing id query param', async function (ctx) {
      delete ctx.req.query.id
      await ctx.TemplatesController.getV1Template(ctx.req, ctx.res, ctx.next)
      ctx.next.should.have.been.calledWithMatch(sinon.match.instanceOf(Error))
      ctx.res.render.called.should.equal(false)
    })

    it('should reject a path-traversal-shaped brandVariationId query param', async function (ctx) {
      ctx.req.query.brandVariationId = '1/../../v1/x'
      await ctx.TemplatesController.getV1Template(ctx.req, ctx.res, ctx.next)
      ctx.next.should.have.been.calledWithMatch(sinon.match.instanceOf(Error))
      ctx.res.render.called.should.equal(false)
    })
  })
})
