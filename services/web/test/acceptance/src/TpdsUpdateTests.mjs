import { expect } from 'chai'
import ProjectGetter from '../../../app/src/Features/Project/ProjectGetter.js'
import request from './helpers/request.js'
import User from './helpers/User.mjs'

describe('TpdsUpdateTests', function () {
  beforeEach(function (done) {
    this.owner = new User()
    this.owner.login(error => {
      if (error) {
        throw error
      }
      this.owner.createProject(
        'test-project',
        { template: 'example' },
        (error, projectId) => {
          if (error) {
            throw error
          }
          this.projectId = projectId
          done()
        }
      )
    })
  })

  describe('adding a file', function () {
    beforeEach(function (done) {
      request(
        {
          method: 'POST',
          url: `/project/${this.projectId}/contents/test.tex`,
          auth: {
            username: 'overleaf',
            password: 'password',
            sendImmediately: true,
          },
          body: 'test one two',
        },
        (error, response, body) => {
          if (error) {
            throw error
          }
          expect(response.statusCode).to.equal(200)
          done()
        }
      )
    })

    it('should have added the file', function (done) {
      ProjectGetter.getProject(this.projectId, (error, project) => {
        if (error) {
          throw error
        }
        const projectFolder = project.rootFolder[0]
        const file = projectFolder.docs.find(e => e.name === 'test.tex')
        expect(file).to.exist
        done()
      })
    })
  })

  describe('deleting a file', function () {
    beforeEach(function (done) {
      request(
        {
          method: 'DELETE',
          url: `/project/${this.projectId}/contents/main.tex`,
          auth: {
            username: 'overleaf',
            password: 'password',
            sendImmediately: true,
          },
        },
        (error, response, body) => {
          if (error) {
            throw error
          }
          expect(response.statusCode).to.equal(200)
          done()
        }
      )
    })

    it('should have deleted the file', function (done) {
      ProjectGetter.getProject(this.projectId, (error, project) => {
        if (error) {
          throw error
        }
        const projectFolder = project.rootFolder[0]
        for (const doc of projectFolder.docs) {
          if (doc.name === 'main.tex') {
            throw new Error('expected main.tex to have been deleted')
          }
        }
        done()
      })
    })
  })

  describe('update a new file', function () {
    beforeEach(function (done) {
      request(
        {
          method: 'POST',
          url: `/user/${this.owner._id}/update/test-project/other.tex`,
          auth: {
            username: 'overleaf',
            password: 'password',
            sendImmediately: true,
          },
          body: 'test one two',
        },
        (error, response, body) => {
          if (error) {
            throw error
          }
          expect(response.statusCode).to.equal(200)
          const json = JSON.parse(response.body)
          expect(json.status).to.equal('applied')
          expect(json.entityType).to.equal('doc')
          expect(json).to.have.property('entityId')
          expect(json).to.have.property('rev')
          done()
        }
      )
    })

    it('should have added the file', function (done) {
      ProjectGetter.getProject(this.projectId, (error, project) => {
        if (error) {
          throw error
        }
        const projectFolder = project.rootFolder[0]
        const file = projectFolder.docs.find(e => e.name === 'other.tex')
        expect(file).to.exist
        done()
      })
    })
  })

  describe('update when the project is archived', function () {
    beforeEach(function (done) {
      this.owner.request(
        {
          url: `/Project/${this.projectId}/archive`,
          method: 'post',
        },
        (err, response, body) => {
          expect(err).to.not.exist
          request(
            {
              method: 'POST',
              url: `/user/${this.owner._id}/update/test-project/test.tex`,
              auth: {
                username: 'overleaf',
                password: 'password',
                sendImmediately: true,
              },
              body: 'test one two',
            },
            (error, response, body) => {
              if (error) {
                throw error
              }
              expect(response.statusCode).to.equal(200)
              const json = JSON.parse(response.body)
              expect(json.status).to.equal('rejected')
              done()
            }
          )
        }
      )
    })

    it('should not have created a new project', function (done) {
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

    it('should not have added the file', function (done) {
      ProjectGetter.getProject(this.projectId, (error, project) => {
        if (error) {
          throw error
        }
        const projectFolder = project.rootFolder[0]
        const file = projectFolder.docs.find(e => e.name === 'test.tex')
        expect(file).to.not.exist
        done()
      })
    })
  })
})
