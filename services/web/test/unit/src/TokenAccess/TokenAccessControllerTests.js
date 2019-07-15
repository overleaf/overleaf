/* eslint-disable
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
  '../../../../app/src/Features/TokenAccess/TokenAccessController'
)
const { expect } = require('chai')
const { ObjectId } = require('mongojs')
const MockRequest = require('../helpers/MockRequest')
const MockResponse = require('../helpers/MockResponse')
const Errors = require('../../../../app/src/Features/Errors/Errors.js')

describe('TokenAccessController', function() {
  beforeEach(function() {
    this.readOnlyToken = 'somereadonlytoken'
    this.readAndWriteToken = '42somereadandwritetoken'
    this.projectId = ObjectId()
    this.ownerId = 'owner'
    this.project = {
      _id: this.projectId,
      publicAccesLevel: 'tokenBased',
      tokens: {
        readOnly: this.readOnlyToken,
        readAndWrite: this.readAndWriteToken
      },
      owner_ref: this.ownerId
    }
    this.userId = ObjectId()
    this.TokenAccessController = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../Project/ProjectController': (this.ProjectController = {}),
        '../Authentication/AuthenticationController': (this.AuthenticationController = {}),
        './TokenAccessHandler': (this.TokenAccessHandler = {
          getV1DocPublishedInfo: sinon.stub().yields(null, {
            allow: true
          }),
          getV1DocInfo: sinon.stub().yields(null, {
            exists: true,
            exported: false
          })
        }),
        '../../infrastructure/Features': (this.Features = {
          hasFeature: sinon.stub().returns(false)
        }),
        'logger-sharelatex': {
          log: sinon.stub(),
          warn: sinon.stub(),
          err: sinon.stub()
        },
        'settings-sharelatex': {
          overleaf: {
            host: 'http://overleaf.test:5000'
          }
        },
        '../V1/V1Api': (this.V1Api = {
          request: sinon.stub().callsArgWith(1, null, {}, { allow: true })
        })
      }
    })

    return (this.AuthenticationController.getLoggedInUserId = sinon
      .stub()
      .returns(this.userId.toString()))
  })

  describe('readAndWriteToken', function() {
    beforeEach(function() {})

    describe('when all goes well', function() {
      beforeEach(function() {
        this.req = new MockRequest()
        this.res = new MockResponse()
        this.next = sinon.stub()
        this.req.params['read_and_write_token'] = this.readAndWriteToken
        this.TokenAccessHandler.findProjectWithReadAndWriteToken = sinon
          .stub()
          .callsArgWith(1, null, this.project, true)
        this.TokenAccessHandler.addReadAndWriteUserToProject = sinon
          .stub()
          .callsArgWith(2, null)
        this.ProjectController.loadEditor = sinon.stub()
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        return this.TokenAccessController.readAndWriteToken(
          this.req,
          this.res,
          this.next
        )
      })

      it('should try to find a project with this token', function(done) {
        expect(
          this.TokenAccessHandler.findProjectWithReadAndWriteToken.callCount
        ).to.equal(1)
        expect(
          this.TokenAccessHandler.findProjectWithReadAndWriteToken.calledWith(
            this.readAndWriteToken
          )
        ).to.equal(true)
        return done()
      })

      it('should add the user to the project with read-write access', function(done) {
        expect(
          this.TokenAccessHandler.addReadAndWriteUserToProject.callCount
        ).to.equal(1)
        expect(
          this.TokenAccessHandler.addReadAndWriteUserToProject.calledWith(
            this.userId.toString(),
            this.projectId
          )
        ).to.equal(true)
        return done()
      })

      it('should pass control to loadEditor', function(done) {
        expect(this.req.params.Project_id).to.equal(this.projectId.toString())
        expect(this.ProjectController.loadEditor.callCount).to.equal(1)
        expect(
          this.ProjectController.loadEditor.calledWith(
            this.req,
            this.res,
            this.next
          )
        ).to.equal(true)
        return done()
      })
    })

    describe('when the user is already the owner', function() {
      beforeEach(function() {
        this.req = new MockRequest()
        this.res = new MockResponse()
        this.next = sinon.stub()
        this.req.params['read_and_write_token'] = this.readAndWriteToken
        this.project.owner_ref = this.userId
        this.TokenAccessHandler.findProjectWithReadAndWriteToken = sinon
          .stub()
          .callsArgWith(1, null, this.project, true)
        this.TokenAccessHandler.addReadAndWriteUserToProject = sinon
          .stub()
          .callsArgWith(2, null)
        this.ProjectController.loadEditor = sinon.stub()
        return this.TokenAccessController.readAndWriteToken(
          this.req,
          this.res,
          this.next
        )
      })

      it('should try to find a project with this token', function(done) {
        expect(
          this.TokenAccessHandler.findProjectWithReadAndWriteToken.callCount
        ).to.equal(1)
        expect(
          this.TokenAccessHandler.findProjectWithReadAndWriteToken.calledWith(
            this.readAndWriteToken
          )
        ).to.equal(true)
        return done()
      })

      it('should not add the user to the project with read-write access', function(done) {
        expect(
          this.TokenAccessHandler.addReadAndWriteUserToProject.callCount
        ).to.equal(0)
        return done()
      })

      it('should pass control to loadEditor', function(done) {
        expect(this.req.params.Project_id).to.equal(this.projectId.toString())
        expect(this.ProjectController.loadEditor.callCount).to.equal(1)
        expect(
          this.ProjectController.loadEditor.calledWith(
            this.req,
            this.res,
            this.next
          )
        ).to.equal(true)
        return done()
      })
    })

    describe('when there is no user', function() {
      beforeEach(function() {
        return (this.AuthenticationController.getLoggedInUserId = sinon
          .stub()
          .returns(null))
      })

      describe('when anonymous read-write access is enabled', function() {
        beforeEach(function() {
          this.TokenAccessHandler.ANONYMOUS_READ_AND_WRITE_ENABLED = true
          this.req = new MockRequest()
          this.res = new MockResponse()
          this.next = sinon.stub()
          this.req.params['read_and_write_token'] = this.readAndWriteToken
          this.TokenAccessHandler.findProjectWithReadAndWriteToken = sinon
            .stub()
            .callsArgWith(1, null, this.project, true)
          this.TokenAccessHandler.addReadAndWriteUserToProject = sinon
            .stub()
            .callsArgWith(2, null)
          this.ProjectController.loadEditor = sinon.stub()
          this.TokenAccessHandler.grantSessionTokenAccess = sinon.stub()
          return this.TokenAccessController.readAndWriteToken(
            this.req,
            this.res,
            this.next
          )
        })

        it('should not add the user to the project with read-write access', function(done) {
          expect(
            this.TokenAccessHandler.addReadAndWriteUserToProject.callCount
          ).to.equal(0)
          return done()
        })

        it('should give the user session token access', function(done) {
          expect(
            this.TokenAccessHandler.grantSessionTokenAccess.callCount
          ).to.equal(1)
          expect(
            this.TokenAccessHandler.grantSessionTokenAccess.calledWith(
              this.req,
              this.projectId,
              this.readAndWriteToken
            )
          ).to.equal(true)
          return done()
        })

        it('should pass control to loadEditor', function(done) {
          expect(this.req.params.Project_id).to.equal(this.projectId.toString())
          expect(this.ProjectController.loadEditor.callCount).to.equal(1)
          expect(
            this.ProjectController.loadEditor.calledWith(
              this.req,
              this.res,
              this.next
            )
          ).to.equal(true)
          return done()
        })
      })

      describe('when anonymous read-write access is not enabled', function() {
        beforeEach(function() {
          this.TokenAccessHandler.ANONYMOUS_READ_AND_WRITE_ENABLED = false
          this.req = new MockRequest()
          this.res = new MockResponse()
          this.res.redirect = sinon.stub()
          this.next = sinon.stub()
          this.req.params['read_and_write_token'] = this.readAndWriteToken
          this.TokenAccessHandler.findProjectWithReadAndWriteToken = sinon
            .stub()
            .callsArgWith(1, null, this.project, true)
          this.TokenAccessHandler.addReadAndWriteUserToProject = sinon
            .stub()
            .callsArgWith(2, null)
          this.ProjectController.loadEditor = sinon.stub()
          this.TokenAccessHandler.grantSessionTokenAccess = sinon.stub()
          this.AuthenticationController.setRedirectInSession = sinon.stub()
          return this.TokenAccessController.readAndWriteToken(
            this.req,
            this.res,
            this.next
          )
        })

        it('should not add the user to the project with read-write access', function(done) {
          expect(
            this.TokenAccessHandler.addReadAndWriteUserToProject.callCount
          ).to.equal(0)
          return done()
        })

        it('should give the user session token access', function(done) {
          expect(
            this.TokenAccessHandler.grantSessionTokenAccess.callCount
          ).to.equal(0)
          return done()
        })

        it('should not pass control to loadEditor', function(done) {
          expect(this.ProjectController.loadEditor.callCount).to.equal(0)
          expect(
            this.ProjectController.loadEditor.calledWith(
              this.req,
              this.res,
              this.next
            )
          ).to.equal(false)
          return done()
        })

        it('should set redirect in session', function(done) {
          expect(
            this.AuthenticationController.setRedirectInSession.callCount
          ).to.equal(1)
          expect(
            this.AuthenticationController.setRedirectInSession.calledWith(
              this.req
            )
          ).to.equal(true)
          return done()
        })

        it('should redirect to restricted page', function(done) {
          expect(this.res.redirect.callCount).to.equal(1)
          expect(this.res.redirect.calledWith('/restricted')).to.equal(true)
          return done()
        })
      })
    })

    describe('when findProject produces an error', function() {
      beforeEach(function() {
        this.req = new MockRequest()
        this.res = new MockResponse()
        this.next = sinon.stub()
        this.req.params['read_and_write_token'] = this.readAndWriteToken
        this.TokenAccessHandler.findProjectWithReadAndWriteToken = sinon
          .stub()
          .callsArgWith(1, new Error('woops'))
        this.TokenAccessHandler.addReadAndWriteUserToProject = sinon
          .stub()
          .callsArgWith(2, null)
        this.ProjectController.loadEditor = sinon.stub()
        return this.TokenAccessController.readAndWriteToken(
          this.req,
          this.res,
          this.next
        )
      })

      it('should try to find a project with this token', function(done) {
        expect(
          this.TokenAccessHandler.findProjectWithReadAndWriteToken.callCount
        ).to.equal(1)
        expect(
          this.TokenAccessHandler.findProjectWithReadAndWriteToken.calledWith(
            this.readAndWriteToken
          )
        ).to.equal(true)
        return done()
      })

      it('should not add the user to the project with read-write access', function(done) {
        expect(
          this.TokenAccessHandler.addReadAndWriteUserToProject.callCount
        ).to.equal(0)
        return done()
      })

      it('should not pass control to loadEditor', function(done) {
        expect(this.ProjectController.loadEditor.callCount).to.equal(0)
        expect(
          this.ProjectController.loadEditor.calledWith(
            this.req,
            this.res,
            this.next
          )
        ).to.equal(false)
        return done()
      })

      it('should call next with an error', function(done) {
        expect(this.next.callCount).to.equal(1)
        expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
        return done()
      })
    })

    describe('when findProject does not find a project', function() {
      beforeEach(function() {})

      describe('when user is present', function() {
        beforeEach(function() {
          return (this.AuthenticationController.getLoggedInUserId = sinon
            .stub()
            .returns(this.userId.toString()))
        })

        describe('when project does not exist', function() {
          beforeEach(function() {
            this.req = new MockRequest()
            this.req.url = '/123abc'
            this.res = new MockResponse()
            this.res.redirect = sinon.stub()
            this.res.render = sinon.stub()
            this.next = sinon.stub()
            this.req.params['read_and_write_token'] = '123abc'
            return (this.TokenAccessHandler.findProjectWithReadAndWriteToken = sinon
              .stub()
              .callsArgWith(1, null, null, false))
          })

          describe('when project was not exported from v1', function() {
            beforeEach(function() {
              this.TokenAccessHandler.getV1DocInfo = sinon.stub().yields(null, {
                exists: true,
                exported: false
              })
              return this.TokenAccessController.readAndWriteToken(
                this.req,
                this.res,
                this.next
              )
            })

            it('should not redirect to v1', function(done) {
              expect(this.res.redirect.callCount).to.equal(0)
              done()
            })

            it('should show project import page', function(done) {
              expect(this.res.render.calledWith('project/v2-import')).to.equal(
                true
              )
              done()
            })
          })

          describe('when project was not exported from v1 but forcing import to v2', function() {
            beforeEach(function() {
              return this.Features.hasFeature.returns(true)
            })

            describe('with project name', function() {
              beforeEach(function() {
                this.TokenAccessHandler.getV1DocInfo = sinon
                  .stub()
                  .yields(null, {
                    exists: true,
                    exported: false,
                    has_owner: true,
                    name: 'A title',
                    has_assignment: false,
                    brand_info: null
                  })
                return this.TokenAccessController.readAndWriteToken(
                  this.req,
                  this.res,
                  this.next
                )
              })

              it('should render v2-import page with name', function(done) {
                expect(
                  this.res.render.calledWith('project/v2-import', {
                    projectId: '123abc',
                    name: 'A title',
                    hasOwner: true,
                    hasAssignment: false,
                    brandInfo: null
                  })
                ).to.equal(true)
                return done()
              })
            })

            describe('with project owner', function() {
              beforeEach(function() {
                this.TokenAccessHandler.getV1DocInfo = sinon
                  .stub()
                  .yields(null, {
                    exists: true,
                    exported: false,
                    has_owner: true,
                    name: 'A title',
                    has_assignment: false,
                    brand_info: null
                  })
                return this.TokenAccessController.readAndWriteToken(
                  this.req,
                  this.res,
                  this.next
                )
              })

              it('should render v2-import page', function(done) {
                expect(
                  this.res.render.calledWith('project/v2-import', {
                    projectId: '123abc',
                    hasOwner: true,
                    name: 'A title',
                    hasAssignment: false,
                    brandInfo: null
                  })
                ).to.equal(true)
                return done()
              })
            })

            describe('without project owner', function() {
              beforeEach(function() {
                this.TokenAccessHandler.getV1DocInfo = sinon
                  .stub()
                  .yields(null, {
                    exists: true,
                    exported: false,
                    has_owner: false,
                    name: 'A title',
                    has_assignment: false,
                    brand_info: null
                  })
                return this.TokenAccessController.readAndWriteToken(
                  this.req,
                  this.res,
                  this.next
                )
              })

              it('should render v2-import page', function(done) {
                expect(
                  this.res.render.calledWith('project/v2-import', {
                    projectId: '123abc',
                    hasOwner: false,
                    name: 'A title',
                    hasAssignment: false,
                    brandInfo: null
                  })
                ).to.equal(true)
                return done()
              })
            })

            describe('with assignment', function() {
              beforeEach(function() {
                this.TokenAccessHandler.getV1DocInfo = sinon
                  .stub()
                  .yields(null, {
                    exists: true,
                    exported: false,
                    has_owner: false,
                    name: 'A title',
                    has_assignment: true,
                    brand_info: null
                  })
                return this.TokenAccessController.readAndWriteToken(
                  this.req,
                  this.res,
                  this.next
                )
              })

              it('should render v2-import page', function(done) {
                expect(
                  this.res.render.calledWith('project/v2-import', {
                    projectId: '123abc',
                    hasOwner: false,
                    name: 'A title',
                    hasAssignment: true,
                    brandInfo: null
                  })
                ).to.equal(true)
                return done()
              })
            })

            describe('with brand info', function() {
              beforeEach(function() {
                this.TokenAccessHandler.getV1DocInfo = sinon
                  .stub()
                  .yields(null, {
                    exists: true,
                    exported: false,
                    has_owner: false,
                    name: 'A title',
                    has_assignment: false,
                    brand_info: 'wellcome'
                  })
                return this.TokenAccessController.readAndWriteToken(
                  this.req,
                  this.res,
                  this.next
                )
              })

              it('should render v2-import page', function(done) {
                expect(
                  this.res.render.calledWith('project/v2-import', {
                    projectId: '123abc',
                    hasOwner: false,
                    name: 'A title',
                    hasAssignment: false,
                    brandInfo: 'wellcome'
                  })
                ).to.equal(true)
                return done()
              })
            })

            describe('with anonymous user', function() {
              beforeEach(function() {
                this.AuthenticationController.getLoggedInUserId = sinon
                  .stub()
                  .returns(null)
                return this.TokenAccessController.readAndWriteToken(
                  this.req,
                  this.res,
                  this.next
                )
              })

              it('should render anonymous import status page', function(done) {
                expect(this.res.render.callCount).to.equal(1)
                expect(
                  this.res.render.calledWith('project/v2-import', {
                    loginRedirect: '/123abc'
                  })
                ).to.equal(true)
                return done()
              })
            })
          })

          describe('when project was exported from v1', function() {
            beforeEach(function() {
              this.TokenAccessHandler.getV1DocInfo = sinon.stub().yields(null, {
                exists: true,
                exported: true
              })
              return this.TokenAccessController.readAndWriteToken(
                this.req,
                this.res,
                this.next
              )
            })

            it('should call next with a not-found error', function(done) {
              expect(this.next.callCount).to.equal(1)
              return done()
            })
          })

          describe('when project does not exist on v1', function() {
            beforeEach(function() {
              this.TokenAccessHandler.getV1DocInfo = sinon.stub().yields(null, {
                exists: false,
                exported: false
              })
              return this.TokenAccessController.readAndWriteToken(
                this.req,
                this.res,
                this.next
              )
            })

            it('should call next with a not-found error', function(done) {
              expect(this.next.callCount).to.equal(1)
              expect(this.next.calledWith(new Errors.NotFoundError())).to.equal(
                true
              )
              return done()
            })
          })
        })

        describe('when token access is off, but user has higher access anyway', function() {
          beforeEach(function() {
            this.req = new MockRequest()
            this.res = new MockResponse()
            this.res.redirect = sinon.stub()
            this.next = sinon.stub()
            this.req.params['read_and_write_token'] = this.readAndWriteToken
            this.TokenAccessHandler.findProjectWithReadAndWriteToken = sinon
              .stub()
              .callsArgWith(1, null, null, true)
            this.TokenAccessHandler.findProjectWithHigherAccess = sinon
              .stub()
              .callsArgWith(2, null, this.project)
            this.TokenAccessHandler.addReadAndWriteUserToProject = sinon
              .stub()
              .callsArgWith(2, null)
            this.ProjectController.loadEditor = sinon.stub()
            return this.TokenAccessController.readAndWriteToken(
              this.req,
              this.res,
              this.next
            )
          })

          it('should try to find a project with this token', function(done) {
            expect(
              this.TokenAccessHandler.findProjectWithReadAndWriteToken.callCount
            ).to.equal(1)
            expect(
              this.TokenAccessHandler.findProjectWithReadAndWriteToken.calledWith(
                this.readAndWriteToken
              )
            ).to.equal(true)
            return done()
          })

          it('should check if user has higher access to the token project', function(done) {
            expect(
              this.TokenAccessHandler.findProjectWithHigherAccess.callCount
            ).to.equal(1)
            return done()
          })

          it('should not add the user to the project with read-write access', function(done) {
            expect(
              this.TokenAccessHandler.addReadAndWriteUserToProject.callCount
            ).to.equal(0)
            return done()
          })

          it('should not pass control to loadEditor', function(done) {
            expect(this.ProjectController.loadEditor.callCount).to.equal(0)
            expect(
              this.ProjectController.loadEditor.calledWith(
                this.req,
                this.res,
                this.next
              )
            ).to.equal(false)
            return done()
          })

          it('should not call next with a not-found error', function(done) {
            expect(this.next.callCount).to.equal(0)
            return done()
          })

          it('should redirect to the canonical project url', function(done) {
            expect(this.res.redirect.callCount).to.equal(1)
            expect(
              this.res.redirect.calledWith(302, `/project/${this.project._id}`)
            ).to.equal(true)
            return done()
          })
        })

        describe('when higher access is not available', function() {
          beforeEach(function() {
            this.req = new MockRequest()
            this.res = new MockResponse()
            this.next = sinon.stub()
            this.req.params['read_and_write_token'] = this.readAndWriteToken
            this.TokenAccessHandler.findProjectWithReadAndWriteToken = sinon
              .stub()
              .callsArgWith(1, null, null, true)
            this.TokenAccessHandler.findProjectWithHigherAccess = sinon
              .stub()
              .callsArgWith(2, null, null)
            this.TokenAccessHandler.addReadAndWriteUserToProject = sinon
              .stub()
              .callsArgWith(2, null)
            this.ProjectController.loadEditor = sinon.stub()
            return this.TokenAccessController.readAndWriteToken(
              this.req,
              this.res,
              this.next
            )
          })

          it('should try to find a project with this token', function(done) {
            expect(
              this.TokenAccessHandler.findProjectWithReadAndWriteToken.callCount
            ).to.equal(1)
            expect(
              this.TokenAccessHandler.findProjectWithReadAndWriteToken.calledWith(
                this.readAndWriteToken
              )
            ).to.equal(true)
            return done()
          })

          it('should check if user has higher access to the token project', function(done) {
            expect(
              this.TokenAccessHandler.findProjectWithHigherAccess.callCount
            ).to.equal(1)
            return done()
          })

          it('should not add the user to the project with read-write access', function(done) {
            expect(
              this.TokenAccessHandler.addReadAndWriteUserToProject.callCount
            ).to.equal(0)
            return done()
          })

          it('should not pass control to loadEditor', function(done) {
            expect(this.ProjectController.loadEditor.callCount).to.equal(0)
            expect(
              this.ProjectController.loadEditor.calledWith(
                this.req,
                this.res,
                this.next
              )
            ).to.equal(false)
            return done()
          })

          it('should call next with a not-found error', function(done) {
            expect(this.next.callCount).to.equal(1)
            expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
            return done()
          })
        })
      })
    })

    describe('when adding user to project produces an error', function() {
      beforeEach(function() {
        this.req = new MockRequest()
        this.res = new MockResponse()
        this.next = sinon.stub()
        this.req.params['read_and_write_token'] = this.readAndWriteToken
        this.TokenAccessHandler.findProjectWithReadAndWriteToken = sinon
          .stub()
          .callsArgWith(1, null, this.project, true)
        this.TokenAccessHandler.addReadAndWriteUserToProject = sinon
          .stub()
          .callsArgWith(2, new Error('woops'))
        this.ProjectController.loadEditor = sinon.stub()
        return this.TokenAccessController.readAndWriteToken(
          this.req,
          this.res,
          this.next
        )
      })

      it('should try to find a project with this token', function(done) {
        expect(
          this.TokenAccessHandler.findProjectWithReadAndWriteToken.callCount
        ).to.equal(1)
        expect(
          this.TokenAccessHandler.findProjectWithReadAndWriteToken.calledWith(
            this.readAndWriteToken
          )
        ).to.equal(true)
        return done()
      })

      it('should add the user to the project with read-write access', function(done) {
        expect(
          this.TokenAccessHandler.addReadAndWriteUserToProject.callCount
        ).to.equal(1)
        expect(
          this.TokenAccessHandler.addReadAndWriteUserToProject.calledWith(
            this.userId.toString(),
            this.projectId
          )
        ).to.equal(true)
        return done()
      })

      it('should not pass control to loadEditor', function(done) {
        expect(this.ProjectController.loadEditor.callCount).to.equal(0)
        expect(
          this.ProjectController.loadEditor.calledWith(
            this.req,
            this.res,
            this.next
          )
        ).to.equal(false)
        return done()
      })

      it('should call next with an error', function(done) {
        expect(this.next.callCount).to.equal(1)
        expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
        return done()
      })
    })
  })

  describe('readOnlyToken', function() {
    beforeEach(function() {
      return (this.TokenAccessHandler.checkV1Access = sinon
        .stub()
        .callsArgWith(1, null, true))
    })

    describe('when access not allowed by v1 api', function() {
      beforeEach(function() {
        this.req = new MockRequest()
        this.res = new MockResponse()
        this.res.redirect = sinon.stub()
        this.next = sinon.stub()
        this.TokenAccessHandler.findProjectWithReadOnlyToken = sinon
          .stub()
          .callsArgWith(1, null, this.project, true)
        this.TokenAccessHandler.getV1DocPublishedInfo = sinon
          .stub()
          .yields(null, {
            allow: false,
            published_path: 'doc-url'
          })
        return this.TokenAccessController.readOnlyToken(
          this.req,
          this.res,
          this.next
        )
      })

      it('should redirect to doc-url', function() {
        return expect(this.res.redirect.calledWith('doc-url')).to.equal(true)
      })
    })

    describe('with a user', function() {
      beforeEach(function() {
        return (this.AuthenticationController.getLoggedInUserId = sinon
          .stub()
          .returns(this.userId.toString()))
      })

      describe('when all goes well', function() {
        beforeEach(function() {
          this.req = new MockRequest()
          this.res = new MockResponse()
          this.next = sinon.stub()
          this.req.params['read_only_token'] = this.readOnlyToken
          this.TokenAccessHandler.findProjectWithReadOnlyToken = sinon
            .stub()
            .callsArgWith(1, null, this.project, true)
          this.TokenAccessHandler.addReadOnlyUserToProject = sinon
            .stub()
            .callsArgWith(2, null)
          this.ProjectController.loadEditor = sinon.stub()
          return this.TokenAccessController.readOnlyToken(
            this.req,
            this.res,
            this.next
          )
        })

        it('should try to find a project with this token', function(done) {
          expect(
            this.TokenAccessHandler.findProjectWithReadOnlyToken.callCount
          ).to.equal(1)
          expect(
            this.TokenAccessHandler.findProjectWithReadOnlyToken.calledWith(
              this.readOnlyToken
            )
          ).to.equal(true)
          return done()
        })

        it('should add the user to the project with read-only access', function(done) {
          expect(
            this.TokenAccessHandler.addReadOnlyUserToProject.callCount
          ).to.equal(1)
          expect(
            this.TokenAccessHandler.addReadOnlyUserToProject.calledWith(
              this.userId.toString(),
              this.projectId
            )
          ).to.equal(true)
          return done()
        })

        it('should pass control to loadEditor', function(done) {
          expect(this.req.params.Project_id).to.equal(this.projectId.toString())
          expect(this.ProjectController.loadEditor.callCount).to.equal(1)
          expect(
            this.ProjectController.loadEditor.calledWith(
              this.req,
              this.res,
              this.next
            )
          ).to.equal(true)
          return done()
        })
      })

      describe('when the user is already the owner', function() {
        beforeEach(function() {
          this.req = new MockRequest()
          this.res = new MockResponse()
          this.next = sinon.stub()
          this.req.params['read_only_token'] = this.readOnlyToken
          this.project.owner_ref = this.userId
          this.TokenAccessHandler.findProjectWithReadOnlyToken = sinon
            .stub()
            .callsArgWith(1, null, this.project, true)
          this.TokenAccessHandler.addReadOnlyUserToProject = sinon
            .stub()
            .callsArgWith(2, null)
          this.ProjectController.loadEditor = sinon.stub()
          return this.TokenAccessController.readOnlyToken(
            this.req,
            this.res,
            this.next
          )
        })

        it('should try to find a project with this token', function(done) {
          expect(
            this.TokenAccessHandler.findProjectWithReadOnlyToken.callCount
          ).to.equal(1)
          expect(
            this.TokenAccessHandler.findProjectWithReadOnlyToken.calledWith(
              this.readOnlyToken
            )
          ).to.equal(true)
          return done()
        })

        it('should not add the user to the project with read-only access', function(done) {
          expect(
            this.TokenAccessHandler.addReadOnlyUserToProject.callCount
          ).to.equal(0)
          return done()
        })

        it('should pass control to loadEditor', function(done) {
          expect(this.req.params.Project_id).to.equal(this.projectId.toString())
          expect(this.ProjectController.loadEditor.callCount).to.equal(1)
          expect(
            this.ProjectController.loadEditor.calledWith(
              this.req,
              this.res,
              this.next
            )
          ).to.equal(true)
          return done()
        })
      })

      describe('when findProject produces an error', function() {
        beforeEach(function() {
          this.req = new MockRequest()
          this.res = new MockResponse()
          this.next = sinon.stub()
          this.req.params['read_only_token'] = this.readOnlyToken
          this.TokenAccessHandler.findProjectWithReadOnlyToken = sinon
            .stub()
            .callsArgWith(1, new Error('woops'))
          this.TokenAccessHandler.addReadOnlyUserToProject = sinon
            .stub()
            .callsArgWith(2, null)
          this.ProjectController.loadEditor = sinon.stub()
          return this.TokenAccessController.readOnlyToken(
            this.req,
            this.res,
            this.next
          )
        })

        it('should try to find a project with this token', function(done) {
          expect(
            this.TokenAccessHandler.findProjectWithReadOnlyToken.callCount
          ).to.equal(1)
          expect(
            this.TokenAccessHandler.findProjectWithReadOnlyToken.calledWith(
              this.readOnlyToken
            )
          ).to.equal(true)
          return done()
        })

        it('should not add the user to the project with read-only access', function(done) {
          expect(
            this.TokenAccessHandler.addReadOnlyUserToProject.callCount
          ).to.equal(0)
          return done()
        })

        it('should not pass control to loadEditor', function(done) {
          expect(this.ProjectController.loadEditor.callCount).to.equal(0)
          expect(
            this.ProjectController.loadEditor.calledWith(
              this.req,
              this.res,
              this.next
            )
          ).to.equal(false)
          return done()
        })

        it('should call next with an error', function(done) {
          expect(this.next.callCount).to.equal(1)
          expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
          return done()
        })
      })
    })

    describe('when findProject does not find a project', function() {
      describe('when project does not exist', function() {
        beforeEach(function() {
          this.req = new MockRequest()
          this.res = new MockResponse()
          this.res.redirect = sinon.stub()
          this.res.render = sinon.stub()
          this.next = sinon.stub()
          this.req.params['read_only_token'] = 'abcd'
          this.TokenAccessHandler.findProjectWithReadOnlyToken = sinon
            .stub()
            .callsArgWith(1, null, null, false)
          this.TokenAccessHandler.checkV1ProjectExported = sinon
            .stub()
            .callsArgWith(1, null, false)
          this.TokenAccessController.readOnlyToken(
            this.req,
            this.res,
            this.next
          )
        })

        it('should not redirect to v1', function(done) {
          expect(this.res.redirect.callCount).to.equal(0)
          done()
        })

        it('should show project import page', function(done) {
          expect(this.res.render.calledWith('project/v2-import')).to.equal(true)
          done()
        })
      })

      describe('when project was not exported from v1 but forcing import to v2', function() {
        beforeEach(function() {
          this.Features.hasFeature.returns(true)
          this.req = new MockRequest()
          this.res = new MockResponse()
          this.res.render = sinon.stub()
          this.next = sinon.stub()
          this.req.params['read_only_token'] = 'abcd'
          return (this.TokenAccessHandler.findProjectWithReadOnlyToken = sinon
            .stub()
            .callsArgWith(1, null, null, false))
        })

        describe('with project name', function() {
          beforeEach(function() {
            this.TokenAccessHandler.getV1DocInfo = sinon.stub().yields(null, {
              exists: true,
              exported: false,
              has_owner: true,
              name: 'A title',
              has_assignment: false,
              brand_info: null
            })
            return this.TokenAccessController.readOnlyToken(
              this.req,
              this.res,
              this.next
            )
          })

          it('should render v2-import page with name', function(done) {
            expect(
              this.res.render.calledWith('project/v2-import', {
                projectId: 'abcd',
                name: 'A title',
                hasOwner: true,
                hasAssignment: false,
                brandInfo: null
              })
            ).to.equal(true)
            return done()
          })
        })

        describe('with project owner', function() {
          beforeEach(function() {
            this.TokenAccessHandler.getV1DocInfo = sinon.stub().yields(null, {
              exists: true,
              exported: false,
              has_owner: true,
              name: 'A title',
              has_assignment: false,
              brand_info: null
            })
            return this.TokenAccessController.readOnlyToken(
              this.req,
              this.res,
              this.next
            )
          })

          it('should render v2-import page', function(done) {
            expect(
              this.res.render.calledWith('project/v2-import', {
                projectId: 'abcd',
                hasOwner: true,
                name: 'A title',
                hasAssignment: false,
                brandInfo: null
              })
            ).to.equal(true)
            return done()
          })
        })

        describe('without project owner', function() {
          beforeEach(function() {
            this.TokenAccessHandler.getV1DocInfo = sinon.stub().yields(null, {
              exists: true,
              exported: false,
              has_owner: false,
              name: 'A title',
              has_assignment: false,
              brand_info: null
            })
            return this.TokenAccessController.readOnlyToken(
              this.req,
              this.res,
              this.next
            )
          })

          it('should render v2-import page', function(done) {
            expect(
              this.res.render.calledWith('project/v2-import', {
                projectId: 'abcd',
                hasOwner: false,
                name: 'A title',
                hasAssignment: false,
                brandInfo: null
              })
            ).to.equal(true)
            return done()
          })
        })

        describe('with assignment', function() {
          beforeEach(function() {
            this.TokenAccessHandler.getV1DocInfo = sinon.stub().yields(null, {
              exists: true,
              exported: false,
              has_owner: false,
              name: 'A title',
              has_assignment: true,
              brand_info: null
            })
            return this.TokenAccessController.readOnlyToken(
              this.req,
              this.res,
              this.next
            )
          })

          it('should render v2-import page', function(done) {
            expect(
              this.res.render.calledWith('project/v2-import', {
                projectId: 'abcd',
                hasOwner: false,
                name: 'A title',
                hasAssignment: true,
                brandInfo: null
              })
            ).to.equal(true)
            return done()
          })
        })

        describe('with brand info', function() {
          beforeEach(function() {
            this.TokenAccessHandler.getV1DocInfo = sinon.stub().yields(null, {
              exists: true,
              exported: false,
              has_owner: false,
              name: 'A title',
              has_assignment: false,
              brand_info: 'f1000'
            })
            return this.TokenAccessController.readOnlyToken(
              this.req,
              this.res,
              this.next
            )
          })

          it('should render v2-import page', function(done) {
            expect(
              this.res.render.calledWith('project/v2-import', {
                projectId: 'abcd',
                hasOwner: false,
                name: 'A title',
                hasAssignment: false,
                brandInfo: 'f1000'
              })
            ).to.equal(true)
            return done()
          })
        })
      })

      describe('when project was exported from v1', function() {
        beforeEach(function() {
          this.req = new MockRequest()
          this.res = new MockResponse()
          this.res.redirect = sinon.stub()
          this.next = sinon.stub()
          this.req.params['read_only_token'] = 'abcd'
          this.TokenAccessHandler.findProjectWithReadOnlyToken = sinon
            .stub()
            .callsArgWith(1, null, null, false)
          this.TokenAccessHandler.getV1DocInfo = sinon.stub().yields(null, {
            allow: true,
            exists: true,
            exported: true
          })
          return this.TokenAccessController.readOnlyToken(
            this.req,
            this.res,
            this.next
          )
        })

        it('should call next with a not-found error', function(done) {
          expect(this.next.callCount).to.equal(1)
          return done()
        })
      })

      describe('when token access is off, but user has higher access anyway', function() {
        beforeEach(function() {
          this.req = new MockRequest()
          this.res = new MockResponse()
          this.res.redirect = sinon.stub()
          this.next = sinon.stub()
          this.req.params['read_and_write_token'] = this.readAndWriteToken
          this.TokenAccessHandler.findProjectWithReadAndWriteToken = sinon
            .stub()
            .callsArgWith(1, null, null, true)
          this.TokenAccessHandler.findProjectWithHigherAccess = sinon
            .stub()
            .callsArgWith(2, null, this.project)
          this.TokenAccessHandler.addReadAndWriteUserToProject = sinon
            .stub()
            .callsArgWith(2, null)
          this.ProjectController.loadEditor = sinon.stub()
          return this.TokenAccessController.readAndWriteToken(
            this.req,
            this.res,
            this.next
          )
        })

        it('should try to find a project with this token', function(done) {
          expect(
            this.TokenAccessHandler.findProjectWithReadAndWriteToken.callCount
          ).to.equal(1)
          expect(
            this.TokenAccessHandler.findProjectWithReadAndWriteToken.calledWith(
              this.readAndWriteToken
            )
          ).to.equal(true)
          return done()
        })

        it('should check if user has higher access to the token project', function(done) {
          expect(
            this.TokenAccessHandler.findProjectWithHigherAccess.callCount
          ).to.equal(1)
          return done()
        })

        it('should not add the user to the project with read-write access', function(done) {
          expect(
            this.TokenAccessHandler.addReadAndWriteUserToProject.callCount
          ).to.equal(0)
          return done()
        })

        it('should not pass control to loadEditor', function(done) {
          expect(this.ProjectController.loadEditor.callCount).to.equal(0)
          expect(
            this.ProjectController.loadEditor.calledWith(
              this.req,
              this.res,
              this.next
            )
          ).to.equal(false)
          return done()
        })

        it('should not call next with a not-found error', function(done) {
          expect(this.next.callCount).to.equal(0)
          return done()
        })

        it('should redirect to the canonical project url', function(done) {
          expect(this.res.redirect.callCount).to.equal(1)
          expect(
            this.res.redirect.calledWith(302, `/project/${this.project._id}`)
          ).to.equal(true)
          return done()
        })
      })

      describe('when higher access is not available', function() {
        beforeEach(function() {
          this.req = new MockRequest()
          this.res = new MockResponse()
          this.next = sinon.stub()
          this.req.params['read_and_write_token'] = this.readAndWriteToken
          this.TokenAccessHandler.findProjectWithReadAndWriteToken = sinon
            .stub()
            .callsArgWith(1, null, null, true)
          this.TokenAccessHandler.findProjectWithHigherAccess = sinon
            .stub()
            .callsArgWith(2, null, null)
          this.TokenAccessHandler.addReadOnlyUserToProject = sinon
            .stub()
            .callsArgWith(2, null)
          this.ProjectController.loadEditor = sinon.stub()
          return this.TokenAccessController.readAndWriteToken(
            this.req,
            this.res,
            this.next
          )
        })

        it('should try to find a project with this token', function(done) {
          expect(
            this.TokenAccessHandler.findProjectWithReadAndWriteToken.callCount
          ).to.equal(1)
          expect(
            this.TokenAccessHandler.findProjectWithReadAndWriteToken.calledWith(
              this.readAndWriteToken
            )
          ).to.equal(true)
          return done()
        })

        it('should check if user has higher access to the token project', function(done) {
          expect(
            this.TokenAccessHandler.findProjectWithHigherAccess.callCount
          ).to.equal(1)
          return done()
        })

        it('should not add the user to the project with read-write access', function(done) {
          expect(
            this.TokenAccessHandler.addReadOnlyUserToProject.callCount
          ).to.equal(0)
          return done()
        })

        it('should not pass control to loadEditor', function(done) {
          expect(this.ProjectController.loadEditor.callCount).to.equal(0)
          expect(
            this.ProjectController.loadEditor.calledWith(
              this.req,
              this.res,
              this.next
            )
          ).to.equal(false)
          return done()
        })

        it('should call next with a not-found error', function(done) {
          expect(this.next.callCount).to.equal(1)
          expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
          return done()
        })
      })
    })

    describe('when adding user to project produces an error', function() {
      beforeEach(function() {
        this.req = new MockRequest()
        this.res = new MockResponse()
        this.next = sinon.stub()
        this.req.params['read_only_token'] = this.readOnlyToken
        this.TokenAccessHandler.findProjectWithReadOnlyToken = sinon
          .stub()
          .callsArgWith(1, null, this.project, true)
        this.TokenAccessHandler.addReadOnlyUserToProject = sinon
          .stub()
          .callsArgWith(2, new Error('woops'))
        this.ProjectController.loadEditor = sinon.stub()
        return this.TokenAccessController.readOnlyToken(
          this.req,
          this.res,
          this.next
        )
      })

      it('should try to find a project with this token', function(done) {
        expect(
          this.TokenAccessHandler.findProjectWithReadOnlyToken.callCount
        ).to.equal(1)
        expect(
          this.TokenAccessHandler.findProjectWithReadOnlyToken.calledWith(
            this.readOnlyToken
          )
        ).to.equal(true)
        return done()
      })

      it('should add the user to the project with read-only access', function(done) {
        expect(
          this.TokenAccessHandler.addReadOnlyUserToProject.callCount
        ).to.equal(1)
        expect(
          this.TokenAccessHandler.addReadOnlyUserToProject.calledWith(
            this.userId.toString(),
            this.projectId
          )
        ).to.equal(true)
        return done()
      })

      it('should not pass control to loadEditor', function(done) {
        expect(this.ProjectController.loadEditor.callCount).to.equal(0)
        expect(
          this.ProjectController.loadEditor.calledWith(
            this.req,
            this.res,
            this.next
          )
        ).to.equal(false)
        return done()
      })

      it('should call next with an error', function(done) {
        expect(this.next.callCount).to.equal(1)
        expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
        return done()
      })
    })

    describe('anonymous', function() {
      beforeEach(function() {
        this.AuthenticationController.getLoggedInUserId = sinon
          .stub()
          .returns(null)
        return (this.TokenAccessHandler.grantSessionTokenAccess = sinon.stub())
      })

      describe('when all goes well', function() {
        beforeEach(function() {
          this.req = new MockRequest()
          this.res = new MockResponse()
          this.next = sinon.stub()
          this.req.params['read_only_token'] = this.readOnlyToken
          this.TokenAccessHandler.findProjectWithReadOnlyToken = sinon
            .stub()
            .callsArgWith(1, null, this.project, true)
          this.TokenAccessHandler.addReadOnlyUserToProject = sinon
            .stub()
            .callsArgWith(2, null)
          this.ProjectController.loadEditor = sinon.stub()
          return this.TokenAccessController.readOnlyToken(
            this.req,
            this.res,
            this.next
          )
        })

        it('should try to find a project with this token', function(done) {
          expect(
            this.TokenAccessHandler.findProjectWithReadOnlyToken.callCount
          ).to.equal(1)
          expect(
            this.TokenAccessHandler.findProjectWithReadOnlyToken.calledWith(
              this.readOnlyToken
            )
          ).to.equal(true)
          return done()
        })

        it('should give the user session read-only access', function(done) {
          expect(
            this.TokenAccessHandler.grantSessionTokenAccess.callCount
          ).to.equal(1)
          expect(
            this.TokenAccessHandler.grantSessionTokenAccess.calledWith(
              this.req,
              this.projectId,
              this.readOnlyToken
            )
          ).to.equal(true)
          return done()
        })

        it('should not add the user to the project with read-only access', function(done) {
          expect(
            this.TokenAccessHandler.addReadOnlyUserToProject.callCount
          ).to.equal(0)
          return done()
        })

        it('should pass control to loadEditor', function(done) {
          expect(this.req.params.Project_id).to.equal(this.projectId.toString())
          expect(this.req._anonymousAccessToken).to.equal(this.readOnlyToken)
          expect(this.ProjectController.loadEditor.callCount).to.equal(1)
          expect(
            this.ProjectController.loadEditor.calledWith(
              this.req,
              this.res,
              this.next
            )
          ).to.equal(true)
          return done()
        })
      })

      describe('when findProject produces an error', function() {
        beforeEach(function() {
          this.req = new MockRequest()
          this.res = new MockResponse()
          this.next = sinon.stub()
          this.req.params['read_only_token'] = this.readOnlyToken
          this.TokenAccessHandler.findProjectWithReadOnlyToken = sinon
            .stub()
            .callsArgWith(1, new Error('woops'))
          this.TokenAccessHandler.addReadOnlyUserToProject = sinon
            .stub()
            .callsArgWith(2, null)
          this.ProjectController.loadEditor = sinon.stub()
          return this.TokenAccessController.readOnlyToken(
            this.req,
            this.res,
            this.next
          )
        })

        it('should try to find a project with this token', function(done) {
          expect(
            this.TokenAccessHandler.findProjectWithReadOnlyToken.callCount
          ).to.equal(1)
          expect(
            this.TokenAccessHandler.findProjectWithReadOnlyToken.calledWith(
              this.readOnlyToken
            )
          ).to.equal(true)
          return done()
        })

        it('should not give the user session read-only access', function(done) {
          expect(
            this.TokenAccessHandler.grantSessionTokenAccess.callCount
          ).to.equal(0)
          return done()
        })

        it('should not add the user to the project with read-only access', function(done) {
          expect(
            this.TokenAccessHandler.addReadOnlyUserToProject.callCount
          ).to.equal(0)
          return done()
        })

        it('should not pass control to loadEditor', function(done) {
          expect(this.ProjectController.loadEditor.callCount).to.equal(0)
          expect(
            this.ProjectController.loadEditor.calledWith(
              this.req,
              this.res,
              this.next
            )
          ).to.equal(false)
          return done()
        })

        it('should call next with an error', function(done) {
          expect(this.next.callCount).to.equal(1)
          expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
          return done()
        })
      })

      describe('when findProject does not find a project', function() {
        beforeEach(function() {
          this.req = new MockRequest()
          this.res = new MockResponse()
          this.res.redirect = sinon.stub()
          this.next = sinon.stub()
          this.req.params['read_only_token'] = this.readOnlyToken
          this.AuthenticationController.getLoggedInUserId = sinon
            .stub()
            .returns(this.userId.toString())
          this.TokenAccessHandler.findProjectWithReadOnlyToken = sinon
            .stub()
            .callsArgWith(1, null, false)
          return (this.TokenAccessHandler.addReadOnlyUserToProject = sinon.stub())
        })

        describe('when project does not exist', function() {
          beforeEach(function() {
            return this.TokenAccessController.readOnlyToken(
              this.req,
              this.res,
              this.next
            )
          })

          it('should try to find a project with this token', function(done) {
            expect(
              this.TokenAccessHandler.findProjectWithReadOnlyToken.callCount
            ).to.equal(1)
            expect(
              this.TokenAccessHandler.findProjectWithReadOnlyToken.calledWith(
                this.readOnlyToken
              )
            ).to.equal(true)
            return done()
          })

          it('should not give the user session read-only access', function(done) {
            expect(
              this.TokenAccessHandler.grantSessionTokenAccess.callCount
            ).to.equal(0)
            return done()
          })

          it('should not add the user to the project with read-only access', function(done) {
            expect(
              this.TokenAccessHandler.addReadOnlyUserToProject.callCount
            ).to.equal(0)
            return done()
          })
        })

        describe('when project was exported to v2', function() {
          beforeEach(function() {
            this.TokenAccessHandler.getV1DocInfo = sinon.stub().yields(null, {
              exists: true,
              exported: true
            })
            return this.TokenAccessController.readOnlyToken(
              this.req,
              this.res,
              this.next
            )
          })

          it('should call next with not found error', function(done) {
            expect(this.next.callCount).to.equal(1)
            expect(this.next.calledWith(new Errors.NotFoundError())).to.equal(
              true
            )
            return done()
          })
        })

        describe('when project was not exported to v2', function() {
          beforeEach(function() {
            this.TokenAccessHandler.getV1DocInfo = sinon.stub().yields(null, {
              exists: true,
              exported: false
            })
            this.res.render = sinon.stub()
            this.TokenAccessController.readOnlyToken(
              this.req,
              this.res,
              this.next
            )
          })

          it('should not redirect to v1', function(done) {
            expect(this.res.redirect.callCount).to.equal(0)
            done()
          })

          it('should show project import page', function(done) {
            expect(this.res.render.calledWith('project/v2-import')).to.equal(
              true
            )
            done()
          })
        })

        describe('when project does not exist on v1', function() {
          beforeEach(function() {
            this.TokenAccessHandler.getV1DocInfo = sinon.stub().yields(null, {
              exists: false,
              exported: false
            })
            return this.TokenAccessController.readOnlyToken(
              this.req,
              this.res,
              this.next
            )
          })

          it('should call next with not found error', function(done) {
            expect(this.next.callCount).to.equal(1)
            expect(this.next.calledWith(new Errors.NotFoundError())).to.equal(
              true
            )
            return done()
          })
        })

        describe('anonymous user', function() {
          beforeEach(function() {
            return (this.AuthenticationController.getLoggedInUserId = sinon
              .stub()
              .returns(null))
          })

          describe('when project was not exported to v2', function() {
            beforeEach(function() {
              this.TokenAccessHandler.getV1DocInfo = sinon.stub().yields(null, {
                exists: true,
                exported: false
              })
              this.res.render = sinon.stub()
              this.TokenAccessController.readOnlyToken(
                this.req,
                this.res,
                this.next
              )
            })

            it('should not redirect to v1', function(done) {
              expect(this.res.redirect.callCount).to.equal(0)
              done()
            })

            it('should show project import page', function(done) {
              expect(this.res.render.calledWith('project/v2-import')).to.equal(
                true
              )
              done()
            })
          })

          describe('force-import-to-v2 flag is on', function() {
            beforeEach(function() {
              this.res.render = sinon.stub()
              return this.Features.hasFeature.returns(true)
            })

            describe('when project was not exported to v2', function() {
              beforeEach(function() {
                this.TokenAccessHandler.getV1DocInfo = sinon
                  .stub()
                  .yields(null, {
                    exists: true,
                    exported: false
                  })
                return this.TokenAccessController.readOnlyToken(
                  this.req,
                  this.res,
                  this.next
                )
              })

              it('should render anonymous import status page', function(done) {
                expect(this.res.render.callCount).to.equal(1)
                expect(
                  this.res.render.calledWith('project/v2-import', {
                    loginRedirect: `/read/${this.readOnlyToken}`
                  })
                ).to.equal(true)
                return done()
              })
            })
          })
        })
      })
    })
  })
})
