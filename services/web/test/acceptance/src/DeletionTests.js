const User = require('./helpers/User')
const request = require('./helpers/request')
const async = require('async')
const { expect } = require('chai')
const settings = require('settings-sharelatex')
const { db, ObjectId } = require('../../../app/src/infrastructure/mongojs')
const { Subscription } = require('../../../app/src/models/Subscription')
const SubscriptionViewModelBuilder = require('../../../app/src/Features/Subscription/SubscriptionViewModelBuilder')
const MockDocstoreApi = require('./helpers/MockDocstoreApi')
require('./helpers/MockTagsApi')
require('./helpers/MockV1Api')

describe('Deleting a user', function() {
  beforeEach(function(done) {
    this.user = new User()
    async.series(
      [
        this.user.ensureUserExists.bind(this.user),
        this.user.login.bind(this.user),
        this.user.activateSudoMode.bind(this.user)
      ],
      done
    )
  })

  it('Should remove the user from active users', function(done) {
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

  it('Should create a soft-deleted user', function(done) {
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

  it('Should fail if the user has a subscription', function(done) {
    Subscription.create(
      {
        admin_id: this.user._id,
        manager_ids: [this.user._id],
        planCode: 'collaborator'
      },
      error => {
        expect(error).not.to.exist
        SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel(
          this.user,
          error => {
            expect(error).not.to.exist
            this.user.deleteUser(error => {
              expect(error).to.exist
              done()
            })
          }
        )
      }
    )
  })

  it("Should delete the user's projects", function(done) {
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

  describe('when scrubbing the user', function() {
    beforeEach(function(done) {
      this.user.get((error, user) => {
        if (error) {
          throw error
        }
        this.userId = user._id
        this.user.deleteUser(done)
      })
    })

    it('Should remove the user data from mongo', function(done) {
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
                sendImmediately: true
              }
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

describe('Deleting a project', function() {
  beforeEach(function(done) {
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

  it('Should remove the project from active projects', function(done) {
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

  it('Should create a soft-deleted project', function(done) {
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

  describe('When the project has docs', function() {
    beforeEach(function(done) {
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
      })
    })

    it('should mark the docs as deleted', function(done) {
      let doc =
        MockDocstoreApi.docs[this.projectId.toString()][this.docId.toString()]
      expect(doc).to.exist
      expect(doc.deleted).to.be.falsey
      this.user.deleteProject(this.projectId, error => {
        expect(error).not.to.exist
        let doc =
          MockDocstoreApi.docs[this.projectId.toString()][this.docId.toString()]
        expect(doc).to.exist
        expect(doc.deleted).to.be.truthy
        done()
      })
    })

    describe('When the deleted project is expired', function() {
      beforeEach(function(done) {
        this.user.deleteProject(this.projectId, error => {
          if (error) {
            throw error
          }
          done()
        })
      })

      it('Should destroy the docs', function(done) {
        expect(
          MockDocstoreApi.docs[this.projectId.toString()][this.docId.toString()]
        ).to.exist

        request.post(
          `/internal/project/${this.projectId}/expire-deleted-project`,
          {
            auth: {
              user: settings.apis.web.user,
              pass: settings.apis.web.pass,
              sendImmediately: true
            }
          },
          (error, res) => {
            expect(error).not.to.exist
            expect(res.statusCode).to.equal(200)

            expect(MockDocstoreApi.docs[this.projectId.toString()]).not.to.exist
            done()
          }
        )
      })

      it('Should remove the project data from mongo', function(done) {
        db.deletedProjects.findOne(
          { 'deleterData.deletedProjectId': ObjectId(this.projectId) },
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
                  sendImmediately: true
                }
              },
              (error, res) => {
                expect(error).not.to.exist
                expect(res.statusCode).to.equal(200)

                db.deletedProjects.findOne(
                  { 'deleterData.deletedProjectId': ObjectId(this.projectId) },
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
    })
  })
})
