/* eslint-disable
    camelcase,
    max-len,
    no-return-assign,
    no-unused-vars,
    no-useless-escape,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const chai = require('chai')
const { expect } = chai
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Exports/ExportsController.js'
)

describe('ExportsController', function() {
  const project_id = '123njdskj9jlk'
  const user_id = '123nd3ijdks'
  const brand_variation_id = 22
  const firstName = 'first'
  const lastName = 'last'
  const title = 'title'
  const description = 'description'
  const author = 'author'
  const license = 'other'
  const show_source = true

  beforeEach(function() {
    this.handler = { getUserNotifications: sinon.stub().callsArgWith(1) }
    this.req = {
      params: {
        project_id,
        brand_variation_id
      },
      body: {
        firstName,
        lastName
      },
      session: {
        user: {
          _id: user_id
        }
      },
      i18n: {
        translate() {}
      }
    }
    this.res = {
      json: sinon.stub(),
      status: sinon.stub()
    }
    this.res.status.returns(this.res)
    this.next = sinon.stub()
    this.AuthenticationController = {
      getLoggedInUserId: sinon.stub().returns(this.req.session.user._id)
    }
    return (this.controller = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        './ExportsHandler': this.handler,
        'logger-sharelatex': {
          log() {},
          err() {}
        },
        '../Authentication/AuthenticationController': this
          .AuthenticationController
      }
    }))
  })

  describe('without gallery fields', function() {
    it('should ask the handler to perform the export', function(done) {
      this.handler.exportProject = sinon
        .stub()
        .yields(null, { iAmAnExport: true, v1_id: 897 })
      const expected = {
        project_id,
        user_id,
        brand_variation_id,
        first_name: firstName,
        last_name: lastName
      }
      return this.controller.exportProject(this.req, {
        json: body => {
          expect(this.handler.exportProject.args[0][0]).to.deep.equal(expected)
          expect(body).to.deep.equal({ export_v1_id: 897 })
          return done()
        }
      })
    })
  })

  describe('with gallery fields', function() {
    beforeEach(function() {
      this.req.body.title = title
      this.req.body.description = description
      this.req.body.author = author
      this.req.body.license = license
      return (this.req.body.showSource = true)
    })

    it('should ask the handler to perform the export', function(done) {
      this.handler.exportProject = sinon
        .stub()
        .yields(null, { iAmAnExport: true, v1_id: 897 })
      const expected = {
        project_id,
        user_id,
        brand_variation_id,
        first_name: firstName,
        last_name: lastName,
        title,
        description,
        author,
        license,
        show_source
      }
      return this.controller.exportProject(this.req, {
        json: body => {
          expect(this.handler.exportProject.args[0][0]).to.deep.equal(expected)
          expect(body).to.deep.equal({ export_v1_id: 897 })
          return done()
        }
      })
    })
  })

  describe('with an error return from v1 to forward to the publish modal', function() {
    it('should forward the response onward', function(done) {
      this.error_json = { status: 422, message: 'nope' }
      this.handler.exportProject = sinon
        .stub()
        .yields({ forwardResponse: this.error_json })
      this.controller.exportProject(this.req, this.res, this.next)
      expect(this.res.json.args[0][0]).to.deep.equal(this.error_json)
      expect(this.res.status.args[0][0]).to.equal(this.error_json.status)
      return done()
    })
  })

  it('should ask the handler to return the status of an export', function(done) {
    this.handler.fetchExport = sinon.stub().yields(
      null,
      `{ \
\"id\":897, \
\"status_summary\":\"completed\", \
\"status_detail\":\"all done\", \
\"partner_submission_id\":\"abc123\", \
\"v2_user_email\":\"la@tex.com\", \
\"v2_user_first_name\":\"Arthur\", \
\"v2_user_last_name\":\"Author\", \
\"title\":\"my project\", \
\"token\":\"token\" \
}`
    )

    this.req.params = { project_id, export_id: 897 }
    return this.controller.exportStatus(this.req, {
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
            token: 'token'
          }
        })
        return done()
      }
    })
  })
})
