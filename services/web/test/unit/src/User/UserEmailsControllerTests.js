const sinon = require('sinon')
const assertCalledWith = sinon.assert.calledWith
const assertNotCalled = sinon.assert.notCalled
const { assert, expect } = require('chai')
const modulePath = '../../../../app/src/Features/User/UserEmailsController.js'
const SandboxedModule = require('sandboxed-module')
const MockRequest = require('../helpers/MockRequest')
const MockResponse = require('../helpers/MockResponse')
const Errors = require('../../../../app/src/Features/Errors/Errors')

describe('UserEmailsController', function () {
  beforeEach(function () {
    this.req = new MockRequest()
    this.req.sessionID = Math.random().toString()
    this.res = new MockResponse()
    this.next = sinon.stub()
    this.user = {
      _id: 'mock-user-id',
      email: 'example@overleaf.com',
      emails: [],
    }

    this.UserGetter = {
      getUser: sinon.stub().yields(),
      getUserFullEmails: sinon.stub(),
      promises: {
        ensureUniqueEmailAddress: sinon.stub().resolves(),
        getUser: sinon.stub().resolves(this.user),
        getUserByAnyEmail: sinon.stub(),
      },
    }
    this.SessionManager = {
      getSessionUser: sinon.stub().returns(this.user),
      getLoggedInUserId: sinon.stub().returns(this.user._id),
      setInSessionUser: sinon.stub(),
    }
    this.Features = {
      hasFeature: sinon.stub(),
    }
    this.UserSessionsManager = {
      promises: { removeSessionsFromRedis: sinon.stub().resolves() },
    }
    this.UserUpdater = {
      addEmailAddress: sinon.stub(),
      updateV1AndSetDefaultEmailAddress: sinon.stub(),
      promises: {
        addEmailAddress: sinon.stub().resolves(),
        confirmEmail: sinon.stub().resolves(),
        removeEmailAddress: sinon.stub(),
        setDefaultEmailAddress: sinon.stub().resolves(),
      },
    }
    this.EmailHelper = { parseEmail: sinon.stub() }
    this.endorseAffiliation = sinon.stub().yields()
    this.InstitutionsAPI = {
      endorseAffiliation: this.endorseAffiliation,
    }
    this.HttpErrorHandler = { conflict: sinon.stub() }
    this.AnalyticsManager = {
      recordEventForUserInBackground: sinon.stub(),
    }
    this.UserAuditLogHandler = {
      addEntry: sinon.stub().yields(),
      promises: {
        addEntry: sinon.stub().resolves(),
      },
    }
    this.rateLimiter = {
      consume: sinon.stub().resolves(),
    }
    this.RateLimiter = {
      RateLimiter: sinon.stub().returns(this.rateLimiter),
    }
    this.AuthenticationController = {
      getRedirectFromSession: sinon.stub().returns(null),
    }
    this.UserEmailsController = SandboxedModule.require(modulePath, {
      requires: {
        '../Authentication/AuthenticationController':
          this.AuthenticationController,
        '../Authentication/SessionManager': this.SessionManager,
        '../../infrastructure/Features': this.Features,
        './UserSessionsManager': this.UserSessionsManager,
        './UserGetter': this.UserGetter,
        './UserUpdater': this.UserUpdater,
        '../Email/EmailHandler': (this.EmailHandler = {
          promises: {
            sendEmail: sinon.stub().resolves(),
          },
        }),
        '../Helpers/EmailHelper': this.EmailHelper,
        './UserEmailsConfirmationHandler': (this.UserEmailsConfirmationHandler =
          {
            promises: {
              sendConfirmationEmail: sinon.stub().resolves(),
              sendReconfirmationEmail: sinon.stub(),
            },
          }),
        '../Institutions/InstitutionsAPI': this.InstitutionsAPI,
        '../Errors/HttpErrorHandler': this.HttpErrorHandler,
        '../Analytics/AnalyticsManager': this.AnalyticsManager,
        './UserAuditLogHandler': this.UserAuditLogHandler,
        '../../infrastructure/RateLimiter': this.RateLimiter,
        '../SplitTests/SplitTestHandler': {
          promises: {
            getAssignment: sinon.stub().resolves('default'),
          },
        },
      },
    })
  })

  describe('List', function () {
    beforeEach(function () {})

    it('lists emails', function (done) {
      const fullEmails = [{ some: 'data' }]
      this.UserGetter.getUserFullEmails.callsArgWith(1, null, fullEmails)

      this.UserEmailsController.list(this.req, {
        json: response => {
          assert.deepEqual(response, fullEmails)
          assertCalledWith(this.UserGetter.getUserFullEmails, this.user._id)
          done()
        },
      })
    })
  })

  describe('Add', function () {
    beforeEach(function () {
      this.newEmail = 'new_email@baz.com'
      this.req.body = {
        email: this.newEmail,
        university: { name: 'University Name' },
        department: 'Department',
        role: 'Role',
      }
      this.EmailHelper.parseEmail.returns(this.newEmail)
      this.UserEmailsConfirmationHandler.sendConfirmationEmail = sinon
        .stub()
        .yields()
    })

    it('passed audit log to addEmailAddress', function (done) {
      this.res.sendStatus = sinon.stub()
      this.res.sendStatus.callsFake(() => {
        const addCall = this.UserUpdater.promises.addEmailAddress.lastCall
        expect(addCall.args[3]).to.deep.equal({
          initiatorId: this.user._id,
          ipAddress: this.req.ip,
        })
        done()
      })
      this.UserEmailsController.add(this.req, this.res)
    })

    it('adds new email', function (done) {
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

            const affiliationOptions =
              this.UserUpdater.promises.addEmailAddress.lastCall.args[2]
            Object.keys(affiliationOptions).length.should.equal(3)
            affiliationOptions.university.should.equal(this.req.body.university)
            affiliationOptions.department.should.equal(this.req.body.department)
            affiliationOptions.role.should.equal(this.req.body.role)

            done()
          },
        },
        this.next
      )
    })

    it('sends a security alert email', function (done) {
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

    it('sends an email confirmation', function (done) {
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
          },
        },
        this.next
      )
    })

    it('handles email parse error', function (done) {
      this.EmailHelper.parseEmail.returns(null)
      this.UserEmailsController.add(
        this.req,
        {
          sendStatus: code => {
            code.should.equal(422)
            assertNotCalled(this.UserUpdater.promises.addEmailAddress)
            done()
          },
        },
        this.next
      )
    })

    it('should pass the error to the next handler when adding the email fails', function (done) {
      this.UserUpdater.promises.addEmailAddress.rejects(new Error())
      this.UserEmailsController.add(this.req, this.res, error => {
        expect(error).to.be.instanceof(Error)
        done()
      })
    })

    it('should call the HTTP conflict handler when the email already exists', function (done) {
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

    it("should call the HTTP conflict handler when there's a domain matching error", function (done) {
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

    it('should fail to add new emails when the limit has been reached', function (done) {
      this.user.emails = []
      for (let i = 0; i < 10; i++) {
        this.user.emails.push({ email: `example${i}@overleaf.com` })
      }
      this.UserEmailsController.add(
        this.req,
        {
          status: code => {
            expect(code).to.equal(422)
            return {
              json: error => {
                expect(error.message).to.equal('secondary email limit exceeded')
                done()
              },
            }
          },
        },
        this.next
      )
    })
  })

  describe('addWithConfirmationCode', function () {
    beforeEach(function () {
      this.newEmail = 'new_email@baz.com'
      this.req.body = {
        email: this.newEmail,
      }
      this.EmailHelper.parseEmail.returns(this.newEmail)
      this.UserEmailsConfirmationHandler.promises.sendConfirmationCode = sinon
        .stub()
        .resolves({
          confirmCode: '123456',
          confirmCodeExpiresTimestamp: new Date(),
        })
    })

    it('sends an email confirmation', function (done) {
      this.UserEmailsController.addWithConfirmationCode(this.req, {
        sendStatus: code => {
          code.should.equal(200)
          assertCalledWith(
            this.UserEmailsConfirmationHandler.promises.sendConfirmationCode,
            this.newEmail,
            true
          )
          done()
        },
      })
    })

    it('handles email parse error', function (done) {
      this.EmailHelper.parseEmail.returns(null)
      this.UserEmailsController.addWithConfirmationCode(this.req, {
        sendStatus: code => {
          code.should.equal(422)
          done()
        },
      })
    })

    it('handles when the email already exists', function (done) {
      this.UserGetter.promises.ensureUniqueEmailAddress.rejects(
        new Errors.EmailExistsError()
      )

      this.UserEmailsController.addWithConfirmationCode(this.req, {
        status: code => {
          code.should.equal(409)
          return { json: () => done() }
        },
      })
    })

    it('should fail to add new emails when the limit has been reached', function (done) {
      this.user.emails = []
      for (let i = 0; i < 10; i++) {
        this.user.emails.push({ email: `example${i}@overleaf.com` })
      }
      this.UserEmailsController.addWithConfirmationCode(this.req, {
        status: code => {
          expect(code).to.equal(422)
          return {
            json: error => {
              expect(error.message).to.equal('secondary email limit exceeded')
              done()
            },
          }
        },
      })
    })
  })

  describe('checkSecondaryEmailConfirmationCode', function () {
    beforeEach(function () {
      this.newEmail = 'new_email@baz.com'
      this.req.session.pendingSecondaryEmail = {
        confirmCode: '123456',
        email: this.newEmail,
        confirmCodeExpiresTimestamp: new Date(Math.max),
      }
    })

    describe('with a valid confirmation code', function () {
      beforeEach(function () {
        this.req.body = {
          code: '123456',
        }
      })

      it('adds the email', function (done) {
        this.UserEmailsController.checkSecondaryEmailConfirmationCode(
          this.req,
          {
            json: () => {
              assertCalledWith(
                this.UserUpdater.promises.addEmailAddress,
                this.user._id,
                this.newEmail
              )
              assertCalledWith(
                this.UserUpdater.promises.confirmEmail,
                this.user._id,
                this.newEmail
              )
              done()
            },
          }
        )
      })

      it('redirects to /project', function (done) {
        this.UserEmailsController.checkSecondaryEmailConfirmationCode(
          this.req,
          {
            json: ({ redir }) => {
              redir.should.equal('/project')
              done()
            },
          }
        )
      })

      it('sends a security alert email', async function () {
        this.req.session.pendingSecondaryEmail = {
          confirmCode: '123456',
          email: this.newEmail,
          confirmCodeExpiresTimestamp: new Date(Math.max),
          affiliationOptions: {},
        }
        this.req.body.code = '123456'

        await this.UserEmailsController.checkSecondaryEmailConfirmationCode(
          this.req,
          {
            json: sinon.stub().resolves(),
          }
        )

        const emailCall = this.EmailHandler.promises.sendEmail.getCall(0)
        expect(emailCall.args[0]).to.equal('securityAlert')
        expect(emailCall.args[1].to).to.equal(this.user.email)
        expect(emailCall.args[1].actionDescribed).to.contain(
          'a secondary email address'
        )
        expect(emailCall.args[1].message[0]).to.contain(this.newEmail)
      })
    })

    describe('with an invalid confirmation code', function () {
      beforeEach(function () {
        this.req.body = {
          code: '999999',
        }
      })

      it('does not add the email', function (done) {
        this.UserEmailsController.checkSecondaryEmailConfirmationCode(
          this.req,
          {
            status: () => {
              assertNotCalled(this.UserUpdater.promises.addEmailAddress)
              assertNotCalled(this.UserUpdater.promises.confirmEmail)
              done()
              return { json: this.next }
            },
          }
        )
      })

      it('responds with a 403', function (done) {
        this.UserEmailsController.checkSecondaryEmailConfirmationCode(
          this.req,
          {
            status: code => {
              code.should.equal(403)
              done()
              return { json: this.next }
            },
          }
        )
      })
    })
  })

  describe('resendSecondaryEmailConfirmationCode', function () {
    beforeEach(function () {
      this.newEmail = 'new_email@baz.com'
      this.req.session.pendingSecondaryEmail = {
        confirmCode: '123456',
        email: this.newEmail,
        confirmCodeExpiresTimestamp: new Date(Math.max),
      }
      this.UserEmailsConfirmationHandler.promises.sendConfirmationCode = sinon
        .stub()
        .resolves({
          confirmCode: '123456',
          confirmCodeExpiresTimestamp: new Date(),
        })
    })

    it('should send the email', function (done) {
      this.UserEmailsController.resendSecondaryEmailConfirmationCode(this.req, {
        status: code => {
          code.should.equal(200)
          assertCalledWith(
            this.UserEmailsConfirmationHandler.promises.sendConfirmationCode,
            this.newEmail,
            true
          )
          done()
          return { json: this.next }
        },
      })
    })
  })

  describe('remove', function () {
    beforeEach(function () {
      this.email = 'email_to_remove@bar.com'
      this.req.body.email = this.email
      this.EmailHelper.parseEmail.returns(this.email)
    })

    it('removes email', function (done) {
      const auditLog = {
        initiatorId: this.user._id,
        ipAddress: this.req.ip,
      }
      this.UserUpdater.promises.removeEmailAddress.resolves()

      this.UserEmailsController.remove(this.req, {
        sendStatus: code => {
          code.should.equal(200)
          assertCalledWith(this.EmailHelper.parseEmail, this.email)
          assertCalledWith(
            this.UserUpdater.promises.removeEmailAddress,
            this.user._id,
            this.email,
            auditLog
          )
          done()
        },
      })
    })

    it('handles email parse error', function (done) {
      this.EmailHelper.parseEmail.returns(null)

      this.UserEmailsController.remove(this.req, {
        sendStatus: code => {
          code.should.equal(422)
          assertNotCalled(this.UserUpdater.promises.removeEmailAddress)
          done()
        },
      })
    })
  })

  describe('setDefault', function () {
    beforeEach(function () {
      this.email = 'email_to_set_default@bar.com'
      this.req.body.email = this.email
      this.EmailHelper.parseEmail.returns(this.email)
      this.SessionManager.setInSessionUser.returns(null)
    })

    it('sets default email', function (done) {
      this.UserEmailsController.setDefault(this.req, {
        sendStatus: code => {
          code.should.equal(200)
          assertCalledWith(this.EmailHelper.parseEmail, this.email)
          assertCalledWith(
            this.SessionManager.setInSessionUser,
            this.req.session,
            {
              email: this.email,
            }
          )
          assertCalledWith(
            this.UserUpdater.promises.setDefaultEmailAddress,
            this.user._id,
            this.email
          )
          done()
        },
      })
    })

    it('deletes unconfirmed primary if delete-unconfirmed-primary is set', function (done) {
      this.user.emails = [{ email: 'example@overleaf.com' }]
      this.req.query['delete-unconfirmed-primary'] = ''

      this.UserEmailsController.setDefault(this.req, {
        sendStatus: () => {
          assertCalledWith(
            this.UserUpdater.promises.removeEmailAddress,
            this.user._id,
            'example@overleaf.com',
            {
              initiatorId: this.user._id,
              ipAddress: this.req.ip,
              extraInfo: {
                info: 'removed unconfirmed email after setting new primary',
              },
            }
          )
          done()
        },
      })
    })

    it('doesnt delete a confirmed primary', function (done) {
      this.user.emails = [
        { email: 'example@overleaf.com', confirmedAt: '2000-01-01' },
      ]
      this.req.query['delete-unconfirmed-primary'] = ''

      this.UserEmailsController.setDefault(this.req, {
        sendStatus: () => {
          assertNotCalled(this.UserUpdater.promises.removeEmailAddress)
          done()
        },
      })
    })

    it('doesnt delete primary if delete-unconfirmed-primary is not set', function (done) {
      this.UserEmailsController.setDefault(this.req, {
        sendStatus: () => {
          assertNotCalled(this.UserUpdater.promises.removeEmailAddress)
          done()
        },
      })
    })

    it('handles email parse error', function (done) {
      this.EmailHelper.parseEmail.returns(null)

      this.UserEmailsController.setDefault(this.req, {
        sendStatus: code => {
          code.should.equal(422)
          assertNotCalled(this.UserUpdater.promises.setDefaultEmailAddress)
          done()
        },
      })
    })

    it('should reset the users other sessions', function (done) {
      this.res.callback = () => {
        expect(
          this.UserSessionsManager.promises.removeSessionsFromRedis
        ).to.have.been.calledWith(this.user, this.req.sessionID)
        done()
      }

      this.UserEmailsController.setDefault(this.req, this.res, done)
    })

    it('handles error from revoking sessions and returns 200', function (done) {
      const redisError = new Error('redis error')
      this.UserSessionsManager.promises.removeSessionsFromRedis = sinon
        .stub()
        .rejects(redisError)

      this.res.callback = () => {
        expect(this.res.statusCode).to.equal(200)

        // give revoke process time to run
        setTimeout(() => {
          expect(this.logger.warn).to.have.been.calledWith(
            sinon.match({ err: redisError }),
            'failed revoking secondary sessions after changing default email'
          )
          done()
        })
      }

      this.UserEmailsController.setDefault(this.req, this.res, done)
    })
  })

  describe('endorse', function () {
    beforeEach(function () {
      this.email = 'email_to_endorse@bar.com'
      this.req.body.email = this.email
      this.EmailHelper.parseEmail.returns(this.email)
    })

    it('endorses affiliation', function (done) {
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
        },
      })
    })
  })

  describe('confirm', function () {
    beforeEach(function () {
      this.UserEmailsConfirmationHandler.confirmEmailFromToken = sinon
        .stub()
        .yields(null, { userId: this.user._id, email: this.user.email })
      this.res = {
        sendStatus: sinon.stub(),
        json: sinon.stub(),
      }
      this.res.status = sinon.stub().returns(this.res)
      this.next = sinon.stub()
      this.token = 'mock-token'
      this.req.body = { token: this.token }
      this.req.ip = '0.0.0.0'
    })

    describe('successfully', function () {
      beforeEach(function () {
        this.UserEmailsController.confirm(this.req, this.res, this.next)
      })

      it('should confirm the email from the token', function () {
        this.UserEmailsConfirmationHandler.confirmEmailFromToken
          .calledWith(this.req, this.token)
          .should.equal(true)
      })

      it('should return a 200 status', function () {
        this.res.sendStatus.calledWith(200).should.equal(true)
      })

      it('should log the confirmation to the audit log', function () {
        sinon.assert.calledWith(
          this.UserAuditLogHandler.addEntry,
          this.user._id,
          'confirm-email',
          this.user._id,
          this.req.ip,
          {
            token: this.token.substring(0, 10),
            email: this.user.email,
          }
        )
      })
    })

    describe('without a token', function () {
      beforeEach(function () {
        this.req.body.token = null
        this.UserEmailsController.confirm(this.req, this.res, this.next)
      })

      it('should return a 422 status', function () {
        this.res.status.calledWith(422).should.equal(true)
      })
    })

    describe('when confirming fails', function () {
      beforeEach(function () {
        this.UserEmailsConfirmationHandler.confirmEmailFromToken = sinon
          .stub()
          .yields(new Errors.NotFoundError('not found'))
        this.UserEmailsController.confirm(this.req, this.res, this.next)
      })

      it('should return a 404 error code with a message', function () {
        this.res.status.calledWith(404).should.equal(true)
        this.res.json
          .calledWith({
            message: this.req.i18n.translate('confirmation_token_invalid'),
          })
          .should.equal(true)
      })
    })
  })

  describe('resendConfirmation', function () {
    beforeEach(function () {
      this.EmailHelper.parseEmail.returnsArg(0)
      this.UserGetter.promises.getUserByAnyEmail.resolves({
        _id: this.user._id,
      })
      this.req = {
        body: {},
      }
      this.res = {
        sendStatus: sinon.stub(),
      }
      this.next = sinon.stub()
      this.UserEmailsConfirmationHandler.sendConfirmationEmail = sinon
        .stub()
        .yields()
    })

    it('should send the email', async function () {
      this.req = {
        body: {
          email: 'test@example.com',
        },
      }
      await this.UserEmailsController.sendReconfirmation(
        this.req,
        this.res,
        this.next
      )
      expect(
        this.UserEmailsConfirmationHandler.promises.sendReconfirmationEmail
      ).to.have.been.calledOnce
    })

    it('should return 422 if email not valid', function (done) {
      this.req = {
        body: {},
      }
      this.UserEmailsController.resendConfirmation(
        this.req,
        this.res,
        this.next
      )
      expect(this.UserEmailsConfirmationHandler.sendConfirmationEmail).to.not
        .have.been.called
      expect(this.res.sendStatus.lastCall.args[0]).to.equal(422)
      done()
    })

    describe('email on another user account', function () {
      beforeEach(function () {
        this.UserGetter.promises.getUserByAnyEmail.resolves({
          _id: 'another-user-id',
        })
      })
      it('should return 422', async function () {
        this.req = {
          body: {
            email: 'test@example.com',
          },
        }
        await this.UserEmailsController.resendConfirmation(
          this.req,
          this.res,
          this.next
        )
        expect(this.UserEmailsConfirmationHandler.sendConfirmationEmail).to.not
          .have.been.called
        expect(this.res.sendStatus.lastCall.args[0]).to.equal(422)
      })
    })
  })

  describe('sendReconfirmation', function () {
    beforeEach(function () {
      this.res.sendStatus = sinon.stub()
      this.UserGetter.promises.getUserByAnyEmail.resolves({
        _id: this.user._id,
      })
      this.EmailHelper.parseEmail.returnsArg(0)
    })
    it('should send the email', async function () {
      this.req = {
        body: {
          email: 'test@example.com',
        },
      }
      await this.UserEmailsController.sendReconfirmation(
        this.req,
        this.res,
        this.next
      )
      expect(
        this.UserEmailsConfirmationHandler.promises.sendReconfirmationEmail
      ).to.have.been.calledOnce
    })
    it('should return 400 if email not valid', function (done) {
      this.req = {
        body: {},
      }
      this.UserEmailsController.sendReconfirmation(
        this.req,
        this.res,
        this.next
      )
      expect(
        this.UserEmailsConfirmationHandler.promises.sendReconfirmationEmail
      ).to.not.have.been.called
      expect(this.res.sendStatus.lastCall.args[0]).to.equal(400)
      done()
    })
    describe('email on another user account', function () {
      beforeEach(function () {
        this.UserGetter.promises.getUserByAnyEmail.resolves({
          _id: 'another-user-id',
        })
      })
      it('should return 422', async function () {
        this.req = {
          body: {
            email: 'test@example.com',
          },
        }
        await this.UserEmailsController.sendReconfirmation(
          this.req,
          this.res,
          this.next
        )
        expect(
          this.UserEmailsConfirmationHandler.promises.sendReconfirmationEmail
        ).to.not.have.been.called
        expect(this.res.sendStatus.lastCall.args[0]).to.equal(422)
      })
    })
  })
})
