/* eslint-disable
    handle-callback-err,
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const chai = require('chai')
const should = chai.should()
const { expect } = chai
const modulePath =
  '../../../../app/src/Features/Authorization/AuthorizationManager.js'
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../../../app/src/Features/Errors/Errors.js')

describe('AuthorizationManager', function() {
  beforeEach(function() {
    this.AuthorizationManager = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../Collaborators/CollaboratorsHandler': (this.CollaboratorsHandler = {}),
        '../Project/ProjectGetter': (this.ProjectGetter = {}),
        '../../models/User': {
          User: (this.User = {})
        },
        '../Errors/Errors': Errors,
        '../TokenAccess/TokenAccessHandler': (this.TokenAccessHandler = {
          isValidToken: sinon.stub().callsArgWith(2, null, false, false)
        }),
        'settings-sharelatex': { passwordStrengthOptions: {} }
      }
    })
    this.user_id = 'user-id-1'
    this.project_id = 'project-id-1'
    this.token = 'some-token'
    return (this.callback = sinon.stub())
  })

  describe('getPrivilegeLevelForProject', function() {
    beforeEach(function() {
      this.ProjectGetter.getProject = sinon.stub()
      this.AuthorizationManager.isUserSiteAdmin = sinon.stub()
      return (this.CollaboratorsHandler.getMemberIdPrivilegeLevel = sinon.stub())
    })

    describe('with a token-based project', function() {
      beforeEach(function() {
        return this.ProjectGetter.getProject
          .withArgs(this.project_id, { publicAccesLevel: 1 })
          .yields(null, { publicAccesLevel: 'tokenBased' })
      })

      describe('with a user_id with a privilege level', function() {
        beforeEach(function() {
          this.AuthorizationManager.isUserSiteAdmin
            .withArgs(this.user_id)
            .yields(null, false)
          this.CollaboratorsHandler.getMemberIdPrivilegeLevel
            .withArgs(this.user_id, this.project_id)
            .yields(null, 'readOnly')
          return this.AuthorizationManager.getPrivilegeLevelForProject(
            this.user_id,
            this.project_id,
            this.token,
            this.callback
          )
        })

        it("should return the user's privilege level", function() {
          return this.callback
            .calledWith(null, 'readOnly', false, false)
            .should.equal(true)
        })
      })

      describe('with a user_id with no privilege level', function() {
        beforeEach(function() {
          this.AuthorizationManager.isUserSiteAdmin
            .withArgs(this.user_id)
            .yields(null, false)
          this.CollaboratorsHandler.getMemberIdPrivilegeLevel
            .withArgs(this.user_id, this.project_id)
            .yields(null, false)
          return this.AuthorizationManager.getPrivilegeLevelForProject(
            this.user_id,
            this.project_id,
            this.token,
            this.callback
          )
        })

        it('should return false', function() {
          return this.callback
            .calledWith(null, false, false, false)
            .should.equal(true)
        })
      })

      describe('with a user_id who is an admin', function() {
        beforeEach(function() {
          this.AuthorizationManager.isUserSiteAdmin
            .withArgs(this.user_id)
            .yields(null, true)
          this.CollaboratorsHandler.getMemberIdPrivilegeLevel
            .withArgs(this.user_id, this.project_id)
            .yields(null, false)
          return this.AuthorizationManager.getPrivilegeLevelForProject(
            this.user_id,
            this.project_id,
            this.token,
            this.callback
          )
        })

        it('should return the user as an owner', function() {
          return this.callback
            .calledWith(null, 'owner', false, true)
            .should.equal(true)
        })
      })

      describe('with no user (anonymous)', function() {
        describe('when the token is not valid', function() {
          beforeEach(function() {
            this.TokenAccessHandler.isValidToken = sinon
              .stub()
              .withArgs(this.project_id, this.token)
              .yields(null, false, false)
            return this.AuthorizationManager.getPrivilegeLevelForProject(
              null,
              this.project_id,
              this.token,
              this.callback
            )
          })

          it('should not call CollaboratorsHandler.getMemberIdPrivilegeLevel', function() {
            return this.CollaboratorsHandler.getMemberIdPrivilegeLevel.called.should.equal(
              false
            )
          })

          it('should not call AuthorizationManager.isUserSiteAdmin', function() {
            return this.AuthorizationManager.isUserSiteAdmin.called.should.equal(
              false
            )
          })

          it('should check if the token is valid', function() {
            return this.TokenAccessHandler.isValidToken
              .calledWith(this.project_id, this.token)
              .should.equal(true)
          })

          it('should return false', function() {
            return this.callback
              .calledWith(null, false, false, false)
              .should.equal(true)
          })
        })

        describe('when the token is valid for read-and-write', function() {
          describe('when read-write-sharing is not enabled', function() {
            beforeEach(function() {
              this.TokenAccessHandler.ANONYMOUS_READ_AND_WRITE_ENABLED = false
              this.TokenAccessHandler.isValidToken = sinon
                .stub()
                .withArgs(this.project_id, this.token)
                .yields(null, true, false)
              return this.AuthorizationManager.getPrivilegeLevelForProject(
                null,
                this.project_id,
                this.token,
                this.callback
              )
            })

            it('should not call CollaboratorsHandler.getMemberIdPrivilegeLevel', function() {
              return this.CollaboratorsHandler.getMemberIdPrivilegeLevel.called.should.equal(
                false
              )
            })

            it('should not call AuthorizationManager.isUserSiteAdmin', function() {
              return this.AuthorizationManager.isUserSiteAdmin.called.should.equal(
                false
              )
            })

            it('should check if the token is valid', function() {
              return this.TokenAccessHandler.isValidToken
                .calledWith(this.project_id, this.token)
                .should.equal(true)
            })

            it('should deny access', function() {
              return this.callback
                .calledWith(null, false, false, false)
                .should.equal(true)
            })
          })

          describe('when read-write-sharing is enabled', function() {
            beforeEach(function() {
              this.TokenAccessHandler.ANONYMOUS_READ_AND_WRITE_ENABLED = true
              this.TokenAccessHandler.isValidToken = sinon
                .stub()
                .withArgs(this.project_id, this.token)
                .yields(null, true, false)
              return this.AuthorizationManager.getPrivilegeLevelForProject(
                null,
                this.project_id,
                this.token,
                this.callback
              )
            })

            it('should not call CollaboratorsHandler.getMemberIdPrivilegeLevel', function() {
              return this.CollaboratorsHandler.getMemberIdPrivilegeLevel.called.should.equal(
                false
              )
            })

            it('should not call AuthorizationManager.isUserSiteAdmin', function() {
              return this.AuthorizationManager.isUserSiteAdmin.called.should.equal(
                false
              )
            })

            it('should check if the token is valid', function() {
              return this.TokenAccessHandler.isValidToken
                .calledWith(this.project_id, this.token)
                .should.equal(true)
            })

            it('should give read-write access', function() {
              return this.callback
                .calledWith(null, 'readAndWrite', false)
                .should.equal(true)
            })
          })
        })

        describe('when the token is valid for read-only', function() {
          beforeEach(function() {
            this.TokenAccessHandler.isValidToken = sinon
              .stub()
              .withArgs(this.project_id, this.token)
              .yields(null, false, true)
            return this.AuthorizationManager.getPrivilegeLevelForProject(
              null,
              this.project_id,
              this.token,
              this.callback
            )
          })

          it('should not call CollaboratorsHandler.getMemberIdPrivilegeLevel', function() {
            return this.CollaboratorsHandler.getMemberIdPrivilegeLevel.called.should.equal(
              false
            )
          })

          it('should not call AuthorizationManager.isUserSiteAdmin', function() {
            return this.AuthorizationManager.isUserSiteAdmin.called.should.equal(
              false
            )
          })

          it('should check if the token is valid', function() {
            return this.TokenAccessHandler.isValidToken
              .calledWith(this.project_id, this.token)
              .should.equal(true)
          })

          it('should give read-only access', function() {
            return this.callback
              .calledWith(null, 'readOnly', false)
              .should.equal(true)
          })
        })
      })
    })

    describe('with a private project', function() {
      beforeEach(function() {
        return this.ProjectGetter.getProject
          .withArgs(this.project_id, { publicAccesLevel: 1 })
          .yields(null, { publicAccesLevel: 'private' })
      })

      describe('with a user_id with a privilege level', function() {
        beforeEach(function() {
          this.AuthorizationManager.isUserSiteAdmin
            .withArgs(this.user_id)
            .yields(null, false)
          this.CollaboratorsHandler.getMemberIdPrivilegeLevel
            .withArgs(this.user_id, this.project_id)
            .yields(null, 'readOnly')
          return this.AuthorizationManager.getPrivilegeLevelForProject(
            this.user_id,
            this.project_id,
            this.token,
            this.callback
          )
        })

        it("should return the user's privilege level", function() {
          return this.callback
            .calledWith(null, 'readOnly', false, false)
            .should.equal(true)
        })
      })

      describe('with a user_id with no privilege level', function() {
        beforeEach(function() {
          this.AuthorizationManager.isUserSiteAdmin
            .withArgs(this.user_id)
            .yields(null, false)
          this.CollaboratorsHandler.getMemberIdPrivilegeLevel
            .withArgs(this.user_id, this.project_id)
            .yields(null, false)
          return this.AuthorizationManager.getPrivilegeLevelForProject(
            this.user_id,
            this.project_id,
            this.token,
            this.callback
          )
        })

        it('should return false', function() {
          return this.callback
            .calledWith(null, false, false, false)
            .should.equal(true)
        })
      })

      describe('with a user_id who is an admin', function() {
        beforeEach(function() {
          this.AuthorizationManager.isUserSiteAdmin
            .withArgs(this.user_id)
            .yields(null, true)
          this.CollaboratorsHandler.getMemberIdPrivilegeLevel
            .withArgs(this.user_id, this.project_id)
            .yields(null, false)
          return this.AuthorizationManager.getPrivilegeLevelForProject(
            this.user_id,
            this.project_id,
            this.token,
            this.callback
          )
        })

        it('should return the user as an owner', function() {
          return this.callback
            .calledWith(null, 'owner', false, true)
            .should.equal(true)
        })
      })

      describe('with no user (anonymous)', function() {
        beforeEach(function() {
          return this.AuthorizationManager.getPrivilegeLevelForProject(
            null,
            this.project_id,
            this.token,
            this.callback
          )
        })

        it('should not call CollaboratorsHandler.getMemberIdPrivilegeLevel', function() {
          return this.CollaboratorsHandler.getMemberIdPrivilegeLevel.called.should.equal(
            false
          )
        })

        it('should not call AuthorizationManager.isUserSiteAdmin', function() {
          return this.AuthorizationManager.isUserSiteAdmin.called.should.equal(
            false
          )
        })

        it('should return false', function() {
          return this.callback
            .calledWith(null, false, false, false)
            .should.equal(true)
        })
      })
    })

    describe('with a public project', function() {
      beforeEach(function() {
        return this.ProjectGetter.getProject
          .withArgs(this.project_id, { publicAccesLevel: 1 })
          .yields(null, { publicAccesLevel: 'readAndWrite' })
      })

      describe('with a user_id with a privilege level', function() {
        beforeEach(function() {
          this.AuthorizationManager.isUserSiteAdmin
            .withArgs(this.user_id)
            .yields(null, false)
          this.CollaboratorsHandler.getMemberIdPrivilegeLevel
            .withArgs(this.user_id, this.project_id)
            .yields(null, 'readOnly')
          return this.AuthorizationManager.getPrivilegeLevelForProject(
            this.user_id,
            this.project_id,
            this.token,
            this.callback
          )
        })

        it("should return the user's privilege level", function() {
          return this.callback
            .calledWith(null, 'readOnly', false)
            .should.equal(true)
        })
      })

      describe('with a user_id with no privilege level', function() {
        beforeEach(function() {
          this.AuthorizationManager.isUserSiteAdmin
            .withArgs(this.user_id)
            .yields(null, false)
          this.CollaboratorsHandler.getMemberIdPrivilegeLevel
            .withArgs(this.user_id, this.project_id)
            .yields(null, false)
          return this.AuthorizationManager.getPrivilegeLevelForProject(
            this.user_id,
            this.project_id,
            this.token,
            this.callback
          )
        })

        it('should return the public privilege level', function() {
          return this.callback
            .calledWith(null, 'readAndWrite', true)
            .should.equal(true)
        })
      })

      describe('with a user_id who is an admin', function() {
        beforeEach(function() {
          this.AuthorizationManager.isUserSiteAdmin
            .withArgs(this.user_id)
            .yields(null, true)
          this.CollaboratorsHandler.getMemberIdPrivilegeLevel
            .withArgs(this.user_id, this.project_id)
            .yields(null, false)
          return this.AuthorizationManager.getPrivilegeLevelForProject(
            this.user_id,
            this.project_id,
            this.token,
            this.callback
          )
        })

        it('should return the user as an owner', function() {
          return this.callback
            .calledWith(null, 'owner', false)
            .should.equal(true)
        })
      })

      describe('with no user (anonymous)', function() {
        beforeEach(function() {
          return this.AuthorizationManager.getPrivilegeLevelForProject(
            null,
            this.project_id,
            this.token,
            this.callback
          )
        })

        it('should not call CollaboratorsHandler.getMemberIdPrivilegeLevel', function() {
          return this.CollaboratorsHandler.getMemberIdPrivilegeLevel.called.should.equal(
            false
          )
        })

        it('should not call AuthorizationManager.isUserSiteAdmin', function() {
          return this.AuthorizationManager.isUserSiteAdmin.called.should.equal(
            false
          )
        })

        it('should return the public privilege level', function() {
          return this.callback
            .calledWith(null, 'readAndWrite', true)
            .should.equal(true)
        })
      })
    })

    describe("when the project doesn't exist", function() {
      beforeEach(function() {
        return this.ProjectGetter.getProject
          .withArgs(this.project_id, { publicAccesLevel: 1 })
          .yields(null, null)
      })

      it('should return a NotFoundError', function() {
        return this.AuthorizationManager.getPrivilegeLevelForProject(
          this.user_id,
          this.project_id,
          this.token,
          error => error.should.be.instanceof(Errors.NotFoundError)
        )
      })
    })

    describe('when the project id is not valid', function() {
      beforeEach(function() {
        this.AuthorizationManager.isUserSiteAdmin
          .withArgs(this.user_id)
          .yields(null, false)
        return this.CollaboratorsHandler.getMemberIdPrivilegeLevel
          .withArgs(this.user_id, this.project_id)
          .yields(null, 'readOnly')
      })

      it('should return a error', function(done) {
        return this.AuthorizationManager.getPrivilegeLevelForProject(
          undefined,
          'not project id',
          this.token,
          err => {
            this.ProjectGetter.getProject.called.should.equal(false)
            expect(err).to.exist
            return done()
          }
        )
      })
    })
  })

  describe('canUserReadProject', function() {
    beforeEach(function() {
      return (this.AuthorizationManager.getPrivilegeLevelForProject = sinon.stub())
    })

    describe('when user is owner', function() {
      beforeEach(function() {
        return this.AuthorizationManager.getPrivilegeLevelForProject
          .withArgs(this.user_id, this.project_id, this.token)
          .yields(null, 'owner', false)
      })

      it('should return true', function(done) {
        return this.AuthorizationManager.canUserReadProject(
          this.user_id,
          this.project_id,
          this.token,
          (error, canRead) => {
            expect(canRead).to.equal(true)
            return done()
          }
        )
      })
    })

    describe('when user has read-write access', function() {
      beforeEach(function() {
        return this.AuthorizationManager.getPrivilegeLevelForProject
          .withArgs(this.user_id, this.project_id, this.token)
          .yields(null, 'readAndWrite', false)
      })

      it('should return true', function(done) {
        return this.AuthorizationManager.canUserReadProject(
          this.user_id,
          this.project_id,
          this.token,
          (error, canRead) => {
            expect(canRead).to.equal(true)
            return done()
          }
        )
      })
    })

    describe('when user has read-only access', function() {
      beforeEach(function() {
        return this.AuthorizationManager.getPrivilegeLevelForProject
          .withArgs(this.user_id, this.project_id, this.token)
          .yields(null, 'readOnly', false)
      })

      it('should return true', function(done) {
        return this.AuthorizationManager.canUserReadProject(
          this.user_id,
          this.project_id,
          this.token,
          (error, canRead) => {
            expect(canRead).to.equal(true)
            return done()
          }
        )
      })
    })

    describe('when user has no access', function() {
      beforeEach(function() {
        return this.AuthorizationManager.getPrivilegeLevelForProject
          .withArgs(this.user_id, this.project_id, this.token)
          .yields(null, false, false)
      })

      it('should return false', function(done) {
        return this.AuthorizationManager.canUserReadProject(
          this.user_id,
          this.project_id,
          this.token,
          (error, canRead) => {
            expect(canRead).to.equal(false)
            return done()
          }
        )
      })
    })
  })

  describe('canUserWriteProjectContent', function() {
    beforeEach(function() {
      return (this.AuthorizationManager.getPrivilegeLevelForProject = sinon.stub())
    })

    describe('when user is owner', function() {
      beforeEach(function() {
        return this.AuthorizationManager.getPrivilegeLevelForProject
          .withArgs(this.user_id, this.project_id, this.token)
          .yields(null, 'owner', false)
      })

      it('should return true', function(done) {
        return this.AuthorizationManager.canUserWriteProjectContent(
          this.user_id,
          this.project_id,
          this.token,
          (error, canWrite) => {
            expect(canWrite).to.equal(true)
            return done()
          }
        )
      })
    })

    describe('when user has read-write access', function() {
      beforeEach(function() {
        return this.AuthorizationManager.getPrivilegeLevelForProject
          .withArgs(this.user_id, this.project_id, this.token)
          .yields(null, 'readAndWrite', false)
      })

      it('should return true', function(done) {
        return this.AuthorizationManager.canUserWriteProjectContent(
          this.user_id,
          this.project_id,
          this.token,
          (error, canWrite) => {
            expect(canWrite).to.equal(true)
            return done()
          }
        )
      })
    })

    describe('when user has read-only access', function() {
      beforeEach(function() {
        return this.AuthorizationManager.getPrivilegeLevelForProject
          .withArgs(this.user_id, this.project_id, this.token)
          .yields(null, 'readOnly', false)
      })

      it('should return false', function(done) {
        return this.AuthorizationManager.canUserWriteProjectContent(
          this.user_id,
          this.project_id,
          this.token,
          (error, canWrite) => {
            expect(canWrite).to.equal(false)
            return done()
          }
        )
      })
    })

    describe('when user has no access', function() {
      beforeEach(function() {
        return this.AuthorizationManager.getPrivilegeLevelForProject
          .withArgs(this.user_id, this.project_id, this.token)
          .yields(null, false, false)
      })

      it('should return false', function(done) {
        return this.AuthorizationManager.canUserWriteProjectContent(
          this.user_id,
          this.project_id,
          this.token,
          (error, canWrite) => {
            expect(canWrite).to.equal(false)
            return done()
          }
        )
      })
    })
  })

  describe('canUserWriteProjectSettings', function() {
    beforeEach(function() {
      return (this.AuthorizationManager.getPrivilegeLevelForProject = sinon.stub())
    })

    describe('when user is owner', function() {
      beforeEach(function() {
        return this.AuthorizationManager.getPrivilegeLevelForProject
          .withArgs(this.user_id, this.project_id, this.token)
          .yields(null, 'owner', false)
      })

      it('should return true', function(done) {
        return this.AuthorizationManager.canUserWriteProjectSettings(
          this.user_id,
          this.project_id,
          this.token,
          (error, canWrite) => {
            expect(canWrite).to.equal(true)
            return done()
          }
        )
      })
    })

    describe('when user has read-write access as a collaborator', function() {
      beforeEach(function() {
        return this.AuthorizationManager.getPrivilegeLevelForProject
          .withArgs(this.user_id, this.project_id, this.token)
          .yields(null, 'readAndWrite', false)
      })

      it('should return true', function(done) {
        return this.AuthorizationManager.canUserWriteProjectSettings(
          this.user_id,
          this.project_id,
          this.token,
          (error, canWrite) => {
            expect(canWrite).to.equal(true)
            return done()
          }
        )
      })
    })

    describe('when user has read-write access as the public', function() {
      beforeEach(function() {
        return this.AuthorizationManager.getPrivilegeLevelForProject
          .withArgs(this.user_id, this.project_id, this.token)
          .yields(null, 'readAndWrite', true)
      })

      it('should return false', function(done) {
        return this.AuthorizationManager.canUserWriteProjectSettings(
          this.user_id,
          this.project_id,
          this.token,
          (error, canWrite) => {
            expect(canWrite).to.equal(false)
            return done()
          }
        )
      })
    })

    describe('when user has read-only access', function() {
      beforeEach(function() {
        return this.AuthorizationManager.getPrivilegeLevelForProject
          .withArgs(this.user_id, this.project_id, this.token)
          .yields(null, 'readOnly', false)
      })

      it('should return false', function(done) {
        return this.AuthorizationManager.canUserWriteProjectSettings(
          this.user_id,
          this.project_id,
          this.token,
          (error, canWrite) => {
            expect(canWrite).to.equal(false)
            return done()
          }
        )
      })
    })

    describe('when user has no access', function() {
      beforeEach(function() {
        return this.AuthorizationManager.getPrivilegeLevelForProject
          .withArgs(this.user_id, this.project_id, this.token)
          .yields(null, false, false)
      })

      it('should return false', function(done) {
        return this.AuthorizationManager.canUserWriteProjectSettings(
          this.user_id,
          this.project_id,
          this.token,
          (error, canWrite) => {
            expect(canWrite).to.equal(false)
            return done()
          }
        )
      })
    })
  })

  describe('canUserAdminProject', function() {
    beforeEach(function() {
      return (this.AuthorizationManager.getPrivilegeLevelForProject = sinon.stub())
    })

    describe('when user is owner', function() {
      beforeEach(function() {
        return this.AuthorizationManager.getPrivilegeLevelForProject
          .withArgs(this.user_id, this.project_id, this.token)
          .yields(null, 'owner', false)
      })

      it('should return true', function(done) {
        return this.AuthorizationManager.canUserAdminProject(
          this.user_id,
          this.project_id,
          this.token,
          (error, canAdmin) => {
            expect(canAdmin).to.equal(true)
            return done()
          }
        )
      })
    })

    describe('when user has read-write access', function() {
      beforeEach(function() {
        return this.AuthorizationManager.getPrivilegeLevelForProject
          .withArgs(this.user_id, this.project_id, this.token)
          .yields(null, 'readAndWrite', false)
      })

      it('should return false', function(done) {
        return this.AuthorizationManager.canUserAdminProject(
          this.user_id,
          this.project_id,
          this.token,
          (error, canAdmin) => {
            expect(canAdmin).to.equal(false)
            return done()
          }
        )
      })
    })

    describe('when user has read-only access', function() {
      beforeEach(function() {
        return this.AuthorizationManager.getPrivilegeLevelForProject
          .withArgs(this.user_id, this.project_id, this.token)
          .yields(null, 'readOnly', false)
      })

      it('should return false', function(done) {
        return this.AuthorizationManager.canUserAdminProject(
          this.user_id,
          this.project_id,
          this.token,
          (error, canAdmin) => {
            expect(canAdmin).to.equal(false)
            return done()
          }
        )
      })
    })

    describe('when user has no access', function() {
      beforeEach(function() {
        return this.AuthorizationManager.getPrivilegeLevelForProject
          .withArgs(this.user_id, this.project_id, this.token)
          .yields(null, false, false)
      })

      it('should return false', function(done) {
        return this.AuthorizationManager.canUserAdminProject(
          this.user_id,
          this.project_id,
          this.token,
          (error, canAdmin) => {
            expect(canAdmin).to.equal(false)
            return done()
          }
        )
      })
    })
  })

  describe('isUserSiteAdmin', function() {
    beforeEach(function() {
      return (this.User.findOne = sinon.stub())
    })

    describe('when user is admin', function() {
      beforeEach(function() {
        return this.User.findOne
          .withArgs({ _id: this.user_id }, { isAdmin: 1 })
          .yields(null, { isAdmin: true })
      })

      it('should return true', function(done) {
        return this.AuthorizationManager.isUserSiteAdmin(
          this.user_id,
          (error, isAdmin) => {
            expect(isAdmin).to.equal(true)
            return done()
          }
        )
      })
    })

    describe('when user is not admin', function() {
      beforeEach(function() {
        return this.User.findOne
          .withArgs({ _id: this.user_id }, { isAdmin: 1 })
          .yields(null, { isAdmin: false })
      })

      it('should return false', function(done) {
        return this.AuthorizationManager.isUserSiteAdmin(
          this.user_id,
          (error, isAdmin) => {
            expect(isAdmin).to.equal(false)
            return done()
          }
        )
      })
    })

    describe('when user is not found', function() {
      beforeEach(function() {
        return this.User.findOne
          .withArgs({ _id: this.user_id }, { isAdmin: 1 })
          .yields(null, null)
      })

      it('should return false', function(done) {
        return this.AuthorizationManager.isUserSiteAdmin(
          this.user_id,
          (error, isAdmin) => {
            expect(isAdmin).to.equal(false)
            return done()
          }
        )
      })
    })

    describe('when no user is passed', function() {
      it('should return false', function(done) {
        return this.AuthorizationManager.isUserSiteAdmin(
          null,
          (error, isAdmin) => {
            this.User.findOne.called.should.equal(false)
            expect(isAdmin).to.equal(false)
            return done()
          }
        )
      })
    })
  })
})
