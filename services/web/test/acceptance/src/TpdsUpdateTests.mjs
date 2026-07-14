import { expect } from 'chai'
import sinon from 'sinon'
import ProjectGetter from '../../../app/src/Features/Project/ProjectGetter.mjs'
import ProjectOptionsHandler from '../../../app/src/Features/Project/ProjectOptionsHandler.mjs'
import ProjectRootDocManager from '../../../app/src/Features/Project/ProjectRootDocManager.mjs'
import request from './helpers/request.js'
import User from './helpers/User.mjs'

describe('TpdsUpdateTests', function () {
  beforeEach(function () {
    // Creating a project via TPDS schedules a root doc reset on a 30s timer,
    // which graceful shutdown waits for, exceeding the "after all" hook
    // timeout when stopping the app.
    this.setRootDocStub = sinon.stub(
      ProjectRootDocManager,
      'setRootDocAutomaticallyInBackground'
    )
  })

  afterEach(function () {
    this.setRootDocStub.restore()
  })

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

  describe('resolving a project by name', function () {
    it('should return the id of the matching project', function (done) {
      request(
        {
          method: 'POST',
          url: `/user/${this.owner._id}/project/resolve`,
          auth: {
            username: 'overleaf',
            password: 'password',
            sendImmediately: true,
          },
          json: { projectName: 'test-project' },
        },
        (error, response, body) => {
          if (error) {
            throw error
          }
          expect(response.statusCode).to.equal(200)
          expect(body).to.deep.equal({
            status: 'success',
            projectId: this.projectId,
            historyId: 1,
            otMigrationStage: 0,
          })
          done()
        }
      )
    })

    it('should create a project when the name does not match', function (done) {
      request(
        {
          method: 'POST',
          url: `/user/${this.owner._id}/project/resolve`,
          auth: {
            username: 'overleaf',
            password: 'password',
            sendImmediately: true,
          },
          json: { projectName: 'brand-new-project' },
        },
        (error, response, body) => {
          if (error) {
            throw error
          }
          expect(response.statusCode).to.equal(200)
          expect(body.status).to.equal('success')
          expect(body.projectId).to.exist
          expect(body.projectId).to.not.equal(this.projectId)
          expect(body.otMigrationStage).to.equal(0)
          ProjectGetter.findAllUsersProjects(
            this.owner._id,
            'name',
            (err, projects) => {
              expect(err).to.not.exist
              const created = projects.owned.find(
                project => project._id.toString() === body.projectId
              )
              expect(created).to.exist
              expect(created.name).to.equal('brand-new-project')
              done()
            }
          )
        }
      )
    })

    it('should return the otMigrationStage of the matching project', function (done) {
      ProjectOptionsHandler.promises
        .setOTMigrationStage(this.projectId, 1)
        .then(() => {
          request(
            {
              method: 'POST',
              url: `/user/${this.owner._id}/project/resolve`,
              auth: {
                username: 'overleaf',
                password: 'password',
                sendImmediately: true,
              },
              json: { projectName: 'test-project' },
            },
            (error, response, body) => {
              if (error) {
                throw error
              }
              expect(response.statusCode).to.equal(200)
              expect(body).to.deep.equal({
                status: 'success',
                projectId: this.projectId,
                historyId: 1,
                otMigrationStage: 1,
              })
              done()
            }
          )
        })
        .catch(done)
    })

    it('should create a project when the user only has read-only access to the matching project', function (done) {
      this.reader = new User()
      this.reader.login(error => {
        expect(error).to.not.exist
        this.owner.addUserToProject(
          this.projectId,
          this.reader,
          'readOnly',
          error => {
            expect(error).to.not.exist
            request(
              {
                method: 'POST',
                url: `/user/${this.reader._id}/project/resolve`,
                auth: {
                  username: 'overleaf',
                  password: 'password',
                  sendImmediately: true,
                },
                json: { projectName: 'test-project' },
              },
              (error, response, body) => {
                if (error) {
                  throw error
                }
                expect(response.statusCode).to.equal(200)
                expect(body.status).to.equal('success')
                expect(body.projectId).to.exist
                expect(body.projectId).to.not.equal(this.projectId)
                ProjectGetter.findAllUsersProjects(
                  this.reader._id,
                  'name',
                  (err, projects) => {
                    expect(err).to.not.exist
                    const created = projects.owned.find(
                      project => project._id.toString() === body.projectId
                    )
                    expect(created).to.exist
                    expect(created.name).to.equal('test-project')
                    done()
                  }
                )
              }
            )
          }
        )
      })
    })

    it('should reject when the project is archived', function (done) {
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
              url: `/user/${this.owner._id}/project/resolve`,
              auth: {
                username: 'overleaf',
                password: 'password',
                sendImmediately: true,
              },
              json: { projectName: 'test-project' },
            },
            (error, response, body) => {
              if (error) {
                throw error
              }
              expect(response.statusCode).to.equal(200)
              expect(body).to.deep.equal({ status: 'rejected' })
              ProjectGetter.findAllUsersProjects(
                this.owner._id,
                'name',
                (err, projects) => {
                  expect(err).to.not.exist
                  expect(projects.owned.length).to.equal(1)
                  done()
                }
              )
            }
          )
        }
      )
    })
  })

  describe('resolving a project by id', function () {
    it('should return the id of the matching project', function (done) {
      request(
        {
          method: 'POST',
          url: `/user/${this.owner._id}/project/resolve`,
          auth: {
            username: 'overleaf',
            password: 'password',
            sendImmediately: true,
          },
          json: { projectId: this.projectId },
        },
        (error, response, body) => {
          if (error) {
            throw error
          }
          expect(response.statusCode).to.equal(200)
          expect(body).to.deep.equal({
            status: 'success',
            projectId: this.projectId,
            historyId: 1,
            otMigrationStage: 0,
          })
          done()
        }
      )
    })

    it('should reject when the user only has read-only access', function (done) {
      this.reader = new User()
      this.reader.login(error => {
        expect(error).to.not.exist
        this.owner.addUserToProject(
          this.projectId,
          this.reader,
          'readOnly',
          error => {
            expect(error).to.not.exist
            request(
              {
                method: 'POST',
                url: `/user/${this.reader._id}/project/resolve`,
                auth: {
                  username: 'overleaf',
                  password: 'password',
                  sendImmediately: true,
                },
                json: { projectId: this.projectId },
              },
              (error, response, body) => {
                if (error) {
                  throw error
                }
                expect(response.statusCode).to.equal(200)
                expect(body).to.deep.equal({ status: 'rejected' })
                done()
              }
            )
          }
        )
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
