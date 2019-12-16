const AuthenticationManager = require('../../../app/src/Features/Authentication/AuthenticationManager')
const UserHelper = require('./helpers/UserHelper')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const Features = require('../../../app/src/infrastructure/Features')

const expect = chai.expect
chai.should()
chai.use(chaiAsPromised)

describe('UserHelper', function() {
  // Disable all tests unless the public-registration feature is enabled
  beforeEach(function() {
    if (!Features.hasFeature('public-registration')) {
      this.skip()
    }
  })

  describe('UserHelper.createUser', function() {
    describe('with no args', function() {
      it('should create new user with default username and password', async function() {
        const userHelper = await UserHelper.createUser()
        userHelper.user.email.should.equal(userHelper.getDefaultEmail())
        const authedUser = await AuthenticationManager.promises.authenticate(
          { _id: userHelper.user._id },
          userHelper.getDefaultPassword()
        )
        expect(authedUser).to.not.be.null
      })
    })

    describe('with email', function() {
      it('should create new user with provided email and default password', async function() {
        const userHelper = await UserHelper.createUser({
          email: 'foo@test.com'
        })
        userHelper.user.email.should.equal('foo@test.com')
        const authedUser = await AuthenticationManager.promises.authenticate(
          { _id: userHelper.user._id },
          userHelper.getDefaultPassword()
        )
        expect(authedUser).to.not.be.null
      })
    })

    describe('with password', function() {
      it('should create new user with provided password and default email', async function() {
        const userHelper = await UserHelper.createUser({
          password: 'foofoofoo'
        })
        userHelper.user.email.should.equal(userHelper.getDefaultEmail())
        const authedUser = await AuthenticationManager.promises.authenticate(
          { _id: userHelper.user._id },
          'foofoofoo'
        )
        expect(authedUser).to.not.be.null
      })
    })
  })

  describe('UserHelper.getUser', function() {
    let user

    beforeEach(async function() {
      user = (await UserHelper.createUser()).user
    })

    describe('with string id', function() {
      it('should fetch user', async function() {
        const userHelper = await UserHelper.getUser(user._id.toString())
        userHelper.user.email.should.equal(user.email)
      })
    })

    describe('with _id', function() {
      it('should fetch user', async function() {
        const userHelper = await UserHelper.getUser({ _id: user._id })
        userHelper.user.email.should.equal(user.email)
      })
    })
  })

  describe('UserHelper.loginUser', function() {
    let userHelper

    beforeEach(async function() {
      userHelper = await UserHelper.createUser()
    })

    describe('with email and password', function() {
      it('should login user', async function() {
        const newUserHelper = await UserHelper.loginUser({
          email: userHelper.getDefaultEmail(),
          password: userHelper.getDefaultPassword()
        })
        newUserHelper.user.email.should.equal(userHelper.user.email)
      })
    })

    describe('without email', function() {
      it('should throw error', async function() {
        await UserHelper.loginUser({
          password: userHelper.getDefaultPassword()
        }).should.be.rejectedWith('email and password required')
      })
    })

    describe('without password', function() {
      it('should throw error', async function() {
        await UserHelper.loginUser({
          email: userHelper.getDefaultEmail()
        }).should.be.rejectedWith('email and password required')
      })
    })

    describe('without email and password', function() {
      it('should throw error', async function() {
        await UserHelper.loginUser().should.be.rejectedWith(
          'email and password required'
        )
      })
    })
  })

  describe('UserHelper.registerUser', function() {
    describe('with no args', function() {
      it('should create new user with default username and password', async function() {
        const userHelper = await UserHelper.registerUser()
        userHelper.user.email.should.equal(userHelper.getDefaultEmail())
        const authedUser = await AuthenticationManager.promises.authenticate(
          { _id: userHelper.user._id },
          userHelper.getDefaultPassword()
        )
        expect(authedUser).to.not.be.null
      })
    })

    describe('with email', function() {
      it('should create new user with provided email and default password', async function() {
        const userHelper = await UserHelper.registerUser({
          email: 'foo2@test.com'
        })
        userHelper.user.email.should.equal('foo2@test.com')
        const authedUser = await AuthenticationManager.promises.authenticate(
          { _id: userHelper.user._id },
          userHelper.getDefaultPassword()
        )
        expect(authedUser).to.not.be.null
      })
    })

    describe('with password', function() {
      it('should create new user with provided password and default email', async function() {
        const userHelper = await UserHelper.registerUser({
          password: 'foofoofoo'
        })
        userHelper.user.email.should.equal(userHelper.getDefaultEmail())
        const authedUser = await AuthenticationManager.promises.authenticate(
          { _id: userHelper.user._id },
          'foofoofoo'
        )
        expect(authedUser).to.not.be.null
      })
    })
  })

  describe('getCsrfToken', function() {
    describe('when the csrfToken is not cached', function() {
      it('should fetch csrfToken', async function() {
        const userHelper = new UserHelper()
        await userHelper.getCsrfToken()
        expect(userHelper.csrfToken).to.be.a.string
      })
    })

    describe('when the csrfToken is cached', function() {
      it('should return cached csrfToken', async function() {
        let userHelper = new UserHelper()
        await userHelper.getCsrfToken()
        const csrfToken = userHelper._csrfToken
        await userHelper.getCsrfToken()
        expect(csrfToken).to.equal(userHelper._csrfToken)
      })
    })
  })

  describe('after logout', function() {
    let userHelper, oldCsrfToken

    beforeEach(async function() {
      userHelper = await UserHelper.registerUser()
      oldCsrfToken = userHelper.csrfToken
    })

    it('refreshes csrf token after logout', async function() {
      await userHelper.logout()
      expect(userHelper._csrfToken).to.equal('')
      await userHelper.getCsrfToken()
      expect(userHelper._csrfToken).to.not.equal('')
      expect(userHelper._csrfToken).to.not.equal(oldCsrfToken)
    })
  })
})
