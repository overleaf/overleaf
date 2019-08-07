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
const sinon = require('sinon')
const assertCalledWith = sinon.assert.calledWith
const assertNotCalled = sinon.assert.notCalled
const chai = require('chai')
const should = chai.should()
const { assert } = chai
const modulePath = '../../../../app/src/Features/User/UserEmailsController.js'
const SandboxedModule = require('sandboxed-module')
const MockRequest = require('../helpers/MockRequest')
const MockResponse = require('../helpers/MockResponse')
const Errors = require('../../../../app/src/Features/Errors/Errors')

describe('UserEmailsController', function() {
  beforeEach(function() {
    this.req = new MockRequest()
    this.user = { _id: 'mock-user-id' }

    this.UserGetter = { getUserFullEmails: sinon.stub() }
    this.AuthenticationController = {
      getLoggedInUserId: sinon.stub().returns(this.user._id),
      setInSessionUser: sinon.stub()
    }
    this.UserUpdater = {
      addEmailAddress: sinon.stub(),
      removeEmailAddress: sinon.stub(),
      setDefaultEmailAddress: sinon.stub(),
      updateV1AndSetDefaultEmailAddress: sinon.stub()
    }
    this.EmailHelper = { parseEmail: sinon.stub() }
    this.endorseAffiliation = sinon.stub().yields()
    return (this.UserEmailsController = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../Authentication/AuthenticationController': this
          .AuthenticationController,
        './UserGetter': this.UserGetter,
        './UserUpdater': this.UserUpdater,
        '../Helpers/EmailHelper': this.EmailHelper,
        './UserEmailsConfirmationHandler': (this.UserEmailsConfirmationHandler = {}),
        '../Institutions/InstitutionsAPI': {
          endorseAffiliation: this.endorseAffiliation
        },
        '../Errors/Errors': Errors,
        'logger-sharelatex': {
          log() {
            return console.log(arguments)
          },
          err() {}
        }
      }
    }))
  })

  describe('List', function() {
    beforeEach(function() {})

    it('lists emails', function(done) {
      const fullEmails = [{ some: 'data' }]
      this.UserGetter.getUserFullEmails.callsArgWith(1, null, fullEmails)

      return this.UserEmailsController.list(this.req, {
        json: response => {
          assert.deepEqual(response, fullEmails)
          assertCalledWith(this.UserGetter.getUserFullEmails, this.user._id)
          return done()
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
      return this.UserUpdater.addEmailAddress.callsArgWith(3, null)
    })

    it('adds new email', function(done) {
      return this.UserEmailsController.add(this.req, {
        sendStatus: code => {
          code.should.equal(204)
          assertCalledWith(this.EmailHelper.parseEmail, this.newEmail)
          assertCalledWith(
            this.UserUpdater.addEmailAddress,
            this.user._id,
            this.newEmail
          )

          const affiliationOptions = this.UserUpdater.addEmailAddress.lastCall
            .args[2]
          Object.keys(affiliationOptions).length.should.equal(3)
          affiliationOptions.university.should.equal(this.req.body.university)
          affiliationOptions.department.should.equal(this.req.body.department)
          affiliationOptions.role.should.equal(this.req.body.role)

          return done()
        }
      })
    })

    it('sends an email confirmation', function(done) {
      return this.UserEmailsController.add(this.req, {
        sendStatus: code => {
          code.should.equal(204)
          assertCalledWith(
            this.UserEmailsConfirmationHandler.sendConfirmationEmail,
            this.user._id,
            this.newEmail
          )
          return done()
        }
      })
    })

    it('handles email parse error', function(done) {
      this.EmailHelper.parseEmail.returns(null)
      return this.UserEmailsController.add(this.req, {
        sendStatus: code => {
          code.should.equal(422)
          assertNotCalled(this.UserUpdater.addEmailAddress)
          return done()
        }
      })
    })
  })

  describe('remove', function() {
    beforeEach(function() {
      this.email = 'email_to_remove@bar.com'
      this.req.body.email = this.email
      return this.EmailHelper.parseEmail.returns(this.email)
    })

    it('removes email', function(done) {
      this.UserUpdater.removeEmailAddress.callsArgWith(2, null)

      return this.UserEmailsController.remove(this.req, {
        sendStatus: code => {
          code.should.equal(200)
          assertCalledWith(this.EmailHelper.parseEmail, this.email)
          assertCalledWith(
            this.UserUpdater.removeEmailAddress,
            this.user._id,
            this.email
          )
          return done()
        }
      })
    })

    it('handles email parse error', function(done) {
      this.EmailHelper.parseEmail.returns(null)

      return this.UserEmailsController.remove(this.req, {
        sendStatus: code => {
          code.should.equal(422)
          assertNotCalled(this.UserUpdater.removeEmailAddress)
          return done()
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
          return done()
        }
      })
    })
  })

  describe('endorse', function() {
    beforeEach(function() {
      this.email = 'email_to_endorse@bar.com'
      this.req.body.email = this.email
      return this.EmailHelper.parseEmail.returns(this.email)
    })

    it('endorses affiliation', function(done) {
      this.req.body.role = 'Role'
      this.req.body.department = 'Department'

      return this.UserEmailsController.endorse(this.req, {
        sendStatus: code => {
          code.should.equal(204)
          assertCalledWith(
            this.endorseAffiliation,
            this.user._id,
            this.email,
            'Role',
            'Department'
          )
          return done()
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
      return (this.req.body = { token: this.token })
    })

    describe('successfully', function() {
      beforeEach(function() {
        return this.UserEmailsController.confirm(this.req, this.res, this.next)
      })

      it('should confirm the email from the token', function() {
        return this.UserEmailsConfirmationHandler.confirmEmailFromToken
          .calledWith(this.token)
          .should.equal(true)
      })

      it('should return a 200 status', function() {
        return this.res.sendStatus.calledWith(200).should.equal(true)
      })
    })

    describe('without a token', function() {
      beforeEach(function() {
        this.req.body.token = null
        return this.UserEmailsController.confirm(this.req, this.res, this.next)
      })

      it('should return a 422 status', function() {
        return this.res.sendStatus.calledWith(422).should.equal(true)
      })
    })

    describe('when confirming fails', function() {
      beforeEach(function() {
        this.UserEmailsConfirmationHandler.confirmEmailFromToken = sinon
          .stub()
          .yields(new Errors.NotFoundError('not found'))
        return this.UserEmailsController.confirm(this.req, this.res, this.next)
      })

      it('should return a 404 error code with a message', function() {
        this.res.status.calledWith(404).should.equal(true)
        return this.res.json
          .calledWith({
            message:
              'Sorry, your confirmation token is invalid or has expired. Please request a new email confirmation link.'
          })
          .should.equal(true)
      })
    })
  })
})
