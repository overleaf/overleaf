const AuthenticationManager = require('../../../app/src/Features/Authentication/AuthenticationManager')
const UserHelper = require('./helpers/UserHelper')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')

const expect = chai.expect
chai.should()
chai.use(chaiAsPromised)

describe('UserHelper', function() {
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

  describe('fetching existing user', function() {
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

  describe('getCsrfToken', function() {
    describe('when the csrfToken is not cached', function() {
      it('should fetch csrfToken', async function() {
        const userHelper = new UserHelper()
        await userHelper.getCsrfToken()
        expect(userHelper.csrfToken).to.be.a.string
      })
    })

    describe('when the csrfToken is cached', function() {
      it('should fetch csrfToken', async function() {
        let userHelper = new UserHelper()
        await userHelper.getCsrfToken()
        const csrfToken = userHelper._csrfToken
        await userHelper.getCsrfToken()
        expect(csrfToken).to.equal(userHelper._csrfToken)
      })
    })
  })

  describe('registerUser', function() {
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
