import { fileURLToPath } from 'node:url'
import * as path from 'node:path'
import { strict as esmock } from 'esmock'
import { expect } from 'chai'
import sinon from 'sinon'
import Settings from '@overleaf/settings'
import MockResponse from '../../../../../test/unit/src/helpers/MockResponse.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const modulePath = path.join(
  __dirname,
  '../../../app/src/LaunchpadController.mjs'
)

describe('LaunchpadController', function () {
  // esmock doesn't work well with CommonJS dependencies, global imports for
  // @overleaf/settings aren't working until that module is migrated to ESM. In the
  // meantime, the workaroung is to set and restore settings values
  let oldSettingsAdminPrivilegeAvailable

  beforeEach(async function () {
    this.user = {
      _id: '323123',
      first_name: 'fn',
      last_name: 'ln',
      save: sinon.stub().callsArgWith(0),
    }

    oldSettingsAdminPrivilegeAvailable = Settings.adminPrivilegeAvailable
    Settings.adminPrivilegeAvailable = true

    this.User = {}
    this.LaunchpadController = await esmock(modulePath, {
      '@overleaf/metrics': (this.Metrics = {}),
      '../../../../../app/src/Features/User/UserRegistrationHandler.js':
        (this.UserRegistrationHandler = {
          promises: {},
        }),
      '../../../../../app/src/Features/Email/EmailHandler.js':
        (this.EmailHandler = { promises: {} }),
      '../../../../../app/src/Features/User/UserGetter.js': (this.UserGetter = {
        promises: {},
      }),
      '../../../../../app/src/models/User.js': { User: this.User },
      '../../../../../app/src/Features/Authentication/AuthenticationController.js':
        (this.AuthenticationController = {}),
      '../../../../../app/src/Features/Authentication/AuthenticationManager.js':
        (this.AuthenticationManager = {}),
      '../../../../../app/src/Features/Authentication/SessionManager.js':
        (this.SessionManager = {
          getSessionUser: sinon.stub(),
        }),
    })

    this.email = 'bob@smith.com'

    this.req = {
      query: {},
      body: {},
      session: {},
    }

    this.res = new MockResponse()
    this.res.locals = {
      translate(key) {
        return key
      },
    }

    this.next = sinon.stub()
  })

  afterEach(function () {
    Settings.adminPrivilegeAvailable = oldSettingsAdminPrivilegeAvailable
  })

  describe('launchpadPage', function () {
    beforeEach(function () {
      this.LaunchpadController._mocks._atLeastOneAdminExists = sinon.stub()
      this._atLeastOneAdminExists =
        this.LaunchpadController._mocks._atLeastOneAdminExists
      this.AuthenticationController.setRedirectInSession = sinon.stub()
    })

    describe('when the user is not logged in', function () {
      beforeEach(function () {
        this.SessionManager.getSessionUser = sinon.stub().returns(null)
      })

      describe('when there are no admins', function () {
        beforeEach(async function () {
          this._atLeastOneAdminExists.resolves(false)
          await this.LaunchpadController.launchpadPage(
            this.req,
            this.res,
            this.next
          )
        })

        it('should render the launchpad page', function () {
          const viewPath = path.join(__dirname, '../../../app/views/launchpad')
          this.res.render.callCount.should.equal(1)
          this.res.render
            .calledWith(viewPath, {
              adminUserExists: false,
              authMethod: 'local',
            })
            .should.equal(true)
        })
      })

      describe('when there is at least one admin', function () {
        beforeEach(async function () {
          this._atLeastOneAdminExists.resolves(true)
          await this.LaunchpadController.launchpadPage(
            this.req,
            this.res,
            this.next
          )
        })

        it('should redirect to login page', function () {
          this.AuthenticationController.setRedirectInSession.callCount.should.equal(
            1
          )
          this.res.redirect.calledWith('/login').should.equal(true)
        })

        it('should not render the launchpad page', function () {
          this.res.render.callCount.should.equal(0)
        })
      })
    })

    describe('when the user is logged in', function () {
      beforeEach(function () {
        this.user = {
          _id: 'abcd',
          email: 'abcd@example.com',
        }
        this.SessionManager.getSessionUser.returns(this.user)
        this._atLeastOneAdminExists.resolves(true)
      })

      describe('when the user is an admin', function () {
        beforeEach(async function () {
          this.UserGetter.promises.getUser = sinon
            .stub()
            .resolves({ isAdmin: true })
          await this.LaunchpadController.launchpadPage(
            this.req,
            this.res,
            this.next
          )
        })

        it('should render the launchpad page', function () {
          const viewPath = path.join(__dirname, '../../../app/views/launchpad')
          this.res.render.callCount.should.equal(1)
          this.res.render
            .calledWith(viewPath, {
              wsUrl: undefined,
              adminUserExists: true,
              authMethod: 'local',
            })
            .should.equal(true)
        })
      })

      describe('when the user is not an admin', function () {
        beforeEach(async function () {
          this.UserGetter.promises.getUser = sinon
            .stub()
            .resolves({ isAdmin: false })
          await this.LaunchpadController.launchpadPage(
            this.req,
            this.res,
            this.next
          )
        })

        it('should redirect to restricted page', function () {
          this.res.redirect.callCount.should.equal(1)
          this.res.redirect.calledWith('/restricted').should.equal(true)
        })
      })
    })
  })

  describe('_atLeastOneAdminExists', function () {
    describe('when there are no admins', function () {
      beforeEach(function () {
        this.UserGetter.promises.getUser = sinon.stub().resolves(null)
      })

      it('should callback with false', async function () {
        const exists = await this.LaunchpadController._atLeastOneAdminExists()
        expect(exists).to.equal(false)
      })
    })

    describe('when there are some admins', function () {
      beforeEach(function () {
        this.UserGetter.promises.getUser = sinon
          .stub()
          .resolves({ _id: 'abcd' })
      })

      it('should callback with true', async function () {
        const exists = await this.LaunchpadController._atLeastOneAdminExists()
        expect(exists).to.equal(true)
      })
    })

    describe('when getUser produces an error', function () {
      beforeEach(function () {
        this.UserGetter.promises.getUser = sinon
          .stub()
          .rejects(new Error('woops'))
      })

      it('should produce an error', async function () {
        await expect(this.LaunchpadController._atLeastOneAdminExists()).rejected
      })
    })
  })

  describe('sendTestEmail', function () {
    beforeEach(function () {
      this.EmailHandler.promises.sendEmail = sinon.stub().resolves()
      this.req.body.email = 'someone@example.com'
    })

    it('should produce a 200 response', async function () {
      await this.LaunchpadController.sendTestEmail(
        this.req,
        this.res,
        this.next
      )
      this.res.json.calledWith({ message: 'email_sent' }).should.equal(true)
    })

    it('should not call next with an error', function () {
      this.LaunchpadController.sendTestEmail(this.req, this.res, this.next)
      this.next.callCount.should.equal(0)
    })

    it('should have called sendEmail', async function () {
      await this.LaunchpadController.sendTestEmail(
        this.req,
        this.res,
        this.next
      )
      this.EmailHandler.promises.sendEmail.callCount.should.equal(1)
      this.EmailHandler.promises.sendEmail
        .calledWith('testEmail')
        .should.equal(true)
    })

    describe('when sendEmail produces an error', function () {
      beforeEach(function () {
        this.EmailHandler.promises.sendEmail = sinon
          .stub()
          .rejects(new Error('woops'))
      })

      it('should call next with an error', function (done) {
        this.next = sinon.stub().callsFake(err => {
          expect(err).to.be.instanceof(Error)
          this.next.callCount.should.equal(1)
          done()
        })
        this.LaunchpadController.sendTestEmail(this.req, this.res, this.next)
      })
    })

    describe('when no email address is supplied', function () {
      beforeEach(function () {
        this.req.body.email = undefined
      })

      it('should produce a 400 response', function () {
        this.LaunchpadController.sendTestEmail(this.req, this.res, this.next)
        this.res.status.calledWith(400).should.equal(true)
        this.res.json
          .calledWith({
            message: 'no email address supplied',
          })
          .should.equal(true)
      })
    })
  })

  describe('registerAdmin', function () {
    beforeEach(function () {
      this.LaunchpadController._mocks._atLeastOneAdminExists = sinon.stub()
      this._atLeastOneAdminExists =
        this.LaunchpadController._mocks._atLeastOneAdminExists
    })

    describe('when all goes well', function () {
      beforeEach(async function () {
        this._atLeastOneAdminExists.resolves(false)
        this.email = 'someone@example.com'
        this.password = 'a_really_bad_password'
        this.req.body.email = this.email
        this.req.body.password = this.password
        this.user = {
          _id: 'abcdef',
          email: this.email,
        }
        this.UserRegistrationHandler.promises.registerNewUser = sinon
          .stub()
          .resolves(this.user)
        this.User.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves() })
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        this.AuthenticationManager.validateEmail = sinon.stub().returns(null)
        this.AuthenticationManager.validatePassword = sinon.stub().returns(null)
        await this.LaunchpadController.registerAdmin(
          this.req,
          this.res,
          this.next
        )
      })

      it('should send back a json response', function () {
        this.res.json.callCount.should.equal(1)
        expect(this.res.json).to.have.been.calledWith({ redir: '/launchpad' })
      })

      it('should have checked for existing admins', function () {
        this._atLeastOneAdminExists.callCount.should.equal(1)
      })

      it('should have called registerNewUser', function () {
        this.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          1
        )
        this.UserRegistrationHandler.promises.registerNewUser
          .calledWith({ email: this.email, password: this.password })
          .should.equal(true)
      })

      it('should have updated the user to make them an admin', function () {
        this.User.updateOne.callCount.should.equal(1)
        this.User.updateOne
          .calledWithMatch(
            { _id: this.user._id },
            {
              $set: {
                isAdmin: true,
                emails: [
                  { email: this.user.email, reversedHostname: 'moc.elpmaxe' },
                ],
              },
            }
          )
          .should.equal(true)
      })
    })

    describe('when no email is supplied', function () {
      beforeEach(async function () {
        this._atLeastOneAdminExists.resolves(false)
        this.email = undefined
        this.password = 'a_really_bad_password'
        this.req.body.email = this.email
        this.req.body.password = this.password
        this.user = {
          _id: 'abcdef',
          email: this.email,
        }
        this.UserRegistrationHandler.promises.registerNewUser = sinon.stub()
        this.User.updateOne = sinon.stub().returns({ exec: sinon.stub() })
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        await this.LaunchpadController.registerAdmin(
          this.req,
          this.res,
          this.next
        )
      })

      it('should send a 400 response', function () {
        this.res.sendStatus.callCount.should.equal(1)
        this.res.sendStatus.calledWith(400).should.equal(true)
      })

      it('should not check for existing admins', function () {
        this._atLeastOneAdminExists.callCount.should.equal(0)
      })

      it('should not call registerNewUser', function () {
        this.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          0
        )
      })
    })

    describe('when no password is supplied', function () {
      beforeEach(async function () {
        this._atLeastOneAdminExists.resolves(false)
        this.email = 'someone@example.com'
        this.password = undefined
        this.req.body.email = this.email
        this.req.body.password = this.password
        this.user = {
          _id: 'abcdef',
          email: this.email,
        }
        this.UserRegistrationHandler.promises.registerNewUser = sinon.stub()
        this.User.updateOne = sinon.stub().returns({ exec: sinon.stub() })
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        await this.LaunchpadController.registerAdmin(
          this.req,
          this.res,
          this.next
        )
      })

      it('should send a 400 response', function () {
        this.res.sendStatus.callCount.should.equal(1)
        this.res.sendStatus.calledWith(400).should.equal(true)
      })

      it('should not check for existing admins', function () {
        this._atLeastOneAdminExists.callCount.should.equal(0)
      })

      it('should not call registerNewUser', function () {
        this.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          0
        )
      })
    })

    describe('when an invalid email is supplied', function () {
      beforeEach(async function () {
        this._atLeastOneAdminExists.resolves(false)
        this.email = 'someone@example.com'
        this.password = 'invalid password'
        this.req.body.email = this.email
        this.req.body.password = this.password
        this.user = {
          _id: 'abcdef',
          email: this.email,
        }
        this.UserRegistrationHandler.promises.registerNewUser = sinon.stub()
        this.User.updateOne = sinon.stub().returns({ exec: sinon.stub() })
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        this.AuthenticationManager.validateEmail = sinon
          .stub()
          .returns(new Error('bad email'))
        this.AuthenticationManager.validatePassword = sinon.stub().returns(null)
        await this.LaunchpadController.registerAdmin(
          this.req,
          this.res,
          this.next
        )
      })

      it('should send a 400 response', function () {
        this.res.status.callCount.should.equal(1)
        this.res.status.calledWith(400).should.equal(true)
        this.res.json.calledWith({
          message: { type: 'error', text: 'bad email' },
        })
      })

      it('should not call registerNewUser', function () {
        this.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          0
        )
      })
    })

    describe('when an invalid password is supplied', function () {
      beforeEach(async function () {
        this._atLeastOneAdminExists.resolves(false)
        this.email = 'someone@example.com'
        this.password = 'invalid password'
        this.req.body.email = this.email
        this.req.body.password = this.password
        this.user = {
          _id: 'abcdef',
          email: this.email,
        }
        this.UserRegistrationHandler.promises.registerNewUser = sinon.stub()
        this.User.updateOne = sinon.stub().returns({ exec: sinon.stub() })
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        this.AuthenticationManager.validateEmail = sinon.stub().returns(null)
        this.AuthenticationManager.validatePassword = sinon
          .stub()
          .returns(new Error('bad password'))
        await this.LaunchpadController.registerAdmin(
          this.req,
          this.res,
          this.next
        )
      })

      it('should send a 400 response', function () {
        this.res.status.callCount.should.equal(1)
        this.res.status.calledWith(400).should.equal(true)
        this.res.json.calledWith({
          message: { type: 'error', text: 'bad password' },
        })
      })

      it('should not call registerNewUser', function () {
        this.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          0
        )
      })
    })

    describe('when there are already existing admins', function () {
      beforeEach(async function () {
        this._atLeastOneAdminExists.resolves(true)
        this.email = 'someone@example.com'
        this.password = 'a_really_bad_password'
        this.req.body.email = this.email
        this.req.body.password = this.password
        this.user = {
          _id: 'abcdef',
          email: this.email,
        }
        this.UserRegistrationHandler.promises.registerNewUser = sinon.stub()
        this.User.updateOne = sinon.stub().returns({ exec: sinon.stub() })
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        this.AuthenticationManager.validateEmail = sinon.stub().returns(null)
        this.AuthenticationManager.validatePassword = sinon.stub().returns(null)
        await this.LaunchpadController.registerAdmin(
          this.req,
          this.res,
          this.next
        )
      })

      it('should send a 403 response', function () {
        this.res.status.callCount.should.equal(1)
        this.res.status.calledWith(403).should.equal(true)
      })

      it('should not call registerNewUser', function () {
        this.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          0
        )
      })
    })

    describe('when checking admins produces an error', function () {
      beforeEach(async function () {
        this._atLeastOneAdminExists.rejects(new Error('woops'))
        this.email = 'someone@example.com'
        this.password = 'a_really_bad_password'
        this.req.body.email = this.email
        this.req.body.password = this.password
        this.user = {
          _id: 'abcdef',
          email: this.email,
        }
        this.UserRegistrationHandler.promises.registerNewUser = sinon.stub()
        this.User.updateOne = sinon.stub().returns({ exec: sinon.stub() })
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        await this.LaunchpadController.registerAdmin(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next with an error', function () {
        this.next.callCount.should.equal(1)
        expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
      })

      it('should have checked for existing admins', function () {
        this._atLeastOneAdminExists.callCount.should.equal(1)
      })

      it('should not call registerNewUser', function () {
        this.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          0
        )
      })
    })

    describe('when registerNewUser produces an error', function () {
      beforeEach(async function () {
        this._atLeastOneAdminExists.resolves(false)
        this.email = 'someone@example.com'
        this.password = 'a_really_bad_password'
        this.req.body.email = this.email
        this.req.body.password = this.password
        this.user = {
          _id: 'abcdef',
          email: this.email,
        }
        this.UserRegistrationHandler.promises.registerNewUser = sinon
          .stub()
          .rejects(new Error('woops'))
        this.User.updateOne = sinon.stub().returns({ exec: sinon.stub() })
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        this.AuthenticationManager.validateEmail = sinon.stub().returns(null)
        this.AuthenticationManager.validatePassword = sinon.stub().returns(null)
        await this.LaunchpadController.registerAdmin(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next with an error', function () {
        this.next.callCount.should.equal(1)
        expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
      })

      it('should have checked for existing admins', function () {
        this._atLeastOneAdminExists.callCount.should.equal(1)
      })

      it('should have called registerNewUser', function () {
        this.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          1
        )
        this.UserRegistrationHandler.promises.registerNewUser
          .calledWith({ email: this.email, password: this.password })
          .should.equal(true)
      })

      it('should not call update', function () {
        this.User.updateOne.callCount.should.equal(0)
      })
    })

    describe('when user update produces an error', function () {
      beforeEach(async function () {
        this._atLeastOneAdminExists.resolves(false)
        this.email = 'someone@example.com'
        this.password = 'a_really_bad_password'
        this.req.body.email = this.email
        this.req.body.password = this.password
        this.user = {
          _id: 'abcdef',
          email: this.email,
        }
        this.UserRegistrationHandler.promises.registerNewUser = sinon
          .stub()
          .resolves(this.user)
        this.User.updateOne = sinon.stub().returns({
          exec: sinon.stub().rejects(new Error('woops')),
        })
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        this.AuthenticationManager.validateEmail = sinon.stub().returns(null)
        this.AuthenticationManager.validatePassword = sinon.stub().returns(null)
        await this.LaunchpadController.registerAdmin(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next with an error', function () {
        this.next.callCount.should.equal(1)
        expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
      })

      it('should have checked for existing admins', function () {
        this._atLeastOneAdminExists.callCount.should.equal(1)
      })

      it('should have called registerNewUser', function () {
        this.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          1
        )
        this.UserRegistrationHandler.promises.registerNewUser
          .calledWith({ email: this.email, password: this.password })
          .should.equal(true)
      })
    })

    describe('when overleaf', function () {
      let oldSettingsOverleaf

      beforeEach(async function () {
        oldSettingsOverleaf = Settings.overleaf
        Settings.overleaf = { one: 1 }
        this._atLeastOneAdminExists.resolves(false)
        this.email = 'someone@example.com'
        this.password = 'a_really_bad_password'
        this.req.body.email = this.email
        this.req.body.password = this.password
        this.user = {
          _id: 'abcdef',
          email: this.email,
        }
        this.UserRegistrationHandler.promises.registerNewUser = sinon
          .stub()
          .resolves(this.user)
        this.User.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves() })
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        this.AuthenticationManager.validateEmail = sinon.stub().returns(null)
        this.AuthenticationManager.validatePassword = sinon.stub().returns(null)
        this.UserGetter.promises.getUser = sinon
          .stub()
          .resolves({ _id: '1234' })
        await this.LaunchpadController.registerAdmin(
          this.req,
          this.res,
          this.next
        )
      })

      afterEach(async function () {
        Settings.overleaf = oldSettingsOverleaf
      })

      it('should send back a json response', function () {
        this.res.json.callCount.should.equal(1)
        expect(this.res.json).to.have.been.calledWith({ redir: '/launchpad' })
      })

      it('should have checked for existing admins', function () {
        this._atLeastOneAdminExists.callCount.should.equal(1)
      })

      it('should have called registerNewUser', function () {
        this.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          1
        )
        this.UserRegistrationHandler.promises.registerNewUser
          .calledWith({ email: this.email, password: this.password })
          .should.equal(true)
      })

      it('should have updated the user to make them an admin', function () {
        this.User.updateOne
          .calledWith(
            { _id: this.user._id },
            {
              $set: {
                isAdmin: true,
                emails: [
                  { email: this.user.email, reversedHostname: 'moc.elpmaxe' },
                ],
              },
            }
          )
          .should.equal(true)
      })
    })
  })

  describe('registerExternalAuthAdmin', function () {
    let oldSettingsLDAP

    beforeEach(function () {
      oldSettingsLDAP = Settings.ldap
      Settings.ldap = { one: 1 }
      this.LaunchpadController._mocks._atLeastOneAdminExists = sinon.stub()
      this._atLeastOneAdminExists =
        this.LaunchpadController._mocks._atLeastOneAdminExists
    })

    afterEach(function () {
      Settings.ldap = oldSettingsLDAP
    })

    describe('when all goes well', function () {
      beforeEach(async function () {
        this._atLeastOneAdminExists.resolves(false)
        this.email = 'someone@example.com'
        this.req.body.email = this.email
        this.user = {
          _id: 'abcdef',
          email: this.email,
        }
        this.UserRegistrationHandler.promises.registerNewUser = sinon
          .stub()
          .resolves(this.user)
        this.User.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves() })
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        await this.LaunchpadController.registerExternalAuthAdmin('ldap')(
          this.req,
          this.res,
          this.next
        )
      })

      it('should send back a json response', function () {
        this.res.json.callCount.should.equal(1)
        expect(this.res.json.lastCall.args[0].email).to.equal(this.email)
      })

      it('should have checked for existing admins', function () {
        this._atLeastOneAdminExists.callCount.should.equal(1)
      })

      it('should have called registerNewUser', function () {
        this.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          1
        )
        this.UserRegistrationHandler.promises.registerNewUser
          .calledWith({
            email: this.email,
            password: 'password_here',
            first_name: this.email,
            last_name: '',
          })
          .should.equal(true)
      })

      it('should have updated the user to make them an admin', function () {
        this.User.updateOne.callCount.should.equal(1)
        this.User.updateOne
          .calledWith(
            { _id: this.user._id },
            {
              $set: {
                isAdmin: true,
                emails: [
                  { email: this.user.email, reversedHostname: 'moc.elpmaxe' },
                ],
              },
            }
          )
          .should.equal(true)
      })

      it('should have set a redirect in session', function () {
        this.AuthenticationController.setRedirectInSession.callCount.should.equal(
          1
        )
        this.AuthenticationController.setRedirectInSession
          .calledWith(this.req, '/launchpad')
          .should.equal(true)
      })
    })

    describe('when the authMethod is invalid', function () {
      beforeEach(async function () {
        this._atLeastOneAdminExists.resolves(false)
        this.email = undefined
        this.req.body.email = this.email
        this.user = {
          _id: 'abcdef',
          email: this.email,
        }
        this.UserRegistrationHandler.promises.registerNewUser = sinon.stub()
        this.User.updateOne = sinon.stub().returns({ exec: sinon.stub() })
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        await this.LaunchpadController.registerExternalAuthAdmin(
          'NOTAVALIDAUTHMETHOD'
        )(this.req, this.res, this.next)
      })

      it('should send a 403 response', function () {
        this.res.sendStatus.callCount.should.equal(1)
        this.res.sendStatus.calledWith(403).should.equal(true)
      })

      it('should not check for existing admins', function () {
        this._atLeastOneAdminExists.callCount.should.equal(0)
      })

      it('should not call registerNewUser', function () {
        this.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          0
        )
      })
    })

    describe('when no email is supplied', function () {
      beforeEach(async function () {
        this._atLeastOneAdminExists.resolves(false)
        this.email = undefined
        this.req.body.email = this.email
        this.user = {
          _id: 'abcdef',
          email: this.email,
        }
        this.UserRegistrationHandler.promises.registerNewUser = sinon.stub()
        this.User.updateOne = sinon.stub().returns({ exec: sinon.stub() })
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        await this.LaunchpadController.registerExternalAuthAdmin('ldap')(
          this.req,
          this.res,
          this.next
        )
      })

      it('should send a 400 response', function () {
        this.res.sendStatus.callCount.should.equal(1)
        this.res.sendStatus.calledWith(400).should.equal(true)
      })

      it('should not check for existing admins', function () {
        this._atLeastOneAdminExists.callCount.should.equal(0)
      })

      it('should not call registerNewUser', function () {
        this.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          0
        )
      })
    })

    describe('when there are already existing admins', function () {
      beforeEach(async function () {
        this._atLeastOneAdminExists.resolves(true)
        this.email = 'someone@example.com'
        this.req.body.email = this.email
        this.user = {
          _id: 'abcdef',
          email: this.email,
        }
        this.UserRegistrationHandler.promises.registerNewUser = sinon.stub()
        this.User.updateOne = sinon.stub().returns({ exec: sinon.stub() })
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        await this.LaunchpadController.registerExternalAuthAdmin('ldap')(
          this.req,
          this.res,
          this.next
        )
      })

      it('should send a 403 response', function () {
        this.res.sendStatus.callCount.should.equal(1)
        this.res.sendStatus.calledWith(403).should.equal(true)
      })

      it('should not call registerNewUser', function () {
        this.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          0
        )
      })
    })

    describe('when checking admins produces an error', function () {
      beforeEach(async function () {
        this._atLeastOneAdminExists.rejects(new Error('woops'))
        this.email = 'someone@example.com'
        this.req.body.email = this.email
        this.user = {
          _id: 'abcdef',
          email: this.email,
        }
        this.UserRegistrationHandler.promises.registerNewUser = sinon.stub()
        this.User.updateOne = sinon.stub().returns({ exec: sinon.stub() })
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        await this.LaunchpadController.registerExternalAuthAdmin('ldap')(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next with an error', function () {
        this.next.callCount.should.equal(1)
        expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
      })

      it('should have checked for existing admins', function () {
        this._atLeastOneAdminExists.callCount.should.equal(1)
      })

      it('should not call registerNewUser', function () {
        this.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          0
        )
      })
    })

    describe('when registerNewUser produces an error', function () {
      beforeEach(async function () {
        this._atLeastOneAdminExists.resolves(false)
        this.email = 'someone@example.com'
        this.req.body.email = this.email
        this.user = {
          _id: 'abcdef',
          email: this.email,
        }
        this.UserRegistrationHandler.promises.registerNewUser = sinon
          .stub()
          .rejects(new Error('woops'))
        this.User.updateOne = sinon.stub().returns({ exec: sinon.stub() })
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        await this.LaunchpadController.registerExternalAuthAdmin('ldap')(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next with an error', function () {
        this.next.callCount.should.equal(1)
        expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
      })

      it('should have checked for existing admins', function () {
        this._atLeastOneAdminExists.callCount.should.equal(1)
      })

      it('should have called registerNewUser', function () {
        this.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          1
        )
        this.UserRegistrationHandler.promises.registerNewUser
          .calledWith({
            email: this.email,
            password: 'password_here',
            first_name: this.email,
            last_name: '',
          })
          .should.equal(true)
      })

      it('should not call update', function () {
        this.User.updateOne.callCount.should.equal(0)
      })
    })

    describe('when user update produces an error', function () {
      beforeEach(async function () {
        this._atLeastOneAdminExists.resolves(false)
        this.email = 'someone@example.com'
        this.req.body.email = this.email
        this.user = {
          _id: 'abcdef',
          email: this.email,
        }
        this.UserRegistrationHandler.promises.registerNewUser = sinon
          .stub()
          .resolves(this.user)
        this.User.updateOne = sinon.stub().returns({
          exec: sinon.stub().rejects(new Error('woops')),
        })
        this.AuthenticationController.setRedirectInSession = sinon.stub()
        await this.LaunchpadController.registerExternalAuthAdmin('ldap')(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next with an error', function () {
        this.next.callCount.should.equal(1)
        expect(this.next.lastCall.args[0]).to.be.instanceof(Error)
      })

      it('should have checked for existing admins', function () {
        this._atLeastOneAdminExists.callCount.should.equal(1)
      })

      it('should have called registerNewUser', function () {
        this.UserRegistrationHandler.promises.registerNewUser.callCount.should.equal(
          1
        )
        this.UserRegistrationHandler.promises.registerNewUser
          .calledWith({
            email: this.email,
            password: 'password_here',
            first_name: this.email,
            last_name: '',
          })
          .should.equal(true)
      })
    })
  })
})
