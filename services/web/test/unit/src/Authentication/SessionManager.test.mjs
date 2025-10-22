import { expect } from 'vitest'
import sinon from 'sinon'
import tk from 'timekeeper'
import mongodb from 'mongodb-legacy'
const modulePath =
  '../../../../app/src/Features/Authentication/SessionManager.mjs'

const { ObjectId } = mongodb

describe('SessionManager', function () {
  beforeEach(async function (ctx) {
    ctx.UserModel = { findOne: sinon.stub() }
    ctx.SessionManager = (await import(modulePath)).default
    ctx.user = {
      _id: new ObjectId(),
      email: (ctx.email = 'USER@example.com'),
      first_name: 'bob',
      last_name: 'brown',
      referal_id: 1234,
      isAdmin: false,
    }
    ctx.session = sinon.stub()
  })

  afterEach(function () {
    tk.reset()
  })

  describe('isUserLoggedIn', function () {
    beforeEach(function (ctx) {
      ctx.stub = sinon.stub(ctx.SessionManager, 'getLoggedInUserId')
    })

    afterEach(function (ctx) {
      ctx.stub.restore()
    })

    it('should do the right thing in all cases', function (ctx) {
      ctx.SessionManager.getLoggedInUserId.returns('some_id')
      expect(ctx.SessionManager.isUserLoggedIn(ctx.session)).to.equal(true)
      ctx.SessionManager.getLoggedInUserId.returns(null)
      expect(ctx.SessionManager.isUserLoggedIn(ctx.session)).to.equal(false)
      ctx.SessionManager.getLoggedInUserId.returns(false)
      expect(ctx.SessionManager.isUserLoggedIn(ctx.session)).to.equal(false)
      ctx.SessionManager.getLoggedInUserId.returns(undefined)
      expect(ctx.SessionManager.isUserLoggedIn(ctx.session)).to.equal(false)
    })
  })

  describe('setInSessionUser', function () {
    beforeEach(function (ctx) {
      ctx.user = {
        _id: 'id',
        first_name: 'a',
        last_name: 'b',
        email: 'c',
      }
      ctx.SessionManager.getSessionUser = sinon.stub().returns(ctx.user)
    })

    it('should update the right properties', function (ctx) {
      ctx.SessionManager.setInSessionUser(ctx.session, {
        first_name: 'new_first_name',
        email: 'new_email',
      })
      const expectedUser = {
        _id: 'id',
        first_name: 'new_first_name',
        last_name: 'b',
        email: 'new_email',
      }
      expect(ctx.user).to.deep.equal(expectedUser)
      expect(ctx.user).to.deep.equal(expectedUser)
    })
  })

  describe('getLoggedInUserId', function () {
    beforeEach(function (ctx) {
      ctx.req = { session: {} }
    })

    it('should return the user id from the session', function (ctx) {
      ctx.user_id = '2134'
      ctx.session.user = { _id: ctx.user_id }
      const result = ctx.SessionManager.getLoggedInUserId(ctx.session)
      expect(result).to.equal(ctx.user_id)
    })

    it('should return user for passport session', function (ctx) {
      ctx.user_id = '2134'
      ctx.session = {
        passport: {
          user: {
            _id: ctx.user_id,
          },
        },
      }
      const result = ctx.SessionManager.getLoggedInUserId(ctx.session)
      expect(result).to.equal(ctx.user_id)
    })

    it('should return null if there is no user on the session', function (ctx) {
      ctx.session = {}
      const result = ctx.SessionManager.getLoggedInUserId(ctx.session)
      expect(result).to.equal(null)
    })

    it('should return null if there is no session', function (ctx) {
      const result = ctx.SessionManager.getLoggedInUserId(undefined)
      expect(result).to.equal(null)
    })
  })
})
