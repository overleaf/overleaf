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
const should = require('chai').should()
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const path = require('path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/TokenAccess/TokenAccessHandler'
)
const { expect } = require('chai')
const { ObjectId } = require('mongojs')

describe('TokenAccessHandler', function() {
  beforeEach(function() {
    this.token = 'sometokenthing'
    this.projectId = ObjectId()
    this.project = {
      _id: this.projectId,
      publicAccesLevel: 'tokenBased'
    }
    this.userId = ObjectId()
    this.req = {}
    return (this.TokenAccessHandler = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../../models/Project': { Project: (this.Project = {}) },
        'settings-sharelatex': (this.settings = {}),
        '../Collaborators/CollaboratorsHandler': (this.CollaboratorsHandler = {}),
        '../User/UserGetter': (this.UserGetter = {}),
        '../V1/V1Api': (this.V1Api = {
          request: sinon.stub()
        })
      }
    }))
  })

  describe('findProjectWithReadOnlyToken', function() {
    beforeEach(function() {
      return (this.Project.findOne = sinon
        .stub()
        .callsArgWith(2, null, this.project))
    })

    it('should call Project.findOne', function(done) {
      return this.TokenAccessHandler.findProjectWithReadOnlyToken(
        this.token,
        (err, project) => {
          expect(this.Project.findOne.callCount).to.equal(1)
          expect(
            this.Project.findOne.calledWith({
              'tokens.readOnly': this.token
            })
          ).to.equal(true)
          return done()
        }
      )
    })

    it('should produce a project object with no error', function(done) {
      return this.TokenAccessHandler.findProjectWithReadOnlyToken(
        this.token,
        (err, project) => {
          expect(err).to.not.exist
          expect(project).to.exist
          expect(project).to.deep.equal(this.project)
          return done()
        }
      )
    })

    it('should return projectExists flag as true', function(done) {
      return this.TokenAccessHandler.findProjectWithReadOnlyToken(
        this.token,
        (err, project, projectExists) => {
          expect(projectExists).to.equal(true)
          return done()
        }
      )
    })

    describe('when Project.findOne produces an error', function() {
      beforeEach(function() {
        return (this.Project.findOne = sinon
          .stub()
          .callsArgWith(2, new Error('woops')))
      })

      it('should produce an error', function(done) {
        return this.TokenAccessHandler.findProjectWithReadOnlyToken(
          this.token,
          (err, project) => {
            expect(err).to.exist
            expect(project).to.not.exist
            expect(err).to.be.instanceof(Error)
            return done()
          }
        )
      })
    })

    describe('when project does not have tokenBased access level', function() {
      beforeEach(function() {
        this.project.publicAccesLevel = 'private'
        return (this.Project.findOne = sinon
          .stub()
          .callsArgWith(2, null, this.project, true))
      })

      it('should not return a project', function(done) {
        return this.TokenAccessHandler.findProjectWithReadOnlyToken(
          this.token,
          (err, project) => {
            expect(err).to.not.exist
            expect(project).to.not.exist
            return done()
          }
        )
      })

      it('should return projectExists flag as true', function(done) {
        return this.TokenAccessHandler.findProjectWithReadOnlyToken(
          this.token,
          (err, project, projectExists) => {
            expect(projectExists).to.equal(true)
            return done()
          }
        )
      })
    })

    describe('when project does not exist', function() {
      beforeEach(function() {
        return (this.Project.findOne = sinon.stub().callsArgWith(2, null, null))
      })

      it('should not return a project', function(done) {
        return this.TokenAccessHandler.findProjectWithReadOnlyToken(
          this.token,
          (err, project) => {
            expect(err).to.not.exist
            expect(project).to.not.exist
            return done()
          }
        )
      })

      it('should return projectExists flag as false', function(done) {
        return this.TokenAccessHandler.findProjectWithReadOnlyToken(
          this.token,
          (err, project, projectExists) => {
            expect(projectExists).to.equal(false)
            return done()
          }
        )
      })
    })
  })

  describe('findProjectWithReadAndWriteToken', function() {
    beforeEach(function() {
      this.token = '1234bcdf'
      this.tokenPrefix = '1234'
      this.project.tokens = {
        readOnly: 'atntntn',
        readAndWrite: this.token,
        readAndWritePrefix: this.tokenPrefix
      }
      return (this.Project.findOne = sinon
        .stub()
        .callsArgWith(2, null, this.project))
    })

    it('should call Project.findOne', function(done) {
      return this.TokenAccessHandler.findProjectWithReadAndWriteToken(
        this.token,
        (err, project) => {
          expect(this.Project.findOne.callCount).to.equal(1)
          expect(
            this.Project.findOne.calledWith({
              'tokens.readAndWritePrefix': this.tokenPrefix
            })
          ).to.equal(true)
          return done()
        }
      )
    })

    it('should produce a project object with no error', function(done) {
      return this.TokenAccessHandler.findProjectWithReadAndWriteToken(
        this.token,
        (err, project) => {
          expect(err).to.not.exist
          expect(project).to.exist
          expect(project).to.deep.equal(this.project)
          return done()
        }
      )
    })

    it('should return projectExists flag as true', function(done) {
      return this.TokenAccessHandler.findProjectWithReadAndWriteToken(
        this.token,
        (err, project, projectExists) => {
          expect(projectExists).to.equal(true)
          return done()
        }
      )
    })

    describe('when Project.findOne produces an error', function() {
      beforeEach(function() {
        return (this.Project.findOne = sinon
          .stub()
          .callsArgWith(2, new Error('woops')))
      })

      it('should produce an error', function(done) {
        return this.TokenAccessHandler.findProjectWithReadAndWriteToken(
          this.token,
          (err, project) => {
            expect(err).to.exist
            expect(project).to.not.exist
            expect(err).to.be.instanceof(Error)
            return done()
          }
        )
      })
    })

    describe('when project does not have tokenBased access level', function() {
      beforeEach(function() {
        this.project.publicAccesLevel = 'private'
        return (this.Project.findOne = sinon
          .stub()
          .callsArgWith(2, null, this.project, true))
      })

      it('should not return a project', function(done) {
        return this.TokenAccessHandler.findProjectWithReadAndWriteToken(
          this.token,
          (err, project) => {
            expect(err).to.not.exist
            expect(project).to.not.exist
            return done()
          }
        )
      })

      it('should return projectExists flag as true', function(done) {
        return this.TokenAccessHandler.findProjectWithReadAndWriteToken(
          this.token,
          (err, project, projectExists) => {
            expect(projectExists).to.equal(true)
            return done()
          }
        )
      })
    })

    describe('when the tokens have different lengths', function() {
      beforeEach(function() {
        this.project.tokens = {
          readOnly: 'atntntn',
          readAndWrite: this.token + 'some-other-characters',
          readAndWritePrefix: this.tokenPrefix
        }
        return (this.Project.findOne = sinon
          .stub()
          .callsArgWith(2, null, this.project))
      })

      it('should not return a project', function(done) {
        return this.TokenAccessHandler.findProjectWithReadAndWriteToken(
          this.token,
          (err, project) => {
            expect(err).to.not.exist
            expect(project).to.not.exist
            return done()
          }
        )
      })
    })
  })

  describe('findProjectWithHigherAccess', function() {
    describe('when user does have higher access', function() {
      beforeEach(function() {
        this.Project.findOne = sinon.stub().callsArgWith(2, null, this.project)
        return (this.CollaboratorsHandler.isUserInvitedMemberOfProject = sinon
          .stub()
          .callsArgWith(2, null, true))
      })

      it('should call Project.findOne', function(done) {
        return this.TokenAccessHandler.findProjectWithHigherAccess(
          this.token,
          this.userId,
          (err, project) => {
            expect(this.Project.findOne.callCount).to.equal(1)
            expect(
              this.Project.findOne.calledWith({
                'tokens.readOnly': this.token
              })
            ).to.equal(true)
            return done()
          }
        )
      })

      it('should call isUserInvitedMemberOfProject', function(done) {
        return this.TokenAccessHandler.findProjectWithHigherAccess(
          this.token,
          this.userId,
          (err, project) => {
            expect(
              this.CollaboratorsHandler.isUserInvitedMemberOfProject.callCount
            ).to.equal(1)
            expect(
              this.CollaboratorsHandler.isUserInvitedMemberOfProject.calledWith(
                this.userId,
                this.project._id
              )
            ).to.equal(true)
            return done()
          }
        )
      })

      it('should produce a project object', function(done) {
        return this.TokenAccessHandler.findProjectWithHigherAccess(
          this.token,
          this.userId,
          (err, project) => {
            expect(err).to.not.exist
            expect(project).to.exist
            expect(project).to.deep.equal(this.project)
            return done()
          }
        )
      })
    })

    describe('when user does not have higher access', function() {
      beforeEach(function() {
        this.Project.findOne = sinon.stub().callsArgWith(2, null, this.project)
        return (this.CollaboratorsHandler.isUserInvitedMemberOfProject = sinon
          .stub()
          .callsArgWith(2, null, false))
      })

      it('should call Project.findOne', function(done) {
        return this.TokenAccessHandler.findProjectWithHigherAccess(
          this.token,
          this.userId,
          (err, project) => {
            expect(this.Project.findOne.callCount).to.equal(1)
            expect(
              this.Project.findOne.calledWith({
                'tokens.readOnly': this.token
              })
            ).to.equal(true)
            return done()
          }
        )
      })

      it('should call isUserInvitedMemberOfProject', function(done) {
        return this.TokenAccessHandler.findProjectWithHigherAccess(
          this.token,
          this.userId,
          (err, project) => {
            expect(
              this.CollaboratorsHandler.isUserInvitedMemberOfProject.callCount
            ).to.equal(1)
            expect(
              this.CollaboratorsHandler.isUserInvitedMemberOfProject.calledWith(
                this.userId,
                this.project._id
              )
            ).to.equal(true)
            return done()
          }
        )
      })

      it('should not produce a project', function(done) {
        return this.TokenAccessHandler.findProjectWithHigherAccess(
          this.token,
          this.userId,
          (err, project) => {
            expect(err).to.not.exist
            expect(project).to.not.exist
            return done()
          }
        )
      })
    })

    describe('when Project.findOne produces an error', function() {
      beforeEach(function() {
        return (this.Project.findOne = sinon
          .stub()
          .callsArgWith(2, new Error('woops')))
      })

      it('should produce an error', function(done) {
        return this.TokenAccessHandler.findProjectWithHigherAccess(
          this.token,
          this.userId,
          (err, project) => {
            expect(err).to.exist
            expect(project).to.not.exist
            expect(err).to.be.instanceof(Error)
            return done()
          }
        )
      })
    })

    describe('when isUserInvitedMemberOfProject produces an error', function() {
      beforeEach(function() {
        this.Project.findOne = sinon.stub().callsArgWith(2, null, this.project)
        return (this.CollaboratorsHandler.isUserInvitedMemberOfProject = sinon
          .stub()
          .callsArgWith(2, new Error('woops')))
      })

      it('should produce an error', function(done) {
        return this.TokenAccessHandler.findProjectWithHigherAccess(
          this.token,
          this.userId,
          (err, project) => {
            expect(err).to.exist
            expect(project).to.not.exist
            expect(err).to.be.instanceof(Error)
            return done()
          }
        )
      })
    })
  })

  describe('addReadOnlyUserToProject', function() {
    beforeEach(function() {
      return (this.Project.update = sinon.stub().callsArgWith(2, null))
    })

    it('should call Project.update', function(done) {
      return this.TokenAccessHandler.addReadOnlyUserToProject(
        this.userId,
        this.projectId,
        err => {
          expect(this.Project.update.callCount).to.equal(1)
          expect(
            this.Project.update.calledWith({
              _id: this.projectId
            })
          ).to.equal(true)
          expect(
            this.Project.update.lastCall.args[1]['$addToSet']
          ).to.have.keys('tokenAccessReadOnly_refs')
          return done()
        }
      )
    })

    it('should not produce an error', function(done) {
      return this.TokenAccessHandler.addReadOnlyUserToProject(
        this.userId,
        this.projectId,
        err => {
          expect(err).to.not.exist
          return done()
        }
      )
    })

    describe('when Project.update produces an error', function() {
      beforeEach(function() {
        return (this.Project.update = sinon
          .stub()
          .callsArgWith(2, new Error('woops')))
      })

      it('should produce an error', function(done) {
        return this.TokenAccessHandler.addReadOnlyUserToProject(
          this.userId,
          this.projectId,
          err => {
            expect(err).to.exist
            return done()
          }
        )
      })
    })
  })

  describe('addReadAndWriteUserToProject', function() {
    beforeEach(function() {
      return (this.Project.update = sinon.stub().callsArgWith(2, null))
    })

    it('should call Project.update', function(done) {
      return this.TokenAccessHandler.addReadAndWriteUserToProject(
        this.userId,
        this.projectId,
        err => {
          expect(this.Project.update.callCount).to.equal(1)
          expect(
            this.Project.update.calledWith({
              _id: this.projectId
            })
          ).to.equal(true)
          expect(
            this.Project.update.lastCall.args[1]['$addToSet']
          ).to.have.keys('tokenAccessReadAndWrite_refs')
          return done()
        }
      )
    })

    it('should not produce an error', function(done) {
      return this.TokenAccessHandler.addReadAndWriteUserToProject(
        this.userId,
        this.projectId,
        err => {
          expect(err).to.not.exist
          return done()
        }
      )
    })

    describe('when Project.update produces an error', function() {
      beforeEach(function() {
        return (this.Project.update = sinon
          .stub()
          .callsArgWith(2, new Error('woops')))
      })

      it('should produce an error', function(done) {
        return this.TokenAccessHandler.addReadAndWriteUserToProject(
          this.userId,
          this.projectId,
          err => {
            expect(err).to.exist
            return done()
          }
        )
      })
    })
  })

  describe('grantSessionTokenAccess', function() {
    beforeEach(function() {
      return (this.req = { session: {}, headers: {} })
    })

    it('should add the token to the session', function(done) {
      this.TokenAccessHandler.grantSessionTokenAccess(
        this.req,
        this.projectId,
        this.token
      )
      expect(
        this.req.session.anonTokenAccess[this.projectId.toString()]
      ).to.equal(this.token)
      return done()
    })
  })

  describe('isValidToken', function() {
    describe('when a read-only project is found', function() {
      beforeEach(function() {
        this.TokenAccessHandler.findProjectWithReadAndWriteToken = sinon
          .stub()
          .callsArgWith(1, null, null)
        return (this.TokenAccessHandler.findProjectWithReadOnlyToken = sinon
          .stub()
          .callsArgWith(1, null, this.project))
      })

      it('should try to find projects with both kinds of token', function(done) {
        return this.TokenAccessHandler.isValidToken(
          this.projectId,
          this.token,
          (err, allowed) => {
            expect(
              this.TokenAccessHandler.findProjectWithReadAndWriteToken.callCount
            ).to.equal(1)
            expect(
              this.TokenAccessHandler.findProjectWithReadOnlyToken.callCount
            ).to.equal(1)
            return done()
          }
        )
      })

      it('should allow read-only access', function(done) {
        return this.TokenAccessHandler.isValidToken(
          this.projectId,
          this.token,
          (err, rw, ro) => {
            expect(err).to.not.exist
            expect(rw).to.equal(false)
            expect(ro).to.equal(true)
            return done()
          }
        )
      })
    })

    describe('when a read-and-write project is found', function() {
      beforeEach(function() {
        this.TokenAccessHandler.findProjectWithReadAndWriteToken = sinon
          .stub()
          .callsArgWith(1, null, this.project)
        return (this.TokenAccessHandler.findProjectWithReadOnlyToken = sinon
          .stub()
          .callsArgWith(1, null, null))
      })

      it('should try to find projects with both kinds of token', function(done) {
        return this.TokenAccessHandler.isValidToken(
          this.projectId,
          this.token,
          (err, allowed) => {
            expect(
              this.TokenAccessHandler.findProjectWithReadAndWriteToken.callCount
            ).to.equal(1)
            expect(
              this.TokenAccessHandler.findProjectWithReadOnlyToken.callCount
            ).to.equal(1)
            return done()
          }
        )
      })

      it('should allow read-and-write access', function(done) {
        return this.TokenAccessHandler.isValidToken(
          this.projectId,
          this.token,
          (err, rw, ro) => {
            expect(err).to.not.exist
            expect(rw).to.equal(true)
            expect(ro).to.equal(false)
            return done()
          }
        )
      })
    })

    describe('when no project is found', function() {
      beforeEach(function() {
        this.TokenAccessHandler.findProjectWithReadAndWriteToken = sinon
          .stub()
          .callsArgWith(1, null, null)
        return (this.TokenAccessHandler.findProjectWithReadOnlyToken = sinon
          .stub()
          .callsArgWith(1, null, null))
      })

      it('should try to find projects with both kinds of token', function(done) {
        return this.TokenAccessHandler.isValidToken(
          this.projectId,
          this.token,
          (err, allowed) => {
            expect(
              this.TokenAccessHandler.findProjectWithReadAndWriteToken.callCount
            ).to.equal(1)
            expect(
              this.TokenAccessHandler.findProjectWithReadOnlyToken.callCount
            ).to.equal(1)
            return done()
          }
        )
      })

      it('should not allow any access', function(done) {
        return this.TokenAccessHandler.isValidToken(
          this.projectId,
          this.token,
          (err, rw, ro) => {
            expect(err).to.not.exist
            expect(rw).to.equal(false)
            expect(ro).to.equal(false)
            return done()
          }
        )
      })
    })

    describe('when findProject produces an error', function() {
      beforeEach(function() {
        this.TokenAccessHandler.findProjectWithReadAndWriteToken = sinon
          .stub()
          .callsArgWith(1, null, null)
        return (this.TokenAccessHandler.findProjectWithReadOnlyToken = sinon
          .stub()
          .callsArgWith(1, new Error('woops')))
      })

      it('should try to find projects with both kinds of token', function(done) {
        return this.TokenAccessHandler.isValidToken(
          this.projectId,
          this.token,
          (err, allowed) => {
            expect(
              this.TokenAccessHandler.findProjectWithReadAndWriteToken.callCount
            ).to.equal(1)
            expect(
              this.TokenAccessHandler.findProjectWithReadOnlyToken.callCount
            ).to.equal(1)
            return done()
          }
        )
      })

      it('should produce an error and not allow access', function(done) {
        return this.TokenAccessHandler.isValidToken(
          this.projectId,
          this.token,
          (err, rw, ro) => {
            expect(err).to.exist
            expect(err).to.be.instanceof(Error)
            expect(rw).to.equal(undefined)
            expect(ro).to.equal(undefined)
            return done()
          }
        )
      })
    })

    describe('when project is not set to token-based access', function() {
      beforeEach(function() {
        return (this.project.publicAccesLevel = 'private')
      })

      describe('for read-and-write project', function() {
        beforeEach(function() {
          this.TokenAccessHandler.findProjectWithReadAndWriteToken = sinon
            .stub()
            .callsArgWith(1, null, this.project)
          return (this.TokenAccessHandler.findProjectWithReadOnlyToken = sinon
            .stub()
            .callsArgWith(1, null, null))
        })

        it('should try to find projects with both kinds of token', function(done) {
          return this.TokenAccessHandler.isValidToken(
            this.projectId,
            this.token,
            (err, allowed) => {
              expect(
                this.TokenAccessHandler.findProjectWithReadAndWriteToken
                  .callCount
              ).to.equal(1)
              expect(
                this.TokenAccessHandler.findProjectWithReadOnlyToken.callCount
              ).to.equal(1)
              return done()
            }
          )
        })

        it('should not allow any access', function(done) {
          return this.TokenAccessHandler.isValidToken(
            this.projectId,
            this.token,
            (err, rw, ro) => {
              expect(err).to.not.exist
              expect(rw).to.equal(false)
              expect(ro).to.equal(false)
              return done()
            }
          )
        })
      })

      describe('for read-only project', function() {
        beforeEach(function() {
          this.TokenAccessHandler.findProjectWithReadAndWriteToken = sinon
            .stub()
            .callsArgWith(1, null, null)
          return (this.TokenAccessHandler.findProjectWithReadOnlyToken = sinon
            .stub()
            .callsArgWith(1, null, this.project))
        })

        it('should try to find projects with both kinds of token', function(done) {
          return this.TokenAccessHandler.isValidToken(
            this.projectId,
            this.token,
            (err, allowed) => {
              expect(
                this.TokenAccessHandler.findProjectWithReadAndWriteToken
                  .callCount
              ).to.equal(1)
              expect(
                this.TokenAccessHandler.findProjectWithReadOnlyToken.callCount
              ).to.equal(1)
              return done()
            }
          )
        })

        it('should not allow any access', function(done) {
          return this.TokenAccessHandler.isValidToken(
            this.projectId,
            this.token,
            (err, rw, ro) => {
              expect(err).to.not.exist
              expect(rw).to.equal(false)
              expect(ro).to.equal(false)
              return done()
            }
          )
        })
      })
    })

    describe('with nothing', function() {
      beforeEach(function() {
        this.TokenAccessHandler.findProjectWithReadAndWriteToken = sinon
          .stub()
          .callsArgWith(1, null, this.project)
        return (this.TokenAccessHandler.findProjectWithReadOnlyToken = sinon
          .stub()
          .callsArgWith(1, null, null))
      })

      it('should not call findProjectWithReadOnlyToken', function(done) {
        return this.TokenAccessHandler.isValidToken(
          this.projectId,
          null,
          (err, allowed) => {
            expect(
              this.TokenAccessHandler.findProjectWithReadOnlyToken.callCount
            ).to.equal(0)
            return done()
          }
        )
      })

      it('should try to find projects with both kinds of token', function(done) {
        return this.TokenAccessHandler.isValidToken(
          this.projectId,
          null,
          (err, allowed) => {
            expect(
              this.TokenAccessHandler.findProjectWithReadAndWriteToken.callCount
            ).to.equal(0)
            expect(
              this.TokenAccessHandler.findProjectWithReadOnlyToken.callCount
            ).to.equal(0)
            return done()
          }
        )
      })

      it('should not allow any access', function(done) {
        return this.TokenAccessHandler.isValidToken(
          this.projectId,
          null,
          (err, rw, ro) => {
            expect(err).to.not.exist
            expect(rw).to.equal(false)
            expect(ro).to.equal(false)
            return done()
          }
        )
      })
    })
  })

  describe('protectTokens', function() {
    beforeEach(function() {
      return (this.project = {
        tokens: {
          readAndWrite: 'rw',
          readOnly: 'ro',
          readAndWritePrefix: 'pre'
        }
      })
    })

    it('should hide write token from read-only user', function() {
      this.TokenAccessHandler.protectTokens(this.project, 'readOnly')
      expect(this.project.tokens.readAndWrite).to.equal('')
      expect(this.project.tokens.readAndWritePrefix).to.equal('')
      return expect(this.project.tokens.readOnly).to.equal('ro')
    })

    it('should hide read token from read-write user', function() {
      this.TokenAccessHandler.protectTokens(this.project, 'readAndWrite')
      expect(this.project.tokens.readAndWrite).to.equal('rw')
      return expect(this.project.tokens.readOnly).to.equal('')
    })

    it('should leave tokens in place for owner', function() {
      this.TokenAccessHandler.protectTokens(this.project, 'owner')
      expect(this.project.tokens.readAndWrite).to.equal('rw')
      return expect(this.project.tokens.readOnly).to.equal('ro')
    })
  })

  describe('getDocPublishedInfo', function() {
    beforeEach(function() {
      return (this.callback = sinon.stub())
    })

    describe('when v1 api not set', function() {
      beforeEach(function() {
        return this.TokenAccessHandler.getV1DocPublishedInfo(
          this.token,
          this.callback
        )
      })

      it('should not check access and return default info', function() {
        expect(this.V1Api.request.called).to.equal(false)
        return expect(
          this.callback.calledWith(null, {
            allow: true
          })
        ).to.equal(true)
      })
    })

    describe('when v1 api is set', function() {
      beforeEach(function() {
        return (this.settings.apis = { v1: 'v1' })
      })

      describe('on V1Api.request success', function() {
        beforeEach(function() {
          this.V1Api.request = sinon
            .stub()
            .callsArgWith(1, null, null, 'mock-data')
          return this.TokenAccessHandler.getV1DocPublishedInfo(
            this.token,
            this.callback
          )
        })

        it('should return response body', function() {
          expect(
            this.V1Api.request.calledWith({
              url: `/api/v1/sharelatex/docs/${this.token}/is_published`
            })
          ).to.equal(true)
          return expect(this.callback.calledWith(null, 'mock-data')).to.equal(
            true
          )
        })
      })

      describe('on V1Api.request error', function() {
        beforeEach(function() {
          this.V1Api.request = sinon.stub().callsArgWith(1, 'error')
          return this.TokenAccessHandler.getV1DocPublishedInfo(
            this.token,
            this.callback
          )
        })

        it('should callback with error', function() {
          return expect(this.callback.calledWith('error')).to.equal(true)
        })
      })
    })
  })

  describe('getV1DocInfo', function() {
    beforeEach(function() {
      this.v2UserId = 123
      return (this.callback = sinon.stub())
    })

    describe('when v1 api not set', function() {
      beforeEach(function() {
        return this.TokenAccessHandler.getV1DocInfo(
          this.token,
          this.v2UserId,
          this.callback
        )
      })

      it('should not check access and return default info', function() {
        expect(this.V1Api.request.called).to.equal(false)
        return expect(
          this.callback.calledWith(null, {
            exists: true,
            exported: false
          })
        ).to.equal(true)
      })
    })

    describe('when v1 api is set', function() {
      beforeEach(function() {
        return (this.settings.apis = { v1: 'v1' })
      })

      describe('on UserGetter.getUser success', function() {
        beforeEach(function() {
          this.UserGetter.getUser = sinon.stub().yields(null, {
            overleaf: { id: 1 }
          })
          return this.TokenAccessHandler.getV1DocInfo(
            this.token,
            this.v2UserId,
            this.callback
          )
        })

        it('should get user', function() {
          return expect(
            this.UserGetter.getUser.calledWith(this.v2UserId)
          ).to.equal(true)
        })
      })

      describe('on UserGetter.getUser error', function() {
        beforeEach(function() {
          this.error = new Error('failed to get user')
          this.UserGetter.getUser = sinon.stub().yields(this.error)
          return this.TokenAccessHandler.getV1DocInfo(
            this.token,
            this.v2UserId,
            this.callback
          )
        })

        it('should callback with error', function() {
          return expect(this.callback.calledWith(this.error)).to.equal(true)
        })
      })

      describe('on V1Api.request success', function() {
        beforeEach(function() {
          this.v1UserId = 1
          this.UserGetter.getUser = sinon.stub().yields(null, {
            overleaf: { id: this.v1UserId }
          })
          this.V1Api.request = sinon
            .stub()
            .callsArgWith(1, null, null, 'mock-data')
          return this.TokenAccessHandler.getV1DocInfo(
            this.token,
            this.v2UserId,
            this.callback
          )
        })

        it('should return response body', function() {
          expect(
            this.V1Api.request.calledWith({
              url: `/api/v1/sharelatex/users/${this.v1UserId}/docs/${
                this.token
              }/info`
            })
          ).to.equal(true)
          return expect(this.callback.calledWith(null, 'mock-data')).to.equal(
            true
          )
        })
      })

      describe('on V1Api.request error', function() {
        beforeEach(function() {
          this.UserGetter.getUser = sinon.stub().yields(null, {
            overleaf: { id: 1 }
          })
          this.V1Api.request = sinon.stub().callsArgWith(1, 'error')
          return this.TokenAccessHandler.getV1DocInfo(
            this.token,
            this.v2UserId,
            this.callback
          )
        })

        it('should callback with error', function() {
          return expect(this.callback.calledWith('error')).to.equal(true)
        })
      })
    })
  })
})
