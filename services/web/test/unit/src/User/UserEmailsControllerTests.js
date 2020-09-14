const sinon = require('sinon')
const assertCalledWith = sinon.assert.calledWith
const assertNotCalled = sinon.assert.notCalled
const chai = require('chai')
const { assert, expect } = chai
const modulePath = '../../../../app/src/Features/User/UserEmailsController.js'
const SandboxedModule = require('sandboxed-module')
const MockRequest = require('../helpers/MockRequest')
const MockResponse = require('../helpers/MockResponse')
const Errors = require('../../../../app/src/Features/Errors/Errors')

describe('UserEmailsController', function() {
  beforeEach(function() {
    this.req = new MockRequest()
    this.res = new MockResponse()
    this.next = sinon.stub()
    this.user = { _id: 'mock-user-id', email: 'example@overleaf.com' }

    this.UserGetter = {
      getUserFullEmails: sinon.stub(),
      promises: {
        getUser: sinon.stub().resolves(this.user)
      }
    }
    this.AuthenticationController = {
      getLoggedInUserId: sinon.stub().returns(this.user._id),
      setInSessionUser: sinon.stub()
    }
    this.Features = {
      hasFeature: sinon.stub()
    }
    this.UserUpdater = {
      addEmailAddress: sinon.stub(),
      removeEmailAddress: sinon.stub(),
      setDefaultEmailAddress: sinon.stub(),
      updateV1AndSetDefaultEmailAddress: sinon.stub(),
      promises: {
        addEmailAddress: sinon.stub().resolves()
      }
    }
    this.EmailHelper = { parseEmail: sinon.stub() }
    this.endorseAffiliation = sinon.stub().yields()
    this.InstitutionsAPI = {
      endorseAffiliation: this.endorseAffiliation,
      getInstitutionViaDomain: sinon
        .stub()
        .withArgs('overleaf.com')
        .resolves({ sso_enabled: true })
        .withArgs('example.com')
        .resolves({ sso_enabled: false })
    }
    this.HttpErrorHandler = { conflict: sinon.stub() }
    this.UserEmailsController = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../Authentication/AuthenticationController': this
          .AuthenticationController,
        '../../infrastructure/Features': this.Features,
        './UserGetter': this.UserGetter,
        './UserUpdater': this.UserUpdater,
        '../Email/EmailHandler': (this.EmailHandler = {
          promises: {
            sendEmail: sinon.stub().resolves()
          }
        }),
        '../Helpers/EmailHelper': this.EmailHelper,
        './UserEmailsConfirmationHandler': (this.UserEmailsConfirmationHandler = {
          promises: {
            sendConfirmationEmail: sinon.stub().resolves()
          }
        }),
        '../Institutions/InstitutionsAPI': this.InstitutionsAPI,
        '../Errors/HttpErrorHandler': this.HttpErrorHandler,
        '../Errors/Errors': Errors,
        'logger-sharelatex': {
          log() {
            console.log(arguments)
          },
          err() {}
        }
      }
    })
  })

  describe('List', function() {
    beforeEach(function() {})

    it('lists emails', function(done) {
      const fullEmails = [{ some: 'data' }]
      this.UserGetter.getUserFullEmails.callsArgWith(1, null, fullEmails)

      this.UserEmailsController.list(this.req, {
        json: response => {
          assert.deepEqual(response, fullEmails)
          assertCalledWith(this.UserGetter.getUserFullEmails, this.user._id)
          done()
        }
      })
    })
  })

  describe('Add', function() {
    beforeEach(function() {
      this.newEmail = 'new_email@baz.com'
      this.req.body = {
        email: this.newEmail,
        university: { name: 'University Name' },
        department: 'Department',
        role: 'Role'
      }
      this.EmailHelper.parseEmail.returns(this.newEmail)
      this.UserEmailsConfirmationHandler.sendConfirmationEmail = sinon
        .stub()
        .yields()
    })

    it('passed audit log to addEmailAddress', function(done) {
      this.res.sendStatus = sinon.stub()
      this.res.sendStatus.callsFake(() => {
        const addCall = this.UserUpdater.promises.addEmailAddress.lastCall
        expect(addCall.args[3]).to.deep.equal({
          initiatorId: this.user._id,
          ipAddress: this.req.ip
        })
        done()
      })
      this.UserEmailsController.add(this.req, this.res)
    })

    it('adds new email', function(done) {
      this.UserEmailsController.add(
        this.req,
        {
          sendStatus: code => {
            code.should.equal(204)
            assertCalledWith(this.EmailHelper.parseEmail, this.newEmail)
            assertCalledWith(
              this.UserUpdater.promises.addEmailAddress,
              this.user._id,
              this.newEmail
            )

            const affiliationOptions = this.UserUpdater.promises.addEmailAddress
              .lastCall.args[2]
            Object.keys(affiliationOptions).length.should.equal(3)
            affiliationOptions.university.should.equal(this.req.body.university)
            affiliationOptions.department.should.equal(this.req.body.department)
            affiliationOptions.role.should.equal(this.req.body.role)

            done()
          }
        },
        this.next
      )
    })

    it('sends a security alert email', function(done) {
      this.res.sendStatus = sinon.stub()
      this.res.sendStatus.callsFake(() => {
        const emailCall = this.EmailHandler.promises.sendEmail.getCall(0)
        emailCall.args[0].should.to.equal('securityAlert')
        emailCall.args[1].to.should.equal(this.user.email)
        emailCall.args[1].actionDescribed.should.contain(
          'a secondary email address'
        )
        emailCall.args[1].to.should.equal(this.user.email)
        emailCall.args[1].message[0].should.contain(this.newEmail)
        done()
      })

      this.UserEmailsController.add(this.req, this.res)
    })

    it('sends an email confirmation', function(done) {
      this.UserEmailsController.add(
        this.req,
        {
          sendStatus: code => {
            code.should.equal(204)
            assertCalledWith(
              this.UserEmailsConfirmationHandler.promises.sendConfirmationEmail,
              this.user._id,
              this.newEmail
            )
            done()
          }
        },
        this.next
      )
    })

    it('handles email parse error', function(done) {
      this.EmailHelper.parseEmail.returns(null)
      this.UserEmailsController.add(
        this.req,
        {
          sendStatus: code => {
            code.should.equal(422)
            assertNotCalled(this.UserUpdater.promises.addEmailAddress)
            done()
          }
        },
        this.next
      )
    })

    it('should pass the error to the next handler when adding the email fails', function(done) {
      this.UserUpdater.promises.addEmailAddress.rejects(new Error())
      this.UserEmailsController.add(this.req, this.res, error => {
        expect(error).to.be.instanceof(Error)
        done()
      })
    })

    it('should call the HTTP conflict handler when the email already exists', function(done) {
      this.UserUpdater.promises.addEmailAddress.rejects(
        new Errors.EmailExistsError()
      )
      this.HttpErrorHandler.conflict = sinon.spy((req, res, message) => {
        req.should.exist
        res.should.exist
        message.should.equal('email_already_registered')
        done()
      })
      this.UserEmailsController.add(this.req, this.res, this.next)
    })

    it("should call the HTTP conflict handler when there's a domain matching error", function(done) {
      this.UserUpdater.promises.addEmailAddress.rejects(
        new Error('422: Email does not belong to university')
      )
      this.HttpErrorHandler.conflict = sinon.spy((req, res, message) => {
        req.should.exist
        res.should.exist
        message.should.equal('email_does_not_belong_to_university')
        done()
      })
      this.UserEmailsController.add(this.req, this.res, this.next)
    })
  })

  describe('remove', function() {
    beforeEach(function() {
      this.email = 'email_to_remove@bar.com'
      this.req.body.email = this.email
      this.EmailHelper.parseEmail.returns(this.email)
    })

    it('removes email', function(done) {
      this.UserUpdater.removeEmailAddress.callsArgWith(2, null)

      this.UserEmailsController.remove(this.req, {
        sendStatus: code => {
          code.should.equal(200)
          assertCalledWith(this.EmailHelper.parseEmail, this.email)
          assertCalledWith(
            this.UserUpdater.removeEmailAddress,
            this.user._id,
            this.email
          )
          done()
        }
      })
    })

    it('handles email parse error', function(done) {
      this.EmailHelper.parseEmail.returns(null)

      this.UserEmailsController.remove(this.req, {
        sendStatus: code => {
          code.should.equal(422)
          assertNotCalled(this.UserUpdater.removeEmailAddress)
          done()
        }
      })
    })
  })

  describe('setDefault', function() {
    beforeEach(function() {
      this.email = 'email_to_set_default@bar.com'
      this.req.body.email = this.email
      this.EmailHelper.parseEmail.returns(this.email)
      this.AuthenticationController.setInSessionUser.returns(null)
    })

    it('sets default email', function(done) {
      this.UserUpdater.setDefaultEmailAddress.yields()

      this.UserEmailsController.setDefault(this.req, {
        sendStatus: code => {
          code.should.equal(200)
          assertCalledWith(this.EmailHelper.parseEmail, this.email)
          assertCalledWith(
            this.AuthenticationController.setInSessionUser,
            this.req,
            { email: this.email }
          )
          assertCalledWith(
            this.UserUpdater.setDefaultEmailAddress,
            this.user._id,
            this.email
          )
          done()
        }
      })
    })

    it('handles email parse error', function(done) {
      this.EmailHelper.parseEmail.returns(null)

      this.UserEmailsController.setDefault(this.req, {
        sendStatus: code => {
          code.should.equal(422)
          assertNotCalled(this.UserUpdater.setDefaultEmailAddress)
          done()
        }
      })
    })
  })

  describe('endorse', function() {
    beforeEach(function() {
      this.email = 'email_to_endorse@bar.com'
      this.req.body.email = this.email
      this.EmailHelper.parseEmail.returns(this.email)
    })

    it('endorses affiliation', function(done) {
      this.req.body.role = 'Role'
      this.req.body.department = 'Department'

      this.UserEmailsController.endorse(this.req, {
        sendStatus: code => {
          code.should.equal(204)
          assertCalledWith(
            this.endorseAffiliation,
            this.user._id,
            this.email,
            'Role',
            'Department'
          )
          done()
        }
      })
    })
  })

  describe('confirm', function() {
    beforeEach(function() {
      this.UserEmailsConfirmationHandler.confirmEmailFromToken = sinon
        .stub()
        .yields()
      this.res = {
        sendStatus: sinon.stub(),
        json: sinon.stub()
      }
      this.res.status = sinon.stub().returns(this.res)
      this.next = sinon.stub()
      this.token = 'mock-token'
      this.req.body = { token: this.token }
    })

    describe('successfully', function() {
      beforeEach(function() {
        this.UserEmailsController.confirm(this.req, this.res, this.next)
      })

      it('should confirm the email from the token', function() {
        this.UserEmailsConfirmationHandler.confirmEmailFromToken
          .calledWith(this.token)
          .should.equal(true)
      })

      it('should return a 200 status', function() {
        this.res.sendStatus.calledWith(200).should.equal(true)
      })
    })

    describe('without a token', function() {
      beforeEach(function() {
        this.req.body.token = null
        this.UserEmailsController.confirm(this.req, this.res, this.next)
      })

      it('should return a 422 status', function() {
        this.res.status.calledWith(422).should.equal(true)
      })
    })

    describe('when confirming fails', function() {
      beforeEach(function() {
        this.UserEmailsConfirmationHandler.confirmEmailFromToken = sinon
          .stub()
          .yields(new Errors.NotFoundError('not found'))
        this.UserEmailsController.confirm(this.req, this.res, this.next)
      })

      it('should return a 404 error code with a message', function() {
        this.res.status.calledWith(404).should.equal(true)
        this.res.json
          .calledWith({
            message: this.req.i18n.translate('confirmation_token_invalid')
          })
          .should.equal(true)
      })
    })
  })
  describe('resendConfirmation', function() {
    beforeEach(function() {
      this.req = {
        body: {}
      }
      this.res = {
        sendStatus: sinon.stub()
      }
      this.next = sinon.stub()
      this.UserEmailsConfirmationHandler.sendConfirmationEmail = sinon
        .stub()
        .yields()
    })
    describe('when institution SSO is released', function() {
      beforeEach(function() {
        this.Features.hasFeature.withArgs('saml').returns(true)
      })
      describe('for an institution SSO email', function() {
        beforeEach(function() {
          this.req.body.email = 'with-sso@overleaf.com'
        })
        it('should not send the email', function() {
          this.UserEmailsController.resendConfirmation(
            this.req,
            this.res,
            () => {
              this.UserEmailsConfirmationHandler.sendConfirmationEmail.should
                .not.have.been.called.once
            }
          )
        })
      })
      describe('for a non-institution SSO email', function() {
        beforeEach(function() {
          this.req.body.email = 'without-sso@example.com'
        })
        it('should send the email', function() {
          this.UserEmailsController.resendConfirmation(
            this.req,
            this.res,
            () => {
              this.UserEmailsConfirmationHandler.sendConfirmationEmail.should
                .have.been.called.once
            }
          )
        })
      })
    })
    describe('when institution SSO is not released', function() {
      beforeEach(function() {
        this.Features.hasFeature.withArgs('saml').returns(false)
      })
      describe('for an institution SSO email', function() {
        beforeEach(function() {
          this.req.body.email = 'with-sso@overleaf.com'
        })
        it('should send the email', function() {
          this.UserEmailsController.resendConfirmation(
            this.req,
            this.res,
            () => {
              this.UserEmailsConfirmationHandler.sendConfirmationEmail.should
                .have.been.called.once
            }
          )
        })
      })
      describe('for a non-institution SSO email', function() {
        beforeEach(function() {
          this.req.body.email = 'without-sso@example.com'
        })
        it('should send the email', function() {
          this.UserEmailsController.resendConfirmation(
            this.req,
            this.res,
            () => {
              this.UserEmailsConfirmationHandler.sendConfirmationEmail.should
                .have.been.called.once
            }
          )
        })
      })
    })
  })
})
