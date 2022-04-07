const Path = require('path')
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')

const MODULE_PATH = Path.join(
  __dirname,
  '../../../app/src/UserActivateController.js'
)
const VIEW_PATH = Path.join(__dirname, '../../../app/views/user/activate')

describe('UserActivateController', function () {
  beforeEach(function () {
    this.user = {
      _id: (this.user_id = 'kwjewkl'),
      features: {},
      email: 'joe@example.com',
    }

    this.UserGetter = { getUser: sinon.stub() }
    this.UserRegistrationHandler = {}
    this.ErrorController = { notFound: sinon.stub() }
    this.UserActivateController = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '../../../../app/src/Features/User/UserGetter': this.UserGetter,
        '../../../../app/src/Features/User/UserRegistrationHandler':
          this.UserRegistrationHandler,
        '../../../../app/src/Features/Errors/ErrorController':
          this.ErrorController,
      },
    })
    this.req = {
      body: {},
      query: {},
      session: {
        user: this.user,
      },
    }
    this.res = {
      json: sinon.stub(),
    }
  })

  describe('activateAccountPage', function () {
    beforeEach(function () {
      this.UserGetter.getUser = sinon.stub().callsArgWith(2, null, this.user)
      this.req.query.user_id = this.user_id
      this.req.query.token = this.token = 'mock-token-123'
    })

    it('should 404 without a user_id', function (done) {
      delete this.req.query.user_id
      this.ErrorController.notFound = () => done()
      this.UserActivateController.activateAccountPage(this.req, this.res)
    })

    it('should 404 without a token', function (done) {
      delete this.req.query.token
      this.ErrorController.notFound = () => done()
      this.UserActivateController.activateAccountPage(this.req, this.res)
    })

    it('should 404 without a valid user_id', function (done) {
      this.UserGetter.getUser = sinon.stub().callsArgWith(2, null, null)
      this.ErrorController.notFound = () => done()
      this.UserActivateController.activateAccountPage(this.req, this.res)
    })

    it('should 403 for complex user_id', function (done) {
      this.ErrorController.forbidden = () => done()
      this.req.query.user_id = { first_name: 'X' }
      this.UserActivateController.activateAccountPage(this.req, this.res)
    })

    it('should redirect activated users to login', function (done) {
      this.user.loginCount = 1
      this.res.redirect = url => {
        this.UserGetter.getUser.calledWith(this.user_id).should.equal(true)
        url.should.equal('/login')
        return done()
      }
      this.UserActivateController.activateAccountPage(this.req, this.res)
    })

    it('render the activation page if the user has not logged in before', function (done) {
      this.user.loginCount = 0
      this.res.render = (page, opts) => {
        page.should.equal(VIEW_PATH)
        opts.email.should.equal(this.user.email)
        opts.token.should.equal(this.token)
        return done()
      }
      this.UserActivateController.activateAccountPage(this.req, this.res)
    })
  })

  describe('register', function () {
    beforeEach(function () {
      this.UserRegistrationHandler.registerNewUserAndSendActivationEmail = sinon
        .stub()
        .callsArgWith(1, null, this.user, (this.url = 'mock/url'))
      this.req.body.email = this.user.email = this.email = 'email@example.com'
      this.UserActivateController.register(this.req, this.res)
    })

    it('should register the user and send them an email', function () {
      sinon.assert.calledWith(
        this.UserRegistrationHandler.registerNewUserAndSendActivationEmail,
        this.email
      )
    })

    it('should return the user and activation url', function () {
      this.res.json
        .calledWith({
          email: this.email,
          setNewPasswordUrl: this.url,
        })
        .should.equal(true)
    })
  })
})
