import { expect, vi } from 'vitest'
import sinon from 'sinon'
const modulePath = new URL(
  '../../../../app/src/Features/Exports/ExportsController.mjs',
  import.meta.url
).pathname

describe('ExportsController', function () {
  const projectId = '123njdskj9jlk'
  const userId = '123nd3ijdks'
  const brandVariationId = 22
  const firstName = 'first'
  const lastName = 'last'
  const title = 'title'
  const description = 'description'
  const author = 'author'
  const license = 'other'
  const showSource = true

  beforeEach(async function (ctx) {
    ctx.handler = { getUserNotifications: sinon.stub().callsArgWith(1) }
    ctx.req = {
      params: {
        project_id: projectId,
        brand_variation_id: brandVariationId,
      },
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

    ctx.controller = (await import(modulePath)).default
  })

  describe('without gallery fields', function () {
    it('should ask the handler to perform the export', async function (ctx) {
      await new Promise(resolve => {
        ctx.handler.exportProject = sinon
          .stub()
          .yields(null, { iAmAnExport: true, v1_id: 897 })
        const expected = {
          project_id: projectId,
          user_id: userId,
          brand_variation_id: brandVariationId,
          first_name: firstName,
          last_name: lastName,
        }
        return ctx.controller.exportProject(ctx.req, {
          json: body => {
            expect(ctx.handler.exportProject.args[0][0]).to.deep.equal(expected)
            expect(body).to.deep.equal({
              export_v1_id: 897,
              message: undefined,
            })
            return resolve()
          },
        })
      })
    })
  })

  describe('with a message from v1', function () {
    it('should ask the handler to perform the export', async function (ctx) {
      await new Promise(resolve => {
        ctx.handler.exportProject = sinon.stub().yields(null, {
          iAmAnExport: true,
          v1_id: 897,
          message: 'RESUBMISSION',
        })
        const expected = {
          project_id: projectId,
          user_id: userId,
          brand_variation_id: brandVariationId,
          first_name: firstName,
          last_name: lastName,
        }
        return ctx.controller.exportProject(ctx.req, {
          json: body => {
            expect(ctx.handler.exportProject.args[0][0]).to.deep.equal(expected)
            expect(body).to.deep.equal({
              export_v1_id: 897,
              message: 'RESUBMISSION',
            })
            return resolve()
          },
        })
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
      await new Promise(resolve => {
        ctx.handler.exportProject = sinon
          .stub()
          .yields(null, { iAmAnExport: true, v1_id: 897 })
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
        return ctx.controller.exportProject(ctx.req, {
          json: body => {
            expect(ctx.handler.exportProject.args[0][0]).to.deep.equal(expected)
            expect(body).to.deep.equal({
              export_v1_id: 897,
              message: undefined,
            })
            return resolve()
          },
        })
      })
    })
  })

  describe('with an error return from v1 to forward to the publish modal', function () {
    it('should forward the response onward', async function (ctx) {
      await new Promise(resolve => {
        ctx.error_json = { status: 422, message: 'nope' }
        ctx.handler.exportProject = sinon
          .stub()
          .yields({ forwardResponse: ctx.error_json })
        ctx.controller.exportProject(ctx.req, ctx.res, ctx.next)
        expect(ctx.res.json.args[0][0]).to.deep.equal(ctx.error_json)
        expect(ctx.res.status.args[0][0]).to.equal(ctx.error_json.status)
        return resolve()
      })
    })
  })

  it('should ask the handler to return the status of an export', async function (ctx) {
    await new Promise(resolve => {
      ctx.handler.fetchExport = sinon.stub().yields(
        null,
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

      ctx.req.params = { project_id: projectId, export_id: 897 }
      return ctx.controller.exportStatus(ctx.req, {
        json: body => {
          expect(body).to.deep.equal({
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
          return resolve()
        },
      })
    })
  })
})
