/* eslint-disable
    camelcase,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { expect } = require('chai')
const request = require('./helpers/request')
const _ = require('underscore')

const User = require('./helpers/User')
const ProjectGetter = require('../../../app/src/Features/Project/ProjectGetter.js')
const ExportsHandler = require('../../../app/src/Features/Exports/ExportsHandler.js')

const MockProjectHistoryApi = require('./helpers/MockProjectHistoryApi')
const MockV1Api = require('./helpers/MockV1Api')

describe('Exports', function() {
  beforeEach(function(done) {
    this.brand_variation_id = '18'
    this.owner = new User()
    return this.owner.login(error => {
      if (error != null) {
        throw error
      }
      return this.owner.createProject(
        'example-project',
        { template: 'example' },
        (error, project_id) => {
          this.project_id = project_id
          if (error != null) {
            throw error
          }
          return done()
        }
      )
    })
  })

  describe('exporting a project', function() {
    beforeEach(function(done) {
      this.version = Math.floor(Math.random() * 10000)
      MockProjectHistoryApi.setProjectVersion(this.project_id, this.version)
      this.export_id = Math.floor(Math.random() * 10000)
      MockV1Api.setExportId(this.export_id)
      MockV1Api.clearExportParams()
      return this.owner.request(
        {
          method: 'POST',
          url: `/project/${this.project_id}/export/${this.brand_variation_id}`,
          json: true,
          body: {
            title: 'title',
            description: 'description',
            author: 'author',
            license: 'other',
            showSource: true
          }
        },
        (error, response, body) => {
          if (error != null) {
            throw error
          }
          expect(response.statusCode).to.equal(200)
          this.exportResponseBody = body
          return done()
        }
      )
    })

    it('should have sent correct data to v1', function(done) {
      const {
        project,
        user,
        destination,
        options
      } = MockV1Api.getLastExportParams()
      // project details should match
      expect(project.id).to.equal(this.project_id)
      expect(project.rootDocPath).to.equal('/main.tex')
      // gallery details should match
      expect(project.metadata.title).to.equal('title')
      expect(project.metadata.description).to.equal('description')
      expect(project.metadata.author).to.equal('author')
      expect(project.metadata.license).to.equal('other')
      expect(project.metadata.showSource).to.equal(true)
      // version should match what was retrieved from project-history
      expect(project.historyVersion).to.equal(this.version)
      // user details should match
      expect(user.id).to.equal(this.owner.id)
      expect(user.email).to.equal(this.owner.email)
      // brand-variation should match
      expect(destination.brandVariationId).to.equal(this.brand_variation_id)
      return done()
    })

    it('should have returned the export ID provided by v1', function(done) {
      expect(this.exportResponseBody.export_v1_id).to.equal(this.export_id)
      return done()
    })
  })
})
