import { vi, describe, beforeEach, it } from 'vitest'
import sinon from 'sinon'
import { RequestFailedError } from '@overleaf/fetch-utils'

const modulePath = '../../../app/js/WebApiManager.js'

describe('WebApiManager', function () {
  beforeEach(async function (ctx) {
    ctx.project_id = 'project-id-123'
    ctx.user_id = 'user-id-123'
    ctx.user = { _id: ctx.user_id }
    ctx.callback = sinon.stub()

    ctx.fetchUtils = {
      fetchJson: sinon.stub(),
      RequestFailedError,
    }

    vi.doMock('@overleaf/fetch-utils', () => ctx.fetchUtils)

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.settings = {
        apis: {
          web: {
            url: 'http://web.example.com',
            user: 'username',
            pass: 'password',
          },
        },
      }),
    }))

    ctx.WebApiManager = (await import(modulePath)).default
  })

  describe('joinProject', function () {
    describe('successfully', function () {
      beforeEach(function (ctx) {
        ctx.response = {
          project: { name: 'Test project' },
          privilegeLevel: 'owner',
          isRestrictedUser: true,
          isTokenMember: true,
          isInvitedMember: true,
        }
        ctx.fetchUtils.fetchJson.resolves(ctx.response)
        ctx.WebApiManager.joinProject(ctx.project_id, ctx.user, ctx.callback)
      })

      it('should send a request to web to join the project', function (ctx) {
        ctx.fetchUtils.fetchJson.should.have.been.calledWith(
          new URL(`/project/${ctx.project_id}/join`, ctx.settings.apis.web.url),
          {
            method: 'POST',
            basicAuth: {
              user: ctx.settings.apis.web.user,
              password: ctx.settings.apis.web.pass,
            },
            json: {
              userId: ctx.user_id,
              anonymousAccessToken: undefined,
            },
          }
        )
      })

      it('should return the project, privilegeLevel, and restricted flag', function (ctx) {
        ctx.callback
          .calledWith(null, ctx.response.project, ctx.response.privilegeLevel, {
            isRestrictedUser: ctx.response.isRestrictedUser,
            isTokenMember: ctx.response.isTokenMember,
            isInvitedMember: ctx.response.isInvitedMember,
          })
          .should.equal(true)
      })
    })

    describe('with anon user', function () {
      beforeEach(function (ctx) {
        ctx.user_id = 'anonymous-user'
        ctx.token = 'a-ro-token'
        ctx.user = {
          _id: ctx.user_id,
          anonymousAccessToken: ctx.token,
        }
        ctx.response = {
          project: { name: 'Test project' },
          privilegeLevel: 'readOnly',
          isRestrictedUser: true,
          isTokenMember: false,
          isInvitedMember: false,
        }
        ctx.fetchUtils.fetchJson.resolves(ctx.response)
        ctx.WebApiManager.joinProject(ctx.project_id, ctx.user, ctx.callback)
      })

      it('should send a request to web to join the project', function (ctx) {
        ctx.fetchUtils.fetchJson.should.have.been.calledWith(
          new URL(`/project/${ctx.project_id}/join`, ctx.settings.apis.web.url),
          {
            method: 'POST',
            basicAuth: {
              user: ctx.settings.apis.web.user,
              password: ctx.settings.apis.web.pass,
            },
            json: {
              userId: ctx.user_id,
              anonymousAccessToken: ctx.token,
            },
          }
        )
      })

      it('should return the project, privilegeLevel, and restricted flag', function (ctx) {
        ctx.callback.should.have.been.calledWith(
          null,
          ctx.response.project,
          ctx.response.privilegeLevel,
          {
            isRestrictedUser: ctx.response.isRestrictedUser,
            isTokenMember: ctx.response.isTokenMember,
            isInvitedMember: ctx.response.isInvitedMember,
          }
        )
      })
    })

    describe('when web replies with a 403', function () {
      beforeEach(function (ctx) {
        ctx.fetchUtils.fetchJson.rejects(
          new RequestFailedError(
            `/project/${ctx.project_id}/join`,
            { method: 'POST' },
            { status: 403 }
          )
        )
        ctx.WebApiManager.joinProject(ctx.project_id, ctx.user_id, ctx.callback)
      })

      it('should call the callback with an error', function (ctx) {
        ctx.callback
          .calledWith(
            sinon.match({
              message: 'not authorized',
            })
          )
          .should.equal(true)
      })
    })

    describe('when web replies with a 404', function () {
      beforeEach(function (ctx) {
        ctx.fetchUtils.fetchJson.rejects(
          new RequestFailedError(
            `/project/${ctx.project_id}/join`,
            { method: 'POST' },
            { status: 404 }
          )
        )
        ctx.WebApiManager.joinProject(ctx.project_id, ctx.user_id, ctx.callback)
      })

      it('should call the callback with an error', function (ctx) {
        ctx.callback
          .calledWith(
            sinon.match({
              message: 'project not found',
              info: { code: 'ProjectNotFound' },
            })
          )
          .should.equal(true)
      })
    })

    describe('with an error from web', function () {
      beforeEach(function (ctx) {
        ctx.fetchUtils.fetchJson.rejects(
          new RequestFailedError(
            `/project/${ctx.project_id}/join`,
            { method: 'POST' },
            { status: 500 }
          )
        )
        ctx.WebApiManager.joinProject(ctx.project_id, ctx.user_id, ctx.callback)
      })

      it('should call the callback with an error', function (ctx) {
        ctx.callback
          .calledWith(
            sinon.match({
              message: 'non-success status code from web',
              info: { statusCode: 500 },
            })
          )
          .should.equal(true)
      })
    })

    describe('with no data from web', function () {
      beforeEach(function (ctx) {
        ctx.fetchUtils.fetchJson.resolves(null)
        ctx.WebApiManager.joinProject(ctx.project_id, ctx.user_id, ctx.callback)
      })

      it('should call the callback with an error', function (ctx) {
        ctx.callback
          .calledWith(
            sinon.match({
              message: 'no data returned from joinProject request',
            })
          )
          .should.equal(true)
      })
    })

    describe('when the project is over its rate limit', function () {
      beforeEach(function (ctx) {
        ctx.fetchUtils.fetchJson.rejects(
          new RequestFailedError(
            `/project/${ctx.project_id}/join`,
            { method: 'POST' },
            { status: 429 }
          )
        )
        ctx.WebApiManager.joinProject(ctx.project_id, ctx.user_id, ctx.callback)
      })

      it('should call the callback with a TooManyRequests error code', function (ctx) {
        ctx.callback
          .calledWith(
            sinon.match({
              message: 'rate-limit hit when joining project',
              info: {
                code: 'TooManyRequests',
              },
            })
          )
          .should.equal(true)
      })
    })
  })
})
