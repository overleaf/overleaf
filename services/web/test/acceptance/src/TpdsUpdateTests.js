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

  describe('adding a file', function() {
    beforeEach(function(done) {
      return request(
        {
          method: 'POST',
          url: `/project/${this.project_id}/contents/test.tex`,
          auth: {
            username: 'sharelatex',
            password: 'password',
            sendImmediately: true
          },
          body: 'test one two'
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

    it('should have added the file', function(done) {
      return ProjectGetter.getProject(this.project_id, (error, project) => {
        if (error != null) {
          throw error
        }
        const projectFolder = project.rootFolder[0]
        const file = projectFolder.docs.find(e => e.name === 'test.tex')
        expect(file).to.exist
        return done()
      })
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

  describe('update a new file', function() {
    beforeEach(function(done) {
      return request(
        {
          method: 'POST',
          url: `/user/${this.owner._id}/update/test-project/other.tex`,
          auth: {
            username: 'sharelatex',
            password: 'password',
            sendImmediately: true
          },
          body: 'test one two'
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

    it('should have added the file', function(done) {
      return ProjectGetter.getProject(this.project_id, (error, project) => {
        if (error != null) {
          throw error
        }
        const projectFolder = project.rootFolder[0]
        const file = projectFolder.docs.find(e => e.name === 'other.tex')
        expect(file).to.exist
        return done()
      })
    })
  })

  describe('update when the project is archived', function() {
    beforeEach(function(done) {
      this.owner.request(
        {
          url: `/Project/${this.project_id}/archive`,
          method: 'post'
        },
        (err, response, body) => {
          expect(err).to.not.exist
          return request(
            {
              method: 'POST',
              url: `/user/${this.owner._id}/update/test-project/test.tex`,
              auth: {
                username: 'sharelatex',
                password: 'password',
                sendImmediately: true
              },
              body: 'test one two'
            },
            (error, response, body) => {
              if (error != null) {
                throw error
              }
              expect(response.statusCode).to.equal(409)
              return done()
            }
          )
        }
      )
    })

    it('should not have created a new project', function(done) {
      ProjectGetter.findAllUsersProjects(
        this.owner._id,
        'name',
        (err, projects) => {
          expect(err).to.not.exist
          expect(projects.owned.length).to.equal(1)
          done()
        }
      )
    })

    it('should not have added the file', function(done) {
      return ProjectGetter.getProject(this.project_id, (error, project) => {
        if (error != null) {
          throw error
        }
        const projectFolder = project.rootFolder[0]
        const file = projectFolder.docs.find(e => e.name === 'test.tex')
        expect(file).to.not.exist
        return done()
      })
    })
  })
})
