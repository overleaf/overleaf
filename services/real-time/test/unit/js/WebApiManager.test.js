import { vi, describe, beforeEach, it } from 'vitest'
/* eslint-disable
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
import sinon from 'sinon'

const modulePath = '../../../app/js/WebApiManager.js'

describe('WebApiManager', function () {
  beforeEach(async function (ctx) {
    ctx.project_id = 'project-id-123'
    ctx.user_id = 'user-id-123'
    ctx.user = { _id: ctx.user_id }
    ctx.callback = sinon.stub()

    vi.doMock('request', () => ({
      default: (ctx.request = {}),
    }))

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

    return (ctx.WebApiManager = (await import(modulePath)).default)
  })

  return describe('joinProject', function () {
    describe('successfully', function () {
      beforeEach(function (ctx) {
        ctx.response = {
          project: { name: 'Test project' },
          privilegeLevel: 'owner',
          isRestrictedUser: true,
          isTokenMember: true,
          isInvitedMember: true,
        }
        ctx.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 200 }, ctx.response)
        return ctx.WebApiManager.joinProject(
          ctx.project_id,
          ctx.user,
          ctx.callback
        )
      })

      it('should send a request to web to join the project', function (ctx) {
        return ctx.request.post
          .calledWith({
            url: `${ctx.settings.apis.web.url}/project/${ctx.project_id}/join`,
            auth: {
              user: ctx.settings.apis.web.user,
              pass: ctx.settings.apis.web.pass,
              sendImmediately: true,
            },
            json: {
              userId: ctx.user_id,
              anonymousAccessToken: undefined,
            },
            jar: false,
          })
          .should.equal(true)
      })

      return it('should return the project, privilegeLevel, and restricted flag', function (ctx) {
        return ctx.callback
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
        ctx.request.post = sinon
          .stub()
          .yields(null, { statusCode: 200 }, ctx.response)
        ctx.WebApiManager.joinProject(ctx.project_id, ctx.user, ctx.callback)
      })

      it('should send a request to web to join the project', function (ctx) {
        ctx.request.post.should.have.been.calledWith({
          url: `${ctx.settings.apis.web.url}/project/${ctx.project_id}/join`,
          auth: {
            user: ctx.settings.apis.web.user,
            pass: ctx.settings.apis.web.pass,
            sendImmediately: true,
          },
          json: {
            userId: ctx.user_id,
            anonymousAccessToken: ctx.token,
          },
          jar: false,
        })
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
        ctx.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 403 }, null)
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
        ctx.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 404 }, null)
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
        ctx.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, null)
        return ctx.WebApiManager.joinProject(
          ctx.project_id,
          ctx.user_id,
          ctx.callback
        )
      })

      return it('should call the callback with an error', function (ctx) {
        return ctx.callback
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
        ctx.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 200 }, null)
        return ctx.WebApiManager.joinProject(
          ctx.project_id,
          ctx.user_id,
          ctx.callback
        )
      })

      return it('should call the callback with an error', function (ctx) {
        return ctx.callback
          .calledWith(
            sinon.match({
              message: 'no data returned from joinProject request',
            })
          )
          .should.equal(true)
      })
    })

    return describe('when the project is over its rate limit', function () {
      beforeEach(function (ctx) {
        ctx.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 429 }, null)
        return ctx.WebApiManager.joinProject(
          ctx.project_id,
          ctx.user_id,
          ctx.callback
        )
      })

      return it('should call the callback with a TooManyRequests error code', function (ctx) {
        return ctx.callback
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
