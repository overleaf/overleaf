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
const sinon = require('sinon')
const modulePath = '../../../app/js/WebApiManager.js'
const SandboxedModule = require('sandboxed-module')
const { CodedError } = require('../../../app/js/Errors')

describe('WebApiManager', function () {
  beforeEach(function () {
    this.project_id = 'project-id-123'
    this.user_id = 'user-id-123'
    this.user = { _id: this.user_id }
    this.callback = sinon.stub()
    return (this.WebApiManager = SandboxedModule.require(modulePath, {
      requires: {
        request: (this.request = {}),
        '@overleaf/settings': (this.settings = {
          apis: {
            web: {
              url: 'http://web.example.com',
              user: 'username',
              pass: 'password',
            },
          },
        }),
      },
    }))
  })

  return describe('joinProject', function () {
    describe('successfully', function () {
      beforeEach(function () {
        this.response = {
          project: { name: 'Test project' },
          privilegeLevel: 'owner',
          isRestrictedUser: true,
          isTokenMember: true,
          isInvitedMember: true,
        }
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 200 }, this.response)
        return this.WebApiManager.joinProject(
          this.project_id,
          this.user,
          this.callback
        )
      })

      it('should send a request to web to join the project', function () {
        return this.request.post
          .calledWith({
            url: `${this.settings.apis.web.url}/project/${this.project_id}/join`,
            qs: {
              user_id: this.user_id,
            },
            auth: {
              user: this.settings.apis.web.user,
              pass: this.settings.apis.web.pass,
              sendImmediately: true,
            },
            json: true,
            jar: false,
            headers: {},
          })
          .should.equal(true)
      })

      return it('should return the project, privilegeLevel, and restricted flag', function () {
        return this.callback
          .calledWith(
            null,
            this.response.project,
            this.response.privilegeLevel,
            {
              isRestrictedUser: this.response.isRestrictedUser,
              isTokenMember: this.response.isTokenMember,
              isInvitedMember: this.response.isInvitedMember,
            }
          )
          .should.equal(true)
      })
    })

    describe('when web replies with a 403', function () {
      beforeEach(function () {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 403 }, null)
        this.WebApiManager.joinProject(
          this.project_id,
          this.user_id,
          this.callback
        )
      })

      it('should call the callback with an error', function () {
        this.callback
          .calledWith(
            sinon.match({
              message: 'not authorized',
            })
          )
          .should.equal(true)
      })
    })

    describe('when web replies with a 404', function () {
      beforeEach(function () {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 404 }, null)
        this.WebApiManager.joinProject(
          this.project_id,
          this.user_id,
          this.callback
        )
      })

      it('should call the callback with an error', function () {
        this.callback
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
      beforeEach(function () {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, null)
        return this.WebApiManager.joinProject(
          this.project_id,
          this.user_id,
          this.callback
        )
      })

      return it('should call the callback with an error', function () {
        return this.callback
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
      beforeEach(function () {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 200 }, null)
        return this.WebApiManager.joinProject(
          this.project_id,
          this.user_id,
          this.callback
        )
      })

      return it('should call the callback with an error', function () {
        return this.callback
          .calledWith(
            sinon.match({
              message: 'no data returned from joinProject request',
            })
          )
          .should.equal(true)
      })
    })

    return describe('when the project is over its rate limit', function () {
      beforeEach(function () {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 429 }, null)
        return this.WebApiManager.joinProject(
          this.project_id,
          this.user_id,
          this.callback
        )
      })

      return it('should call the callback with a TooManyRequests error code', function () {
        return this.callback
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
