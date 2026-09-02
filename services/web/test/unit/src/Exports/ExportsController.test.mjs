import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'
import OError from '@overleaf/o-error'
import {
  InvalidParamsError,
  InvalidRequestError,
  setReqValidationModeForTests,
} from '@overleaf/validation-tools'
const modulePath = new URL(
  '../../../../app/src/Features/Exports/ExportsController.mjs',
  import.meta.url
).pathname

describe('ExportsController', function () {
  const projectId = '507f191e810c19729de860ea'
  const userId = '507f191e810c19729de860eb'
  const brandVariationId = '22'
  const firstName = 'first'
  const lastName = 'last'
  const title = 'title'
  const description = 'description'
  const author = 'author'
  const license = 'other'
  const showSource = true

  beforeEach(async function (ctx) {
    ctx.handler = { getUserNotifications: sinon.stub().callsArgWith(1) }
    ctx.settings = {}
    ctx.req = {
      params: {
        project_id: projectId,
        brand_variation_id: brandVariationId,
      },
      query: {},
      body: {
        firstName,
        lastName,
      },
      session: {
        user: {
          _id: userId,
        },
      },
      i18n: {
        translate() {},
      },
    }
    ctx.res = {
      json: sinon.stub(),
      status: sinon.stub(),
      sendStatus: sinon.stub(),
      redirect: sinon.stub(),
    }
    ctx.res.status.returns(ctx.res)
    ctx.next = sinon.stub()
    ctx.AuthenticationController = {
      getLoggedInUserId: sinon.stub().returns(ctx.req.session.user._id),
    }

    vi.doMock(
      '../../../../app/src/Features/Exports/ExportsHandler.mjs',
      () => ({
        default: ctx.handler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Authentication/AuthenticationController.mjs',
      () => ({
        default: ctx.AuthenticationController,
      })
    )

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    ctx.controller = (await import(modulePath)).default
  })

  describe('without gallery fields', function () {
    it('should ask the handler to perform the export', async function (ctx) {
      ctx.handler.exportProject = sinon
        .stub()
        .resolves({ iAmAnExport: true, v1_id: 897, token: 'mock-token' })
      const expected = {
        project_id: projectId,
        user_id: userId,
        brand_variation_id: brandVariationId,
        first_name: firstName,
        last_name: lastName,
      }
      const res = {
        json: sinon.stub(),
      }

      await ctx.controller.exportProject(ctx.req, res)
      expect(ctx.handler.exportProject.args[0][0]).to.deep.equal(expected)
      expect(res.json.args[0][0]).to.deep.equal({
        export_v1_id: 897,
        token: 'mock-token',
        message: undefined,
      })
    })
  })

  describe('with a message from v1', function () {
    it('should ask the handler to perform the export', async function (ctx) {
      ctx.handler.exportProject = sinon.stub().resolves({
        iAmAnExport: true,
        v1_id: 897,
        token: 'mock-token',
        message: 'RESUBMISSION',
      })
      const expected = {
        project_id: projectId,
        user_id: userId,
        brand_variation_id: brandVariationId,
        first_name: firstName,
        last_name: lastName,
      }

      const res = {
        json: sinon.stub(),
      }

      await ctx.controller.exportProject(ctx.req, res)

      expect(ctx.handler.exportProject.args[0][0]).to.deep.equal(expected)
      expect(res.json.args[0][0]).to.deep.equal({
        export_v1_id: 897,
        token: 'mock-token',
        message: 'RESUBMISSION',
      })
    })
  })

  describe('with gallery fields', function () {
    beforeEach(function (ctx) {
      ctx.req.body.title = title
      ctx.req.body.description = description
      ctx.req.body.author = author
      ctx.req.body.license = license
      return (ctx.req.body.showSource = true)
    })

    it('should ask the handler to perform the export', async function (ctx) {
      ctx.handler.exportProject = sinon
        .stub()
        .resolves({ iAmAnExport: true, v1_id: 897, token: 'mock-token' })
      const expected = {
        project_id: projectId,
        user_id: userId,
        brand_variation_id: brandVariationId,
        first_name: firstName,
        last_name: lastName,
        title,
        description,
        author,
        license,
        show_source: showSource,
      }

      const res = {
        json: sinon.stub(),
      }

      await ctx.controller.exportProject(ctx.req, res)
      expect(ctx.handler.exportProject.args[0][0]).to.deep.equal(expected)
      expect(res.json.args[0][0]).to.deep.equal({
        export_v1_id: 897,
        token: 'mock-token',
        message: undefined,
      })
    })
  })

  describe('with an error return from v1 to forward to the publish modal', function () {
    it('should forward the response onward', async function (ctx) {
      ctx.error_json = { status: 422, message: 'nope' }
      ctx.handler.exportProject = sinon.stub().rejects(
        OError.tag(new Error('original error'), 'v1 error', {
          forwardResponse: ctx.error_json,
        })
      )
      await ctx.controller.exportProject(ctx.req, ctx.res, ctx.next)
      expect(ctx.res.json.args[0][0]).to.deep.equal(ctx.error_json)
      expect(ctx.res.status.args[0][0]).to.equal(ctx.error_json.status)
    })
  })

  it('should ask the handler to return the status of an export', async function (ctx) {
    ctx.handler.fetchExport = sinon.stub().resolves(
      `{
  "id":897,
  "status_summary":"completed",
  "status_detail":"all done",
  "partner_submission_id":"abc123",
  "v2_user_email":"la@tex.com",
  "v2_user_first_name":"Arthur",
  "v2_user_last_name":"Author",
  "title":"my project",
  "token":"token"
  }`
    )

    const res = {
      json: sinon.stub(),
    }

    ctx.req.params = { project_id: projectId, export_id: '897' }
    ctx.req.query = { token: 'mock-token' }
    await ctx.controller.exportStatus(ctx.req, res)
    expect(ctx.handler.fetchExport).to.have.been.calledWith('897', 'mock-token')
    expect(res.json.args[0][0]).to.deep.equal({
      export_json: {
        status_summary: 'completed',
        status_detail: 'all done',
        partner_submission_id: 'abc123',
        v2_user_email: 'la@tex.com',
        v2_user_first_name: 'Arthur',
        v2_user_last_name: 'Author',
        title: 'my project',
        token: 'token',
      },
    })
  })

  describe('exportStatus token validation', function () {
    beforeEach(function (ctx) {
      ctx.req.params = { project_id: projectId, export_id: '897' }
      ctx.handler.fetchExport = sinon.stub().resolves(
        `{
  "id":897,
  "status_summary":"completed",
  "status_detail":"all done",
  "partner_submission_id":"abc123",
  "v2_user_email":"la@tex.com",
  "v2_user_first_name":"Arthur",
  "v2_user_last_name":"Author",
  "title":"my project",
  "token":"token"
  }`
      )
    })

    describe('when requireToken is enabled', function () {
      beforeEach(function (ctx) {
        ctx.settings.exports = { requireToken: true }
      })

      it('should return 403 when no token is provided', async function (ctx) {
        ctx.req.query = {}
        await ctx.controller.exportStatus(ctx.req, ctx.res)
        expect(ctx.res.status.args[0][0]).to.equal(403)
        expect(ctx.res.json.args[0][0]).to.deep.equal({
          export_json: {
            status_summary: 'failed',
            status_detail: 'token is required',
          },
        })
        expect(ctx.handler.fetchExport).not.to.have.been.called
      })

      it('should proceed when a token is provided', async function (ctx) {
        ctx.req.query = { token: 'mock-token' }
        const res = {
          json: sinon.stub(),
        }
        await ctx.controller.exportStatus(ctx.req, res)
        expect(ctx.handler.fetchExport).to.have.been.calledWith(
          '897',
          'mock-token'
        )
      })
    })

    describe('when requireToken is not enabled', function () {
      it('should proceed without token', async function (ctx) {
        ctx.req.query = {}
        const res = {
          json: sinon.stub(),
        }
        await ctx.controller.exportStatus(ctx.req, res)
        expect(ctx.handler.fetchExport).to.have.been.calledWith(
          '897',
          undefined
        )
      })
    })

    describe('when a spoofed token is provided', function () {
      it('should return a failed status when v1 rejects the token', async function (ctx) {
        ctx.req.query = { token: 'wrong-token' }
        ctx.handler.fetchExport = sinon
          .stub()
          .rejects(new Error('Request failed: 404'))
        await ctx.controller.exportStatus(ctx.req, ctx.res)
        expect(ctx.handler.fetchExport).to.have.been.calledWith(
          '897',
          'wrong-token'
        )
        expect(ctx.res.json.args[0][0]).to.deep.equal({
          export_json: {
            status_summary: 'failed',
            status_detail: 'Error: Request failed: 404',
          },
        })
      })
    })
  })

  describe('exportStatus export_id validation', function () {
    beforeEach(function (ctx) {
      ctx.handler.fetchExport = sinon.stub().resolves('{}')
      ctx.req.query = { token: 'mock-token' }
      setReqValidationModeForTests('enforce')
    })

    afterEach(function () {
      setReqValidationModeForTests(null)
    })

    it('should reject an invalid encoded export_id without calling v1', async function (ctx) {
      ctx.req.params = {
        project_id: projectId,
        export_id: '..%2f..%2f..%2fv2%2fusers',
      }
      await ctx.controller.exportStatus(ctx.req, ctx.res, ctx.next)
      expect(ctx.next).to.have.been.calledWith(
        sinon.match.instanceOf(InvalidParamsError)
      )
      expect(ctx.handler.fetchExport).not.to.have.been.called
    })

    it('should reject an export_id with invalid characters without calling v1', async function (ctx) {
      ctx.req.params = {
        project_id: projectId,
        export_id: '../../../etc/passwd',
      }
      await ctx.controller.exportStatus(ctx.req, ctx.res, ctx.next)
      expect(ctx.next).to.have.been.calledWith(
        sinon.match.instanceOf(InvalidParamsError)
      )
      expect(ctx.handler.fetchExport).not.to.have.been.called
    })

    it('should accept a well-formed export_id', async function (ctx) {
      ctx.req.params = {
        project_id: projectId,
        export_id: 'abc-123_DEF',
      }
      await ctx.controller.exportStatus(ctx.req, ctx.res, ctx.next)
      expect(ctx.next).not.to.have.been.called
      expect(ctx.handler.fetchExport).to.have.been.calledWith(
        'abc-123_DEF',
        'mock-token'
      )
    })
  })

  describe('exportDownload token validation', function () {
    beforeEach(function (ctx) {
      ctx.req.params = {
        project_id: projectId,
        export_id: '897',
        type: 'zip',
      }
      ctx.handler.fetchDownload = sinon.stub().resolves('https://example.com')
    })

    describe('when requireToken is enabled', function () {
      beforeEach(function (ctx) {
        ctx.settings.exports = { requireToken: true }
      })

      it('should return 403 when no token is provided', async function (ctx) {
        ctx.req.query = {}
        await ctx.controller.exportDownload(ctx.req, ctx.res)
        expect(ctx.res.sendStatus.args[0][0]).to.equal(403)
        expect(ctx.handler.fetchDownload).not.to.have.been.called
      })

      it('should proceed when a token is provided', async function (ctx) {
        ctx.req.query = { token: 'mock-token' }
        await ctx.controller.exportDownload(ctx.req, ctx.res)
        expect(ctx.handler.fetchDownload).to.have.been.calledWith(
          '897',
          'zip',
          'mock-token'
        )
        expect(ctx.res.redirect).to.have.been.calledWith('https://example.com')
      })
    })

    describe('when requireToken is not enabled', function () {
      it('should proceed without token', async function (ctx) {
        ctx.req.query = {}
        await ctx.controller.exportDownload(ctx.req, ctx.res)
        expect(ctx.handler.fetchDownload).to.have.been.calledWith(
          '897',
          'zip',
          undefined
        )
        expect(ctx.res.redirect).to.have.been.calledWith('https://example.com')
      })
    })

    describe('when a spoofed token is provided', function () {
      it('should return 400 when v1 rejects the token', async function (ctx) {
        ctx.req.query = { token: 'wrong-token' }
        ctx.handler.fetchDownload = sinon.stub().rejects(
          OError.tag(new Error('Request failed: 404'), 'v1 error', {
            statusCode: 404,
          })
        )
        await ctx.controller.exportDownload(ctx.req, ctx.res, ctx.next)
        expect(ctx.handler.fetchDownload).to.have.been.calledWith(
          '897',
          'zip',
          'wrong-token'
        )
        expect(ctx.res.sendStatus).to.have.been.calledWith(400)
        expect(ctx.next).not.to.have.been.called
      })
    })
  })

  describe('request validation', function () {
    beforeEach(function () {
      setReqValidationModeForTests('enforce')
    })

    afterEach(function () {
      setReqValidationModeForTests(null)
    })

    describe('exportProject', function () {
      it('should reject a malformed project_id', async function (ctx) {
        ctx.req.params.project_id = 'not-an-object-id'
        await ctx.controller.exportProject(ctx.req, ctx.res, ctx.next)
        expect(ctx.next).to.have.been.calledWith(
          sinon.match.instanceOf(InvalidParamsError)
        )
      })

      it('should reject an unrecognized body field', async function (ctx) {
        ctx.req.body.extra = 'nope'
        await ctx.controller.exportProject(ctx.req, ctx.res, ctx.next)
        expect(ctx.next).to.have.been.calledWith(
          sinon.match.instanceOf(InvalidRequestError)
        )
      })
    })

    describe('exportStatus', function () {
      beforeEach(function (ctx) {
        ctx.req.query = { token: 'mock-token' }
      })

      it('should reject a malformed project_id', async function (ctx) {
        ctx.req.params = {
          project_id: 'not-an-object-id',
          export_id: '897',
        }
        await ctx.controller.exportStatus(ctx.req, ctx.res, ctx.next)
        expect(ctx.next).to.have.been.calledWith(
          sinon.match.instanceOf(InvalidParamsError)
        )
      })
    })

    describe('exportDownload', function () {
      beforeEach(function (ctx) {
        ctx.req.params = {
          project_id: projectId,
          export_id: '897',
          type: 'zip',
        }
        ctx.req.query = { token: 'mock-token' }
      })

      it('should reject a malformed project_id', async function (ctx) {
        ctx.req.params.project_id = 'not-an-object-id'
        await ctx.controller.exportDownload(ctx.req, ctx.res, ctx.next)
        expect(ctx.next).to.have.been.calledWith(
          sinon.match.instanceOf(InvalidParamsError)
        )
      })

      it('should reject an invalid token query value', async function (ctx) {
        ctx.req.query.token = { foo: 'bar' }
        await ctx.controller.exportDownload(ctx.req, ctx.res, ctx.next)
        expect(ctx.next).to.have.been.calledWith(
          sinon.match.instanceOf(InvalidRequestError)
        )
      })
    })
  })
})
