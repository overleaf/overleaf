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
const { expect } = require('chai')
const modulePath = '../../../../app/js/WebApiManager.js'
const SandboxedModule = require('sandboxed-module')

describe('WebApiManager', function () {
  beforeEach(function () {
    this.WebApiManager = SandboxedModule.require(modulePath, {
      requires: {
        requestretry: (this.request = {}),
        'settings-sharelatex': (this.settings = {
          apis: {
            web: {
              url: 'http://example.com',
              user: 'sharelatex',
              pass: 'password'
            }
          }
        })
      }
    })
    this.callback = sinon.stub()
    this.user_id = 'mock-user-id'
    this.project_id = 'mock-project-id'
    this.user_info = {
      email: 'leo@sharelatex.com',
      id: this.user_id,
      first_name: 'Leo',
      last_nane: 'Lion',
      extra_param: 'blah'
    }
    return (this.project = { features: 'mock-features' })
  })

  describe('getUserInfo', function () {
    describe('successfully', function () {
      beforeEach(function () {
        this.body = JSON.stringify(this.user_info)
        this.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 200 }, this.body)
        return this.WebApiManager.getUserInfo(this.user_id, this.callback)
      })

      it('should get the user from the web api', function () {
        return this.request.get
          .calledWithMatch({
            url: `${this.settings.apis.web.url}/user/${this.user_id}/personal_info`,
            auth: {
              user: this.settings.apis.web.user,
              pass: this.settings.apis.web.pass,
              sendImmediately: true
            }
          })
          .should.equal(true)
      })

      return it('should call the callback with only the email, id and names', function () {
        return this.callback
          .calledWith(null, {
            id: this.user_id,
            email: this.user_info.email,
            first_name: this.user_info.first_name,
            last_name: this.user_info.last_name
          })
          .should.equal(true)
      })
    })

    describe('when the web API returns an error', function () {
      beforeEach(function () {
        this.request.get = sinon
          .stub()
          .callsArgWith(
            1,
            (this.error = new Error('something went wrong')),
            null,
            null
          )
        return this.WebApiManager.getUserInfo(this.user_id, this.callback)
      })

      return it('should return an error to the callback', function () {
        return this.callback.calledWith(this.error).should.equal(true)
      })
    })

    describe('when the web returns a failure error code', function () {
      beforeEach(function () {
        this.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500, attempts: 42 }, '')
        return this.WebApiManager.getUserInfo(this.user_id, this.callback)
      })

      return it('should return the callback with an error', function () {
        return this.callback
          .calledWith(
            sinon.match.has(
              'message',
              'web returned a non-success status code: 500 (attempts: 42)'
            )
          )
          .should.equal(true)
      })
    })

    return describe('when the user cannot be found', function () {
      beforeEach(function () {
        this.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 404 }, 'nothing')
        return this.WebApiManager.getUserInfo(this.user_id, this.callback)
      })

      return it('should return a null value', function () {
        return this.callback.calledWith(null, null).should.equal(true)
      })
    })
  })

  return describe('getProjectDetails', function () {
    describe('successfully', function () {
      beforeEach(function () {
        this.body = JSON.stringify(this.project)
        this.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 200 }, this.body)
        return this.WebApiManager.getProjectDetails(
          this.project_id,
          this.callback
        )
      })

      it('should get the project from the web api', function () {
        return this.request.get
          .calledWithMatch({
            url: `${this.settings.apis.web.url}/project/${this.project_id}/details`,
            auth: {
              user: this.settings.apis.web.user,
              pass: this.settings.apis.web.pass,
              sendImmediately: true
            }
          })
          .should.equal(true)
      })

      return it('should call the callback with the project', function () {
        return this.callback.calledWith(null, this.project).should.equal(true)
      })
    })

    describe('when the web API returns an error', function () {
      beforeEach(function () {
        this.request.get = sinon
          .stub()
          .callsArgWith(
            1,
            (this.error = new Error('something went wrong')),
            null,
            null
          )
        return this.WebApiManager.getProjectDetails(
          this.project_id,
          this.callback
        )
      })

      return it('should return an error to the callback', function () {
        return this.callback.calledWith(this.error).should.equal(true)
      })
    })

    return describe('when the web returns a failure error code', function () {
      beforeEach(function () {
        this.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500, attempts: 42 }, '')
        return this.WebApiManager.getProjectDetails(
          this.project_id,
          this.callback
        )
      })

      return it('should return the callback with an error', function () {
        return this.callback
          .calledWith(
            sinon.match.has(
              'message',
              'web returned a non-success status code: 500 (attempts: 42)'
            )
          )
          .should.equal(true)
      })
    })
  })
})
