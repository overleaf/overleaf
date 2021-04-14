const User = require('./helpers/User')
const request = require('./helpers/request')
const async = require('async')
const { expect } = require('chai')
const settings = require('settings-sharelatex')
const { db, ObjectId } = require('../../../app/src/infrastructure/mongodb')
const { Subscription } = require('../../../app/src/models/Subscription')
const SubscriptionViewModelBuilder = require('../../../app/src/Features/Subscription/SubscriptionViewModelBuilder')
const MockDocstoreApiClass = require('./mocks/MockDocstoreApi')
const MockFilestoreApiClass = require('./mocks/MockFilestoreApi')

let MockDocstoreApi, MockFilestoreApi

before(function () {
  MockDocstoreApi = MockDocstoreApiClass.instance()
  MockFilestoreApi = MockFilestoreApiClass.instance()
})

describe('Deleting a user', function () {
  beforeEach(function (done) {
    this.user = new User()
    async.series(
      [
        this.user.ensureUserExists.bind(this.user),
        this.user.login.bind(this.user)
      ],
      done
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

  it('Should fail if the user has a subscription', function (done) {
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
              sendImmediately: true
            }
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
          dummyFile: 'wombat'
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

      it('Should destroy the files', function (done) {
        expect(MockFilestoreApi.files[this.projectId.toString()]).to.exist

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

            expect(MockFilestoreApi.files[this.projectId.toString()]).not.to
              .exist
            done()
          }
        )
      })

      it('Should remove the project data from mongo', function (done) {
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

  describe('when the deleted project has deletedFiles', function () {
    beforeEach('delete project', function (done) {
      this.user.deleteProject(this.projectId, done)
    })
    let fileId1, fileId2
    beforeEach('create files', function () {
      // take a short cut and just allocate file ids
      fileId1 = ObjectId()
      fileId2 = ObjectId()
    })
    const otherFileDetails = {
      name: 'universe.jpg',
      linkedFileData: null,
      hash: 'ed19e7d6779b47d8c63f6fa5a21954dcfb6cac00',
      deletedAt: new Date()
    }
    beforeEach('insert deletedFiles', async function () {
      const deletedFiles = [
        { _id: fileId1, ...otherFileDetails },
        { _id: fileId2, ...otherFileDetails },
        // duplicate entry
        { _id: fileId1, ...otherFileDetails }
      ]
      await db.deletedProjects.updateOne(
        { 'deleterData.deletedProjectId': ObjectId(this.projectId) },
        { $set: { 'project.deletedFiles': deletedFiles } }
      )
    })
    describe('when undelete the project', function () {
      let admin
      beforeEach('create admin', function (done) {
        admin = new User()
        async.series(
          [
            cb => admin.ensureUserExists(cb),
            cb => admin.ensureAdmin(cb),
            cb => admin.login(cb)
          ],
          done
        )
      })
      beforeEach('undelete project', function (done) {
        admin.undeleteProject(this.projectId, done)
      })

      it('should not insert deletedFiles into the projects collection', function (done) {
        this.user.getProject(this.projectId, (error, project) => {
          if (error) return done(error)
          expect(project.deletedFiles).to.deep.equal([])
          done()
        })
      })

      it('should insert unique entries into the deletedFiles collection', async function () {
        const docs = await db.deletedFiles
          .find({}, { sort: { _id: 1 } })
          .toArray()
        expect(docs).to.deep.equal([
          { _id: fileId1, projectId: this.projectId, ...otherFileDetails },
          { _id: fileId2, projectId: this.projectId, ...otherFileDetails }
        ])
      })
    })
  })

  describe('when the deleted project has deletedDocs', function () {
    beforeEach('delete project', function (done) {
      this.user.deleteProject(this.projectId, done)
    })

    let deletedDocs
    beforeEach('set deletedDocs', function () {
      deletedDocs = [
        { _id: ObjectId(), name: 'foo.tex', deletedAt: new Date() },
        { _id: ObjectId(), name: 'bar.tex', deletedAt: new Date() }
      ]
      deletedDocs.forEach(doc => {
        MockDocstoreApi.createLegacyDeletedDoc(
          this.projectId,
          doc._id.toString()
        )
      })
    })

    beforeEach('insert deletedDocs', async function () {
      await db.deletedProjects.updateOne(
        { 'deleterData.deletedProjectId': ObjectId(this.projectId) },
        { $set: { 'project.deletedDocs': deletedDocs } }
      )
    })

    it('should not see any doc names before', async function () {
      const docs = MockDocstoreApi.getDeletedDocs(this.projectId)
      expect(docs).to.deep.equal(
        deletedDocs.map(doc => {
          const { _id } = doc
          return { _id: _id.toString(), name: undefined }
        })
      )
    })

    describe('when undeleting the project', function () {
      let admin
      beforeEach('create admin', function (done) {
        admin = new User()
        async.series(
          [
            cb => admin.ensureUserExists(cb),
            cb => admin.ensureAdmin(cb),
            cb => admin.login(cb)
          ],
          done
        )
      })
      beforeEach('undelete project', function (done) {
        admin.undeleteProject(this.projectId, done)
      })

      it('should not insert deletedDocs into the projects collection', function (done) {
        this.user.getProject(this.projectId, (error, project) => {
          if (error) return done(error)
          expect(project.deletedDocs).to.deep.equal([])
          done()
        })
      })

      it('should back fill deleted docs context', async function () {
        const docs = MockDocstoreApi.getDeletedDocs(this.projectId)
        expect(docs).to.deep.equal(
          deletedDocs.map(doc => {
            const { _id, name } = doc
            return { _id: _id.toString(), name }
          })
        )
      })
    })
  })
})
