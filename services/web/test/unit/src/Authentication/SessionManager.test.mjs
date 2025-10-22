const sinon = require('sinon')
const { expect } = require('chai')
const modulePath =
  '../../../../app/src/Features/Authentication/SessionManager.js'
const SandboxedModule = require('sandboxed-module')
const tk = require('timekeeper')
const { ObjectId } = require('mongodb-legacy')

describe('SessionManager', function () {
  beforeEach(function () {
    this.UserModel = { findOne: sinon.stub() }
    this.SessionManager = SandboxedModule.require(modulePath, {
      requires: {},
    })
    this.user = {
      _id: new ObjectId(),
      email: (this.email = 'USER@example.com'),
      first_name: 'bob',
      last_name: 'brown',
      referal_id: 1234,
      isAdmin: false,
    }
    this.session = sinon.stub()
  })

  afterEach(function () {
    tk.reset()
  })

  describe('isUserLoggedIn', function () {
    beforeEach(function () {
      this.stub = sinon.stub(this.SessionManager, 'getLoggedInUserId')
    })

    afterEach(function () {
      this.stub.restore()
    })

    it('should do the right thing in all cases', function () {
      this.SessionManager.getLoggedInUserId.returns('some_id')
      expect(this.SessionManager.isUserLoggedIn(this.session)).to.equal(true)
      this.SessionManager.getLoggedInUserId.returns(null)
      expect(this.SessionManager.isUserLoggedIn(this.session)).to.equal(false)
      this.SessionManager.getLoggedInUserId.returns(false)
      expect(this.SessionManager.isUserLoggedIn(this.session)).to.equal(false)
      this.SessionManager.getLoggedInUserId.returns(undefined)
      expect(this.SessionManager.isUserLoggedIn(this.session)).to.equal(false)
    })
  })

  describe('setInSessionUser', function () {
    beforeEach(function () {
      this.user = {
        _id: 'id',
        first_name: 'a',
        last_name: 'b',
        email: 'c',
      }
      this.SessionManager.getSessionUser = sinon.stub().returns(this.user)
    })

    it('should update the right properties', function () {
      this.SessionManager.setInSessionUser(this.session, {
        first_name: 'new_first_name',
        email: 'new_email',
      })
      const expectedUser = {
        _id: 'id',
        first_name: 'new_first_name',
        last_name: 'b',
        email: 'new_email',
      }
      expect(this.user).to.deep.equal(expectedUser)
      expect(this.user).to.deep.equal(expectedUser)
    })
  })

  describe('getLoggedInUserId', function () {
    beforeEach(function () {
      this.req = { session: {} }
    })

    it('should return the user id from the session', function () {
      this.user_id = '2134'
      this.session.user = { _id: this.user_id }
      const result = this.SessionManager.getLoggedInUserId(this.session)
      expect(result).to.equal(this.user_id)
    })

    it('should return user for passport session', function () {
      this.user_id = '2134'
      this.session = {
        passport: {
          user: {
            _id: this.user_id,
          },
        },
      }
      const result = this.SessionManager.getLoggedInUserId(this.session)
      expect(result).to.equal(this.user_id)
    })

    it('should return null if there is no user on the session', function () {
      this.session = {}
      const result = this.SessionManager.getLoggedInUserId(this.session)
      expect(result).to.equal(null)
    })

    it('should return null if there is no session', function () {
      const result = this.SessionManager.getLoggedInUserId(undefined)
      expect(result).to.equal(null)
    })
  })
})
