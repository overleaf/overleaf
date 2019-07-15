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
const { expect } = require('chai')
const modulePath =
  '../../../../app/src/Features/UserMembership/UserMembershipAuthorization.js'
const SandboxedModule = require('sandboxed-module')
const MockRequest = require('../helpers/MockRequest')
const EntityConfigs = require('../../../../app/src/Features/UserMembership/UserMembershipEntityConfigs')
const Errors = require('../../../../app/src/Features/Errors/Errors')

describe('UserMembershipAuthorization', function() {
  beforeEach(function() {
    this.req = new MockRequest()
    this.req.params.id = 'mock-entity-id'
    this.user = { _id: 'mock-user-id' }
    this.subscription = { _id: 'mock-subscription-id' }

    this.AuthenticationController = {
      getSessionUser: sinon.stub().returns(this.user)
    }
    this.UserMembershipHandler = {
      getEntity: sinon.stub().yields(null, this.subscription),
      getEntityWithoutAuthorizationCheck: sinon
        .stub()
        .yields(null, this.subscription)
    }
    this.AuthorizationMiddleware = {
      redirectToRestricted: sinon.stub().yields(),
      ensureUserIsSiteAdmin: sinon.stub().yields()
    }
    return (this.UserMembershipAuthorization = SandboxedModule.require(
      modulePath,
      {
        globals: {
          console: console
        },
        requires: {
          '../Authentication/AuthenticationController': this
            .AuthenticationController,
          '../Authorization/AuthorizationMiddleware': this
            .AuthorizationMiddleware,
          './UserMembershipHandler': this.UserMembershipHandler,
          './EntityConfigs': EntityConfigs,
          '../Errors/Errors': Errors,
          request: (this.request = sinon.stub().yields(null, null, {})),
          'logger-sharelatex': {
            log() {},
            warn() {},
            err() {}
          }
        }
      }
    ))
  })

  describe('requireAccessToEntity', function() {
    it('get entity', function(done) {
      return this.UserMembershipAuthorization.requireGroupMetricsAccess(
        this.req,
        null,
        error => {
          expect(error).to.not.exist
          sinon.assert.calledWithMatch(
            this.UserMembershipHandler.getEntity,
            this.req.params.id,
            { modelName: 'Subscription' },
            this.user
          )
          expect(this.req.entity).to.equal(this.subscription)
          expect(this.req.entityConfig).to.exist
          return done()
        }
      )
    })

    it('handle entity not found as non-admin', function(done) {
      this.UserMembershipHandler.getEntity.yields(null, null)
      this.UserMembershipHandler.getEntityWithoutAuthorizationCheck.yields(
        null,
        null
      )
      return this.UserMembershipAuthorization.requireGroupMetricsAccess(
        this.req,
        null,
        error => {
          expect(error).to.exist
          expect(error).to.be.instanceof(Error)
          expect(error.constructor.name).to.equal('NotFoundError')
          sinon.assert.called(this.UserMembershipHandler.getEntity)
          expect(this.req.entity).to.not.exist
          return done()
        }
      )
    })

    it('handle entity not found an admin can create', function(done) {
      this.user.isAdmin = true
      this.UserMembershipHandler.getEntity.yields(null, null)
      this.UserMembershipHandler.getEntityWithoutAuthorizationCheck.yields(
        null,
        null
      )
      return this.UserMembershipAuthorization.requirePublisherMetricsAccess(
        this.req,
        {
          redirect: path => {
            expect(path).to.exist
            expect(path).to.match(/create/)
            return done()
          }
        }
      )
    })

    it('handle entity not found a non-admin can create', function(done) {
      this.user.staffAccess = { institutionManagement: true }
      this.UserMembershipHandler.getEntity.yields(null, null)
      this.UserMembershipHandler.getEntityWithoutAuthorizationCheck.yields(
        null,
        null
      )
      return this.UserMembershipAuthorization.requirePublisherMetricsAccess(
        this.req,
        {
          redirect: path => {
            expect(path).to.exist
            expect(path).to.match(/create/)
            return done()
          }
        }
      )
    })

    it('handle entity not found an admin cannot create', function(done) {
      this.user.isAdmin = true
      this.UserMembershipHandler.getEntity.yields(null, null)
      this.UserMembershipHandler.getEntityWithoutAuthorizationCheck.yields(
        null,
        null
      )
      return this.UserMembershipAuthorization.requireGroupMetricsAccess(
        this.req,
        null,
        error => {
          expect(error).to.exist
          expect(error).to.be.instanceof(Error)
          expect(error.constructor.name).to.equal('NotFoundError')
          return done()
        }
      )
    })

    it('handle entity no access', function(done) {
      this.UserMembershipHandler.getEntity.yields(null, null)
      return this.UserMembershipAuthorization.requireGroupMetricsAccess(
        this.req,
        null,
        error => {
          sinon.assert.called(this.AuthorizationMiddleware.redirectToRestricted)
          return done()
        }
      )
    })

    it('handle anonymous user', function(done) {
      this.AuthenticationController.getSessionUser.returns(null)
      return this.UserMembershipAuthorization.requireGroupMetricsAccess(
        this.req,
        null,
        error => {
          expect(error).to.not.exist
          sinon.assert.called(this.AuthorizationMiddleware.redirectToRestricted)
          sinon.assert.notCalled(this.UserMembershipHandler.getEntity)
          expect(this.req.entity).to.not.exist
          return done()
        }
      )
    })

    it('checks user is staff if required', function(done) {
      return this.UserMembershipAuthorization.requireInstitutionManagementStaffAccess(
        this.req,
        null,
        error => {
          expect(error).to.not.exist
          sinon.assert.called(this.AuthorizationMiddleware.redirectToRestricted)
          sinon.assert.notCalled(this.UserMembershipHandler.getEntity)
          expect(this.req.entity).to.not.exist
          return done()
        }
      )
    })
  })

  describe('requireEntityAccess', function() {
    it('handle team access', function(done) {
      return this.UserMembershipAuthorization.requireTeamMetricsAccess(
        this.req,
        null,
        error => {
          expect(error).to.not.exist
          sinon.assert.calledWithMatch(
            this.UserMembershipHandler.getEntity,
            this.req.params.id,
            { fields: { primaryKey: 'overleaf.id' } }
          )
          return done()
        }
      )
    })

    it('handle group access', function(done) {
      return this.UserMembershipAuthorization.requireGroupMetricsAccess(
        this.req,
        null,
        error => {
          expect(error).to.not.exist
          sinon.assert.calledWithMatch(
            this.UserMembershipHandler.getEntity,
            this.req.params.id,
            { translations: { title: 'group_account' } }
          )
          return done()
        }
      )
    })

    it('handle group managers access', function(done) {
      return this.UserMembershipAuthorization.requireGroupManagersManagementAccess(
        this.req,
        null,
        error => {
          expect(error).to.not.exist
          sinon.assert.calledWithMatch(
            this.UserMembershipHandler.getEntity,
            this.req.params.id,
            { translations: { subtitle: 'managers_management' } }
          )
          return done()
        }
      )
    })

    it('handle institution access', function(done) {
      return this.UserMembershipAuthorization.requireInstitutionMetricsAccess(
        this.req,
        null,
        error => {
          expect(error).to.not.exist
          sinon.assert.calledWithMatch(
            this.UserMembershipHandler.getEntity,
            this.req.params.id,
            { modelName: 'Institution' }
          )
          return done()
        }
      )
    })

    it('handle template with brand access', function(done) {
      const templateData = {
        id: 123,
        title: 'Template Title',
        brand: { slug: 'brand-slug' }
      }
      this.request.yields(
        null,
        { statusCode: 200 },
        JSON.stringify(templateData)
      )
      return this.UserMembershipAuthorization.requireTemplateMetricsAccess(
        this.req,
        null,
        error => {
          expect(error).to.not.exist
          sinon.assert.calledWithMatch(
            this.UserMembershipHandler.getEntity,
            'brand-slug',
            { modelName: 'Publisher' }
          )
          return done()
        }
      )
    })

    it('handle template without brand access', function(done) {
      const templateData = {
        id: 123,
        title: 'Template Title',
        brand: null
      }
      this.request.yields(
        null,
        { statusCode: 200 },
        JSON.stringify(templateData)
      )
      return this.UserMembershipAuthorization.requireTemplateMetricsAccess(
        this.req,
        null,
        error => {
          expect(error).to.not.exist
          sinon.assert.notCalled(this.UserMembershipHandler.getEntity)
          sinon.assert.calledOnce(
            this.AuthorizationMiddleware.ensureUserIsSiteAdmin
          )
          return done()
        }
      )
    })

    it('handle graph access', function(done) {
      this.req.query.resource_id = 'mock-resource-id'
      this.req.query.resource_type = 'institution'
      const middleware = this.UserMembershipAuthorization.requireGraphAccess
      return middleware(this.req, null, error => {
        expect(error).to.not.exist
        sinon.assert.calledWithMatch(
          this.UserMembershipHandler.getEntity,
          this.req.query.resource_id,
          { modelName: 'Institution' }
        )
        return done()
      })
    })
  })
})
