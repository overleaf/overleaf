import { expect } from 'chai'
import sinon from 'sinon'
import { Project } from '../../../app/src/models/Project.mjs'
import ProjectGetter from '../../../app/src/Features/Project/ProjectGetter.mjs'
import ProjectOptionsHandler from '../../../app/src/Features/Project/ProjectOptionsHandler.mjs'
import ProjectRootDocManager from '../../../app/src/Features/Project/ProjectRootDocManager.mjs'
import MockDocUpdaterApiClass from './mocks/MockDocUpdaterApi.mjs'
import request from './helpers/request.js'
import User from './helpers/User.mjs'
import { db, ObjectId } from '../../../app/src/infrastructure/mongodb.mjs'

let MockDocUpdaterApi

before(function () {
  MockDocUpdaterApi = MockDocUpdaterApiClass.instance()
})

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

  describe('updating an existing file as a user', function () {
    function updateMainTex(userId, done) {
      request(
        {
          method: 'POST',
          url: `/user/${userId}/update/test-project/main.tex`,
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
          expect(JSON.parse(response.body).status).to.equal('applied')
          done()
        }
      )
    }

    describe('with track changes disabled', function () {
      beforeEach(function (done) {
        updateMainTex(this.owner._id, done)
      })

      it('should send the update to document-updater without track changes', function () {
        const requests = MockDocUpdaterApi.getReceivedSetDocRequests(
          this.projectId
        )
        expect(requests).to.have.length(1)
        expect(requests[0].body.lines).to.deep.equal(['test one two'])
        expect(requests[0].body.user_id).to.equal(this.owner._id.toString())
        expect(requests[0].body.trackChanges).to.equal(false)
      })
    })

    describe('with track changes enabled for the user', function () {
      beforeEach(function (done) {
        Project.updateOne(
          { _id: this.projectId },
          { track_changes: { [this.owner._id.toString()]: true } }
        )
          .then(() => updateMainTex(this.owner._id, done))
          .catch(done)
      })

      it('should ask document-updater to record the update as tracked changes', function () {
        const requests = MockDocUpdaterApi.getReceivedSetDocRequests(
          this.projectId
        )
        expect(requests).to.have.length(1)
        expect(requests[0].body.user_id).to.equal(this.owner._id.toString())
        expect(requests[0].body.trackChanges).to.equal(true)
      })
    })

    describe('with track changes enabled for another user', function () {
      beforeEach(function (done) {
        Project.updateOne(
          { _id: this.projectId },
          { track_changes: { '5c41deb2b4ca500153340809': true } }
        )
          .then(() => updateMainTex(this.owner._id, done))
          .catch(done)
      })

      it('should not ask document-updater to record the update as tracked changes', function () {
        const requests = MockDocUpdaterApi.getReceivedSetDocRequests(
          this.projectId
        )
        expect(requests).to.have.length(1)
        expect(requests[0].body.trackChanges).to.equal(false)
      })
    })
  })

  describe('updating an existing file as a user by project id', function () {
    beforeEach(function (done) {
      Project.updateOne(
        { _id: this.projectId },
        { track_changes: { [this.owner._id.toString()]: true } }
      )
        .then(() => {
          request(
            {
              method: 'POST',
              url: `/project/${this.projectId}/user/${this.owner._id}/update/main.tex`,
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
              expect(JSON.parse(response.body).status).to.equal('applied')
              done()
            }
          )
        })
        .catch(done)
    })

    it('should ask document-updater to record the update as tracked changes', function () {
      const requests = MockDocUpdaterApi.getReceivedSetDocRequests(
        this.projectId
      )
      expect(requests).to.have.length(1)
      expect(requests[0].body.user_id).to.equal(this.owner._id.toString())
      expect(requests[0].body.trackChanges).to.equal(true)
    })
  })

  describe('updating an existing file via the project contents route', function () {
    // Updates via the project contents route (used by github-sync) carry no
    // user id: the synced commits can come from any GitHub user, so they are
    // never recorded as tracked changes.
    beforeEach(function (done) {
      Project.updateOne(
        { _id: this.projectId },
        { track_changes: { [this.owner._id.toString()]: true } }
      )
        .then(() => {
          request(
            {
              method: 'POST',
              url: `/project/${this.projectId}/contents/main.tex`,
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
        .catch(done)
    })

    it('should send the update to document-updater without track changes', function () {
      const requests = MockDocUpdaterApi.getReceivedSetDocRequests(
        this.projectId
      )
      expect(requests).to.have.length(1)
      expect(requests[0].body.user_id).to.equal(null)
      expect(requests[0].body.trackChanges).to.equal(false)
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

  describe('update a new file by project id', function () {
    it('should add the file', function (done) {
      request(
        {
          method: 'POST',
          url: `/project/${this.projectId}/user/${this.owner._id}/update/by-id.tex`,
          auth: {
            username: 'overleaf',
            password: 'password',
            sendImmediately: true,
          },
          body: 'test one two',
        },
        (error, response) => {
          if (error) {
            throw error
          }
          expect(response.statusCode).to.equal(200)
          const json = JSON.parse(response.body)
          expect(json.status).to.equal('applied')
          ProjectGetter.getProject(this.projectId, (error, project) => {
            if (error) {
              throw error
            }
            const projectFolder = project.rootFolder[0]
            const file = projectFolder.docs.find(e => e.name === 'by-id.tex')
            expect(file).to.exist
            done()
          })
        }
      )
    })

    it('should reject the update when the project is archived', function (done) {
      this.owner.request(
        {
          url: `/Project/${this.projectId}/archive`,
          method: 'post',
        },
        err => {
          expect(err).to.not.exist
          request(
            {
              method: 'POST',
              url: `/project/${this.projectId}/user/${this.owner._id}/update/by-id.tex`,
              auth: {
                username: 'overleaf',
                password: 'password',
                sendImmediately: true,
              },
              body: 'test one two',
            },
            (error, response) => {
              if (error) {
                throw error
              }
              expect(response.statusCode).to.equal(200)
              const json = JSON.parse(response.body)
              expect(json.status).to.equal('rejected')
              ProjectGetter.getProject(this.projectId, (error, project) => {
                if (error) {
                  throw error
                }
                const projectFolder = project.rootFolder[0]
                const file = projectFolder.docs.find(
                  e => e.name === 'by-id.tex'
                )
                expect(file).to.not.exist
                done()
              })
            }
          )
        }
      )
    })
  })

  describe('delete a file by project id', function () {
    it('should delete the file', function (done) {
      request(
        {
          method: 'DELETE',
          url: `/project/${this.projectId}/user/${this.owner._id}/update/main.tex`,
          auth: {
            username: 'overleaf',
            password: 'password',
            sendImmediately: true,
          },
        },
        (error, response) => {
          if (error) {
            throw error
          }
          expect(response.statusCode).to.equal(200)
          ProjectGetter.getProject(this.projectId, (error, project) => {
            if (error) {
              throw error
            }
            const projectFolder = project.rootFolder[0]
            const file = projectFolder.docs.find(e => e.name === 'main.tex')
            expect(file).to.not.exist
            done()
          })
        }
      )
    })

    it('should not delete the file when the user only has read-only access', function (done) {
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
                method: 'DELETE',
                url: `/project/${this.projectId}/user/${this.reader._id}/update/main.tex`,
                auth: {
                  username: 'overleaf',
                  password: 'password',
                  sendImmediately: true,
                },
              },
              (error, response) => {
                if (error) {
                  throw error
                }
                expect(response.statusCode).to.equal(200)
                ProjectGetter.getProject(this.projectId, (error, project) => {
                  if (error) {
                    throw error
                  }
                  const projectFolder = project.rootFolder[0]
                  const file = projectFolder.docs.find(
                    e => e.name === 'main.tex'
                  )
                  expect(file).to.exist
                  done()
                })
              }
            )
          }
        )
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

    it('should match the project name case-insensitively', function (done) {
      request(
        {
          method: 'POST',
          url: `/user/${this.owner._id}/project/resolve`,
          auth: {
            username: 'overleaf',
            password: 'password',
            sendImmediately: true,
          },
          json: { projectName: 'TEST-Project' },
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

    it('should resolve the project when the user is an invited read-write collaborator', function (done) {
      this.collaborator = new User()
      this.collaborator.login(error => {
        expect(error).to.not.exist
        this.owner.addUserToProject(
          this.projectId,
          this.collaborator,
          'readAndWrite',
          error => {
            expect(error).to.not.exist
            request(
              {
                method: 'POST',
                url: `/user/${this.collaborator._id}/project/resolve`,
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
          }
        )
      })
    })

    it('should not treat a project that is both owned and a collaboration as a duplicate', function (done) {
      this.owner.addUserToProject(
        this.projectId,
        this.owner,
        'readAndWrite',
        error => {
          expect(error).to.not.exist
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
        }
      )
    })

    it('should reject when more than one project matches the name', function (done) {
      this.owner.createProject('test-project', (error, secondProjectId) => {
        expect(error).to.not.exist
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
                expect(projects.owned.length).to.equal(2)
                done()
              }
            )
          }
        )
      })
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

    it('should reject when the project does not exist', function (done) {
      request(
        {
          method: 'POST',
          url: `/user/${this.owner._id}/project/resolve`,
          auth: {
            username: 'overleaf',
            password: 'password',
            sendImmediately: true,
          },
          json: { projectId: new ObjectId().toString() },
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
    })

    it('should reject when the user has no access to the project', function (done) {
      this.otherUser = new User()
      this.otherUser.login(error => {
        expect(error).to.not.exist
        request(
          {
            method: 'POST',
            url: `/user/${this.otherUser._id}/project/resolve`,
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
      })
    })

    it('should reject when the user is a token-access read-write member', function (done) {
      this.tokenMember = new User()
      this.tokenMember.login(error => {
        expect(error).to.not.exist
        db.projects
          .updateOne(
            { _id: new ObjectId(this.projectId) },
            {
              $set: { publicAccesLevel: 'tokenBased' },
              $addToSet: {
                tokenAccessReadAndWrite_refs: new ObjectId(
                  this.tokenMember._id
                ),
              },
            }
          )
          .then(() => {
            request(
              {
                method: 'POST',
                url: `/user/${this.tokenMember._id}/project/resolve`,
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
          })
          .catch(done)
      })
    })

    it('should reject when the project is archived', function (done) {
      this.owner.request(
        {
          url: `/Project/${this.projectId}/archive`,
          method: 'post',
        },
        err => {
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

    it('should reject when the project is trashed', function (done) {
      this.owner.request(
        {
          url: `/project/${this.projectId}/trash`,
          method: 'post',
        },
        err => {
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
