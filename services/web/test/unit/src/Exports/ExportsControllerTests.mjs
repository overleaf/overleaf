// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import esmock from 'esmock'
import { expect } from 'chai'
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

  beforeEach(async function () {
    this.handler = { getUserNotifications: sinon.stub().callsArgWith(1) }
    this.req = {
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
    this.res = {
      json: sinon.stub(),
      status: sinon.stub(),
    }
    this.res.status.returns(this.res)
    this.next = sinon.stub()
    this.AuthenticationController = {
      getLoggedInUserId: sinon.stub().returns(this.req.session.user._id),
    }
    return (this.controller = await esmock.strict(modulePath, {
      '../../../../app/src/Features/Exports/ExportsHandler.mjs': this.handler,
      '../../../../app/src/Features/Authentication/AuthenticationController.js':
        this.AuthenticationController,
    }))
  })

  describe('without gallery fields', function () {
    it('should ask the handler to perform the export', function (done) {
      this.handler.exportProject = sinon
        .stub()
        .yields(null, { iAmAnExport: true, v1_id: 897 })
      const expected = {
        project_id: projectId,
        user_id: userId,
        brand_variation_id: brandVariationId,
        first_name: firstName,
        last_name: lastName,
      }
      return this.controller.exportProject(this.req, {
        json: body => {
          expect(this.handler.exportProject.args[0][0]).to.deep.equal(expected)
          expect(body).to.deep.equal({ export_v1_id: 897, message: undefined })
          return done()
        },
      })
    })
  })

  describe('with a message from v1', function () {
    it('should ask the handler to perform the export', function (done) {
      this.handler.exportProject = sinon.stub().yields(null, {
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
      return this.controller.exportProject(this.req, {
        json: body => {
          expect(this.handler.exportProject.args[0][0]).to.deep.equal(expected)
          expect(body).to.deep.equal({
            export_v1_id: 897,
            message: 'RESUBMISSION',
          })
          return done()
        },
      })
    })
  })

  describe('with gallery fields', function () {
    beforeEach(function () {
      this.req.body.title = title
      this.req.body.description = description
      this.req.body.author = author
      this.req.body.license = license
      return (this.req.body.showSource = true)
    })

    it('should ask the handler to perform the export', function (done) {
      this.handler.exportProject = sinon
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
      return this.controller.exportProject(this.req, {
        json: body => {
          expect(this.handler.exportProject.args[0][0]).to.deep.equal(expected)
          expect(body).to.deep.equal({ export_v1_id: 897, message: undefined })
          return done()
        },
      })
    })
  })

  describe('with an error return from v1 to forward to the publish modal', function () {
    it('should forward the response onward', function (done) {
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

  it('should ask the handler to return the status of an export', function (done) {
    this.handler.fetchExport = sinon.stub().yields(
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

    this.req.params = { project_id: projectId, export_id: 897 }
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
            token: 'token',
          },
        })
        return done()
      },
    })
  })
})
