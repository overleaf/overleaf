/* eslint-disable
    camelcase,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { expect } = require('chai')
const ProjectGetter = require('../../../app/src/Features/Project/ProjectGetter.js')
const request = require('./helpers/request')
const User = require('./helpers/User')

describe('TpdsUpdateTests', function() {
  beforeEach(function(done) {
    this.owner = new User()
    return this.owner.login(error => {
      if (error != null) {
        throw error
      }
      return this.owner.createProject(
        'test-project',
        { template: 'example' },
        (error, project_id) => {
          if (error != null) {
            throw error
          }
          this.project_id = project_id
          return done()
        }
      )
    })
  })

  describe('deleting a file', function() {
    beforeEach(function(done) {
      return request(
        {
          method: 'DELETE',
          url: `/project/${this.project_id}/contents/main.tex`,
          auth: {
            username: 'sharelatex',
            password: 'password',
            sendImmediately: true
          }
        },
        (error, response, body) => {
          if (error != null) {
            throw error
          }
          expect(response.statusCode).to.equal(200)
          return done()
        }
      )
    })

    it('should have deleted the file', function(done) {
      return ProjectGetter.getProject(this.project_id, (error, project) => {
        if (error != null) {
          throw error
        }
        const projectFolder = project.rootFolder[0]
        for (let doc of Array.from(projectFolder.docs)) {
          if (doc.name === 'main.tex') {
            throw new Error('expected main.tex to have been deleted')
          }
        }
        return done()
      })
    })
  })
})
