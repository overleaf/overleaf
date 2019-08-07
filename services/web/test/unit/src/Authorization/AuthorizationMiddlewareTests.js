/* eslint-disable
    camelcase,
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
  '../../../../app/src/Features/Authorization/AuthorizationMiddleware.js'
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../../../app/src/Features/Errors/Errors.js')

describe('AuthorizationMiddleware', function() {
  beforeEach(function() {
    this.user_id = 'user-id-123'
    this.project_id = 'project-id-123'
    this.token = 'some-token'
    this.AuthenticationController = {
      getLoggedInUserId: sinon.stub().returns(this.user_id),
      isUserLoggedIn: sinon.stub().returns(true)
    }
    this.AuthorizationMiddleware = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        './AuthorizationManager': (this.AuthorizationManager = {}),
        'logger-sharelatex': { log() {} },
        mongojs: {
          ObjectId: (this.ObjectId = {})
        },
        '../Errors/Errors': Errors,
        '../Authentication/AuthenticationController': this
          .AuthenticationController,
        '../TokenAccess/TokenAccessHandler': (this.TokenAccessHandler = {
          getRequestToken: sinon.stub().returns(this.token)
        })
      }
    })
    this.req = {}
    this.res = {}
    this.ObjectId.isValid = sinon.stub()
    this.ObjectId.isValid.withArgs(this.project_id).returns(true)
    return (this.next = sinon.stub())
  })

  describe('_getUserId', function() {
    beforeEach(function() {
      return (this.req = {})
    })

    it('should get the user from session', function(done) {
      this.AuthenticationController.getLoggedInUserId = sinon
        .stub()
        .returns('1234')
      return this.AuthorizationMiddleware._getUserId(
        this.req,
        (err, user_id) => {
          expect(err).to.not.exist
          expect(user_id).to.equal('1234')
          return done()
        }
      )
    })

    it('should get oauth_user from request', function(done) {
      this.AuthenticationController.getLoggedInUserId = sinon
        .stub()
        .returns(null)
      this.req.oauth_user = { _id: '5678' }
      return this.AuthorizationMiddleware._getUserId(
        this.req,
        (err, user_id) => {
          expect(err).to.not.exist
          expect(user_id).to.equal('5678')
          return done()
        }
      )
    })

    it('should fall back to null', function(done) {
      this.AuthenticationController.getLoggedInUserId = sinon
        .stub()
        .returns(null)
      this.req.oauth_user = undefined
      return this.AuthorizationMiddleware._getUserId(
        this.req,
        (err, user_id) => {
          expect(err).to.not.exist
          expect(user_id).to.equal(null)
          return done()
        }
      )
    })
  })

  const METHODS_TO_TEST = {
    ensureUserCanReadProject: 'canUserReadProject',
    ensureUserCanWriteProjectSettings: 'canUserWriteProjectSettings',
    ensureUserCanWriteProjectContent: 'canUserWriteProjectContent',
    ensureUserCanAdminProject: 'canUserAdminProject'
  }
  for (let middlewareMethod in METHODS_TO_TEST) {
    const managerMethod = METHODS_TO_TEST[middlewareMethod]
    ;((middlewareMethod, managerMethod) =>
      describe(middlewareMethod, function() {
        beforeEach(function() {
          this.req.params = { project_id: this.project_id }
          this.AuthorizationManager[managerMethod] = sinon.stub()
          return (this.AuthorizationMiddleware.redirectToRestricted = sinon.stub())
        })

        describe('with missing project_id', function() {
          beforeEach(function() {
            return (this.req.params = {})
          })

          it('should return an error to next', function() {
            this.AuthorizationMiddleware[middlewareMethod](
              this.req,
              this.res,
              this.next
            )
            return this.next.calledWith(new Error()).should.equal(true)
          })
        })

        describe('with logged in user', function() {
          beforeEach(function() {
            return this.AuthenticationController.getLoggedInUserId.returns(
              this.user_id
            )
          })

          describe('when user has permission', function() {
            beforeEach(function() {
              return this.AuthorizationManager[managerMethod]
                .withArgs(this.user_id, this.project_id, this.token)
                .yields(null, true)
            })

            it('should return next', function() {
              this.AuthorizationMiddleware[middlewareMethod](
                this.req,
                this.res,
                this.next
              )
              return this.next.called.should.equal(true)
            })
          })

          describe("when user doesn't have permission", function() {
            beforeEach(function() {
              return this.AuthorizationManager[managerMethod]
                .withArgs(this.user_id, this.project_id, this.token)
                .yields(null, false)
            })

            it('should redirect to redirectToRestricted', function() {
              this.AuthorizationMiddleware[middlewareMethod](
                this.req,
                this.res,
                this.next
              )
              this.next.called.should.equal(false)
              return this.AuthorizationMiddleware.redirectToRestricted
                .calledWith(this.req, this.res, this.next)
                .should.equal(true)
            })
          })
        })

        describe('with anonymous user', function() {
          describe('when user has permission', function() {
            beforeEach(function() {
              this.AuthenticationController.getLoggedInUserId.returns(null)
              return this.AuthorizationManager[managerMethod]
                .withArgs(null, this.project_id, this.token)
                .yields(null, true)
            })

            it('should return next', function() {
              this.AuthorizationMiddleware[middlewareMethod](
                this.req,
                this.res,
                this.next
              )
              return this.next.called.should.equal(true)
            })
          })

          describe("when user doesn't have permission", function() {
            beforeEach(function() {
              this.AuthenticationController.getLoggedInUserId.returns(null)
              return this.AuthorizationManager[managerMethod]
                .withArgs(null, this.project_id, this.token)
                .yields(null, false)
            })

            it('should redirect to redirectToRestricted', function() {
              this.AuthorizationMiddleware[middlewareMethod](
                this.req,
                this.res,
                this.next
              )
              this.next.called.should.equal(false)
              return this.AuthorizationMiddleware.redirectToRestricted
                .calledWith(this.req, this.res, this.next)
                .should.equal(true)
            })
          })
        })

        describe('with malformed project id', function() {
          beforeEach(function() {
            this.req.params = { project_id: 'blah' }
            return (this.ObjectId.isValid = sinon.stub().returns(false))
          })

          it('should return a not found error', function(done) {
            return this.AuthorizationMiddleware[middlewareMethod](
              this.req,
              this.res,
              error => {
                error.should.be.instanceof(Errors.NotFoundError)
                return done()
              }
            )
          })
        })
      }))(middlewareMethod, managerMethod)
  }

  describe('ensureUserIsSiteAdmin', function() {
    beforeEach(function() {
      this.AuthorizationManager.isUserSiteAdmin = sinon.stub()
      return (this.AuthorizationMiddleware.redirectToRestricted = sinon.stub())
    })

    describe('with logged in user', function() {
      beforeEach(function() {
        return this.AuthenticationController.getLoggedInUserId.returns(
          this.user_id
        )
      })

      describe('when user has permission', function() {
        beforeEach(function() {
          return this.AuthorizationManager.isUserSiteAdmin
            .withArgs(this.user_id)
            .yields(null, true)
        })

        it('should return next', function() {
          this.AuthorizationMiddleware.ensureUserIsSiteAdmin(
            this.req,
            this.res,
            this.next
          )
          return this.next.called.should.equal(true)
        })
      })

      describe("when user doesn't have permission", function() {
        beforeEach(function() {
          return this.AuthorizationManager.isUserSiteAdmin
            .withArgs(this.user_id)
            .yields(null, false)
        })

        it('should redirect to redirectToRestricted', function() {
          this.AuthorizationMiddleware.ensureUserIsSiteAdmin(
            this.req,
            this.res,
            this.next
          )
          this.next.called.should.equal(false)
          return this.AuthorizationMiddleware.redirectToRestricted
            .calledWith(this.req, this.res, this.next)
            .should.equal(true)
        })
      })
    })

    describe('with anonymous user', function() {
      describe('when user has permission', function() {
        beforeEach(function() {
          this.AuthenticationController.getLoggedInUserId.returns(null)
          return this.AuthorizationManager.isUserSiteAdmin
            .withArgs(null)
            .yields(null, true)
        })

        it('should return next', function() {
          this.AuthorizationMiddleware.ensureUserIsSiteAdmin(
            this.req,
            this.res,
            this.next
          )
          return this.next.called.should.equal(true)
        })
      })

      describe("when user doesn't have permission", function() {
        beforeEach(function() {
          this.AuthenticationController.getLoggedInUserId.returns(null)
          return this.AuthorizationManager.isUserSiteAdmin
            .withArgs(null)
            .yields(null, false)
        })

        it('should redirect to redirectToRestricted', function() {
          this.AuthorizationMiddleware.ensureUserIsSiteAdmin(
            this.req,
            this.res,
            this.next
          )
          this.next.called.should.equal(false)
          return this.AuthorizationMiddleware.redirectToRestricted
            .calledWith(this.req, this.res, this.next)
            .should.equal(true)
        })
      })
    })
  })

  describe('ensureUserCanReadMultipleProjects', function() {
    beforeEach(function() {
      this.AuthorizationManager.canUserReadProject = sinon.stub()
      this.AuthorizationMiddleware.redirectToRestricted = sinon.stub()
      return (this.req.query = { project_ids: 'project1,project2' })
    })

    describe('with logged in user', function() {
      beforeEach(function() {
        return this.AuthenticationController.getLoggedInUserId.returns(
          this.user_id
        )
      })

      describe('when user has permission to access all projects', function() {
        beforeEach(function() {
          this.AuthorizationManager.canUserReadProject
            .withArgs(this.user_id, 'project1', this.token)
            .yields(null, true)
          return this.AuthorizationManager.canUserReadProject
            .withArgs(this.user_id, 'project2', this.token)
            .yields(null, true)
        })

        it('should return next', function() {
          this.AuthorizationMiddleware.ensureUserCanReadMultipleProjects(
            this.req,
            this.res,
            this.next
          )
          return this.next.called.should.equal(true)
        })
      })

      describe("when user doesn't have permission to access one of the projects", function() {
        beforeEach(function() {
          this.AuthorizationManager.canUserReadProject
            .withArgs(this.user_id, 'project1', this.token)
            .yields(null, true)
          return this.AuthorizationManager.canUserReadProject
            .withArgs(this.user_id, 'project2', this.token)
            .yields(null, false)
        })

        it('should redirect to redirectToRestricted', function() {
          this.AuthorizationMiddleware.ensureUserCanReadMultipleProjects(
            this.req,
            this.res,
            this.next
          )
          this.next.called.should.equal(false)
          return this.AuthorizationMiddleware.redirectToRestricted
            .calledWith(this.req, this.res, this.next)
            .should.equal(true)
        })
      })
    })

    describe('with anonymous user', function() {
      describe('when user has permission', function() {
        describe('when user has permission to access all projects', function() {
          beforeEach(function() {
            this.AuthenticationController.getLoggedInUserId.returns(null)
            this.AuthorizationManager.canUserReadProject
              .withArgs(null, 'project1', this.token)
              .yields(null, true)
            return this.AuthorizationManager.canUserReadProject
              .withArgs(null, 'project2', this.token)
              .yields(null, true)
          })

          it('should return next', function() {
            this.AuthorizationMiddleware.ensureUserCanReadMultipleProjects(
              this.req,
              this.res,
              this.next
            )
            return this.next.called.should.equal(true)
          })
        })

        describe("when user doesn't have permission to access one of the projects", function() {
          beforeEach(function() {
            this.AuthenticationController.getLoggedInUserId.returns(null)
            this.AuthorizationManager.canUserReadProject
              .withArgs(null, 'project1', this.token)
              .yields(null, true)
            return this.AuthorizationManager.canUserReadProject
              .withArgs(null, 'project2', this.token)
              .yields(null, false)
          })

          it('should redirect to redirectToRestricted', function() {
            this.AuthorizationMiddleware.ensureUserCanReadMultipleProjects(
              this.req,
              this.res,
              this.next
            )
            this.next.called.should.equal(false)
            return this.AuthorizationMiddleware.redirectToRestricted
              .calledWith(this.req, this.res, this.next)
              .should.equal(true)
          })
        })
      })
    })
  })
})
