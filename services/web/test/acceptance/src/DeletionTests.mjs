import User from './helpers/User.mjs'
import Subscription from './helpers/Subscription.mjs'
import request from './helpers/request.js'
import async from 'async'
import { expect } from 'chai'
import settings from '@overleaf/settings'
import { db, ObjectId } from '../../../app/src/infrastructure/mongodb.js'
import Features from '../../../app/src/infrastructure/Features.js'
import MockDocstoreApiClass from './mocks/MockDocstoreApi.mjs'
import MockFilestoreApiClass from './mocks/MockFilestoreApi.mjs'
import MockChatApiClass from './mocks/MockChatApi.mjs'
import MockGitBridgeApiClass from './mocks/MockGitBridgeApi.mjs'
import MockHistoryBackupDeletionApiClass from './mocks/MockHistoryBackupDeletionApi.mjs'

let MockDocstoreApi,
  MockFilestoreApi,
  MockChatApi,
  MockGitBridgeApi,
  MockHistoryBackupDeletionApi

before(function () {
  MockDocstoreApi = MockDocstoreApiClass.instance()
  MockFilestoreApi = MockFilestoreApiClass.instance()
  MockChatApi = MockChatApiClass.instance()
  MockGitBridgeApi = MockGitBridgeApiClass.instance()
  MockHistoryBackupDeletionApi = MockHistoryBackupDeletionApiClass.instance()
})

describe('Deleting a user', function () {
  beforeEach(function (done) {
    async.auto(
      {
        user: cb => {
          const user = new User()
          user.ensureUserExists(() => {
            cb(null, user)
          })
        },
        login: [
          'user',
          (results, cb) => {
            results.user.login(cb)
          },
        ],
        subscription: [
          'user',
          'login',
          (results, cb) => {
            const subscription = new Subscription({
              admin_id: results.user._id,
            })
            subscription.ensureExists(err => {
              cb(err, subscription)
            })
          },
        ],
      },
      (err, results) => {
        expect(err).not.to.exist
        this.user = results.user
        this.subscription = results.subscription
        done()
      }
    )
  })

  it('Should remove the user from active users', function (done) {
    this.user.get((error, user) => {
      expect(error).not.to.exist
      expect(user).to.exist
      this.user.deleteUser(error => {
        expect(error).not.to.exist
        this.user.get((error, user) => {
          expect(error).not.to.exist
          expect(user).not.to.exist
          done()
        })
      })
    })
  })

  it('Should create a soft-deleted user', function (done) {
    this.user.get((error, user) => {
      expect(error).not.to.exist
      this.user.deleteUser(error => {
        expect(error).not.to.exist
        db.deletedUsers.findOne(
          { 'user._id': user._id },
          (error, deletedUser) => {
            expect(error).not.to.exist
            expect(deletedUser).to.exist
            // it should set the 'deleterData' correctly
            expect(deletedUser.deleterData.deleterId.toString()).to.equal(
              user._id.toString()
            )
            expect(deletedUser.deleterData.deletedUserId.toString()).to.equal(
              user._id.toString()
            )
            expect(deletedUser.deleterData.deletedUserReferralId).to.equal(
              user.referal_id
            )
            // it should set the 'user' correctly
            expect(deletedUser.user._id.toString()).to.equal(
              user._id.toString()
            )
            expect(deletedUser.user.email).to.equal(user.email)
            done()
          }
        )
      })
    })
  })

  it("Should delete the user's projects", function (done) {
    this.user.createProject('wombat', (error, projectId) => {
      expect(error).not.to.exist
      this.user.getProject(projectId, (error, project) => {
        expect(error).not.to.exist
        expect(project).to.exist

        this.user.deleteUser(error => {
          expect(error).not.to.exist
          this.user.getProject(projectId, (error, project) => {
            expect(error).not.to.exist
            expect(project).not.to.exist
            done()
          })
        })
      })
    })
  })

  describe('when scrubbing the user', function () {
    beforeEach(function (done) {
      this.user.get((error, user) => {
        if (error) {
          throw error
        }
        this.userId = user._id
        this.user.deleteUser(done)
      })
    })

    it('Should remove the user data from mongo', function (done) {
      db.deletedUsers.findOne(
        { 'deleterData.deletedUserId': this.userId },
        (error, deletedUser) => {
          expect(error).not.to.exist
          expect(deletedUser).to.exist
          expect(deletedUser.deleterData.deleterIpAddress).to.exist
          expect(deletedUser.user).to.exist

          request.post(
            `/internal/users/${this.userId}/expire`,
            {
              auth: {
                user: settings.apis.web.user,
                pass: settings.apis.web.pass,
                sendImmediately: true,
              },
            },
            (error, res) => {
              expect(error).not.to.exist
              expect(res.statusCode).to.equal(204)

              db.deletedUsers.findOne(
                { 'deleterData.deletedUserId': this.userId },
                (error, deletedUser) => {
                  expect(error).not.to.exist
                  expect(deletedUser).to.exist
                  expect(deletedUser.deleterData.deleterIpAddress).not.to.exist
                  expect(deletedUser.user).not.to.exist
                  done()
                }
              )
            }
          )
        }
      )
    })
  })
})

describe('Deleting a project', function () {
  beforeEach(function (done) {
    this.user = new User()
    this.projectName = 'wombat'
    this.user.ensureUserExists(() => {
      this.user.login(() => {
        this.user.createProject(this.projectName, (_e, projectId) => {
          this.projectId = projectId
          done()
        })
      })
    })
  })

  it('Should remove the project from active projects', function (done) {
    this.user.getProject(this.projectId, (error, project) => {
      expect(error).not.to.exist
      expect(project).to.exist

      this.user.deleteProject(this.projectId, error => {
        expect(error).not.to.exist

        this.user.getProject(this.projectId, (error, project) => {
          expect(error).not.to.exist
          expect(project).not.to.exist
          done()
        })
      })
    })
  })

  it('Should create a soft-deleted project', function (done) {
    this.user.getProject(this.projectId, (error, project) => {
      expect(error).not.to.exist

      this.user.get((error, user) => {
        expect(error).not.to.exist

        this.user.deleteProject(this.projectId, error => {
          expect(error).not.to.exist

          db.deletedProjects.findOne(
            { 'deleterData.deletedProjectId': project._id },
            (error, deletedProject) => {
              expect(error).not.to.exist
              expect(deletedProject).to.exist

              // it should set the 'deleterData' correctly
              expect(deletedProject.deleterData.deleterId.toString()).to.equal(
                user._id.toString()
              )
              expect(
                deletedProject.deleterData.deletedProjectId.toString()
              ).to.equal(project._id.toString())
              expect(
                deletedProject.deleterData.deletedProjectOwnerId.toString()
              ).to.equal(user._id.toString())
              // it should set the 'user' correctly
              expect(deletedProject.project._id.toString()).to.equal(
                project._id.toString()
              )
              expect(deletedProject.project.name).to.equal(this.projectName)

              done()
            }
          )
        })
      })
    })
  })

  describe('when the project has deleted files', function () {
    beforeEach('get rootFolder id', function (done) {
      this.user.getProject(this.projectId, (error, project) => {
        if (error) return done(error)
        this.rootFolder = project.rootFolder[0]._id
        done()
      })
    })

    let allFileIds
    beforeEach('reset allFileIds', function () {
      allFileIds = []
    })
    function createAndDeleteFile(name) {
      let fileId
      beforeEach(`create file ${name}`, function (done) {
        this.user.uploadExampleFileInProject(
          this.projectId,
          this.rootFolder,
          name,
          (error, theFileId) => {
            fileId = theFileId
            allFileIds.push(theFileId)
            done(error)
          }
        )
      })
      beforeEach(`delete file ${name}`, function (done) {
        this.user.deleteItemInProject(this.projectId, 'file', fileId, done)
      })
    }
    for (const name of ['a.png', 'another.png']) {
      createAndDeleteFile(name)
    }

    it('should have two deleteFiles entries', async function () {
      const files = await db.deletedFiles
        .find({}, { sort: { _id: 1 } })
        .toArray()
      expect(files).to.have.length(2)
      expect(files.map(file => file._id.toString())).to.deep.equal(allFileIds)
    })

    describe('When the deleted project is expired', function () {
      beforeEach('soft delete the project', function (done) {
        this.user.deleteProject(this.projectId, done)
      })
      beforeEach('hard delete the project', function (done) {
        request.post(
          `/internal/project/${this.projectId}/expire-deleted-project`,
          {
            auth: {
              user: settings.apis.web.user,
              pass: settings.apis.web.pass,
              sendImmediately: true,
            },
          },
          (error, res) => {
            expect(error).not.to.exist
            expect(res.statusCode).to.equal(200)

            done()
          }
        )
      })

      it('should cleanup the deleteFiles', async function () {
        const files = await db.deletedFiles
          .find({}, { sort: { _id: 1 } })
          .toArray()
        expect(files).to.deep.equal([])
      })
    })
  })

  describe('When the project has docs', function () {
    beforeEach(function (done) {
      this.user.getProject(this.projectId, (error, project) => {
        if (error) {
          throw error
        }
        this.user.createDocInProject(
          this.projectId,
          project.rootFolder[0]._id,
          'potato',
          (error, docId) => {
            if (error) {
              throw error
            }
            this.docId = docId
            done()
          }
        )
        MockFilestoreApi.files[this.projectId.toString()] = {
          dummyFile: 'wombat',
        }
        MockChatApi.projects[this.projectId.toString()] = ['message']
        if (Features.hasFeature('git-bridge')) {
          MockGitBridgeApi.projects[this.projectId.toString()] = {
            data: 'some-data',
          }
        }
      })
    })

    describe('When the deleted project is expired', function () {
      beforeEach(function (done) {
        this.user.deleteProject(this.projectId, error => {
          if (error) {
            throw error
          }
          done()
        })
      })

      it('Should destroy the docs', function (done) {
        expect(
          MockDocstoreApi.docs[this.projectId.toString()][this.docId.toString()]
        ).to.exist

        request.post(
          `/internal/project/${this.projectId}/expire-deleted-project`,
          {
            auth: {
              user: settings.apis.web.user,
              pass: settings.apis.web.pass,
              sendImmediately: true,
            },
          },
          (error, res) => {
            expect(error).not.to.exist
            expect(res.statusCode).to.equal(200)

            expect(MockDocstoreApi.docs[this.projectId.toString()]).not.to.exist
            done()
          }
        )
      })

      it('Should destroy the files', function (done) {
        expect(MockFilestoreApi.files[this.projectId.toString()]).to.exist

        request.post(
          `/internal/project/${this.projectId}/expire-deleted-project`,
          {
            auth: {
              user: settings.apis.web.user,
              pass: settings.apis.web.pass,
              sendImmediately: true,
            },
          },
          (error, res) => {
            expect(error).not.to.exist
            expect(res.statusCode).to.equal(200)

            expect(MockFilestoreApi.files[this.projectId.toString()]).not.to
              .exist
            done()
          }
        )
      })

      it('Should destroy the chat', function (done) {
        expect(MockChatApi.projects[this.projectId.toString()]).to.exist

        request.post(
          `/internal/project/${this.projectId}/expire-deleted-project`,
          {
            auth: {
              user: settings.apis.web.user,
              pass: settings.apis.web.pass,
              sendImmediately: true,
            },
          },
          (error, res) => {
            expect(error).not.to.exist
            expect(res.statusCode).to.equal(200)

            expect(MockChatApi.projects[this.projectId.toString()]).not.to.exist
            done()
          }
        )
      })

      it('Should remove the project data from mongo', function (done) {
        db.deletedProjects.findOne(
          { 'deleterData.deletedProjectId': new ObjectId(this.projectId) },
          (error, deletedProject) => {
            expect(error).not.to.exist
            expect(deletedProject).to.exist
            expect(deletedProject.project).to.exist
            expect(deletedProject.deleterData.deleterIpAddress).to.exist
            expect(deletedProject.deleterData.deletedAt).to.exist

            request.post(
              `/internal/project/${this.projectId}/expire-deleted-project`,
              {
                auth: {
                  user: settings.apis.web.user,
                  pass: settings.apis.web.pass,
                  sendImmediately: true,
                },
              },
              (error, res) => {
                expect(error).not.to.exist
                expect(res.statusCode).to.equal(200)

                db.deletedProjects.findOne(
                  {
                    'deleterData.deletedProjectId': new ObjectId(
                      this.projectId
                    ),
                  },
                  (error, deletedProject) => {
                    expect(error).not.to.exist
                    expect(deletedProject).to.exist
                    expect(deletedProject.project).not.to.exist
                    expect(deletedProject.deleterData.deleterIpAddress).not.to
                      .exist
                    expect(deletedProject.deleterData.deletedAt).to.exist
                    done()
                  }
                )
              }
            )
          }
        )
      })

      if (Features.hasFeature('saas')) {
        it('Should destroy the history backup', function (done) {
          MockHistoryBackupDeletionApi.prepareProject(this.projectId, 204)

          request.post(
            `/internal/project/${this.projectId}/expire-deleted-project`,
            {
              auth: {
                user: settings.apis.web.user,
                pass: settings.apis.web.pass,
                sendImmediately: true,
              },
            },
            (error, res) => {
              expect(error).not.to.exist
              expect(res.statusCode).to.equal(200)

              expect(
                MockHistoryBackupDeletionApi.projects[this.projectId.toString()]
              ).not.to.exist
              done()
            }
          )
        })

        it('Should abort when the history backup cannot be deleted', function (done) {
          MockHistoryBackupDeletionApi.prepareProject(this.projectId, 422)

          request.post(
            `/internal/project/${this.projectId}/expire-deleted-project`,
            {
              auth: {
                user: settings.apis.web.user,
                pass: settings.apis.web.pass,
                sendImmediately: true,
              },
            },
            (error, res) => {
              expect(error).not.to.exist
              expect(res.statusCode).to.equal(500)

              expect(
                MockHistoryBackupDeletionApi.projects[this.projectId.toString()]
              ).to.exist
              db.deletedProjects.findOne(
                {
                  'deleterData.deletedProjectId': new ObjectId(this.projectId),
                },
                (error, deletedProject) => {
                  expect(error).not.to.exist
                  expect(deletedProject).to.exist
                  expect(deletedProject.project).to.exist
                  done()
                }
              )
            }
          )
        })
      }
    })
  })

  if (Features.hasFeature('git-bridge')) {
    describe('When the project has git-bridge data', function () {
      beforeEach(function () {
        MockGitBridgeApi.projects[this.projectId.toString()] = {
          data: 'some-data',
        }
      })

      describe('When the deleted project is expired', function () {
        beforeEach(function (done) {
          this.user.deleteProject(this.projectId, error => {
            if (error) {
              return done(error)
            }
            request.post(
              `/internal/project/${this.projectId}/expire-deleted-project`,
              {
                auth: {
                  user: settings.apis.web.user,
                  pass: settings.apis.web.pass,
                  sendImmediately: true,
                },
              },
              (error, res) => {
                if (error) {
                  return done(error)
                }
                expect(res.statusCode).to.equal(200)
                done()
              }
            )
          })
        })

        it('should delete the git-bridge data', function () {
          expect(MockGitBridgeApi.projects[this.projectId.toString()]).not.to
            .exist
        })
      })
    })
  }
})
