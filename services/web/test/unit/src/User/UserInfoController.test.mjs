import { vi, expect } from 'vitest'
import sinon from 'sinon'
import MockResponse from '../helpers/MockResponse.mjs'
import MockRequest from '../helpers/MockRequest.mjs'
import mongodb from 'mongodb-legacy'

const modulePath = '../../../../app/src/Features/User/UserInfoController.mjs'

const { ObjectId } = mongodb

describe('UserInfoController', function () {
  beforeEach(async function (ctx) {
    ctx.UserDeleter = { deleteUser: sinon.stub().callsArgWith(1) }
    ctx.UserUpdater = { updatePersonalInfo: sinon.stub() }
    ctx.UserGetter = {
      promises: {
        getUserFeatures: sinon.stub(),
      },
    }

    vi.doMock('mongodb-legacy', () => ({
      default: { ObjectId },
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock('../../../../app/src/Features/User/UserUpdater', () => ({
      default: ctx.UserUpdater,
    }))

    vi.doMock('../../../../app/src/Features/User/UserDeleter', () => ({
      default: ctx.UserDeleter,
    }))

    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager',
      () => ({
        default: (ctx.SessionManager = {
          getLoggedInUserId: sinon.stub(),
        }),
      })
    )

    ctx.UserInfoController = (await import(modulePath)).default

    ctx.req = new MockRequest(vi)
    ctx.res = new MockResponse(vi)
    ctx.next = sinon.stub()
  })

  describe('getPersonalInfo', function () {
    describe('when the user exists with mongo id', function () {
      beforeEach(function (ctx) {
        ctx.user_id = new ObjectId().toString()
        ctx.user = { _id: new ObjectId(ctx.user_id) }
        ctx.req.params = { user_id: ctx.user_id }
        ctx.UserGetter.getUser = sinon.stub().callsArgWith(2, null, ctx.user)
        ctx.UserInfoController.sendFormattedPersonalInfo = sinon.stub()
        ctx.UserInfoController.getPersonalInfo(ctx.req, ctx.res, ctx.next)
      })

      it('should look up the user in the database', function (ctx) {
        ctx.UserGetter.getUser
          .calledWith(
            { _id: new ObjectId(ctx.user_id) },
            { _id: true, first_name: true, last_name: true, email: true }
          )
          .should.equal(true)
      })
    })

    describe('when the user exists with overleaf id', function () {
      beforeEach(function (ctx) {
        ctx.user_id = 12345
        ctx.user = {
          _id: new ObjectId(),
          overleaf: {
            id: ctx.user_id,
          },
        }
        ctx.req.params = { user_id: ctx.user_id.toString() }
        ctx.UserGetter.getUser = sinon.stub().callsArgWith(2, null, ctx.user)
        ctx.UserInfoController.getPersonalInfo(ctx.req, ctx.res, ctx.next)
      })

      it('should look up the user in the database', function (ctx) {
        ctx.UserGetter.getUser
          .calledWith(
            { 'overleaf.id': ctx.user_id },
            { _id: true, first_name: true, last_name: true, email: true }
          )
          .should.equal(true)
      })
    })

    describe('when the user does not exist', function () {
      beforeEach(function (ctx) {
        ctx.user_id = new ObjectId().toString()
        ctx.req.params = { user_id: ctx.user_id }
        ctx.UserGetter.getUser = sinon.stub().callsArgWith(2, null, null)
        ctx.UserInfoController.getPersonalInfo(ctx.req, ctx.res, ctx.next)
      })

      it('should return 404 to the client', function (ctx) {
        ctx.res.statusCode.should.equal(404)
      })
    })

    describe('when the user id is invalid', function () {
      beforeEach(function (ctx) {
        ctx.user_id = 'invalid'
        ctx.req.params = { user_id: ctx.user_id }
        ctx.UserGetter.getUser = sinon.stub().callsArgWith(2, null, null)
        ctx.UserInfoController.getPersonalInfo(ctx.req, ctx.res, ctx.next)
      })

      it('should return 400 to the client', function (ctx) {
        ctx.res.statusCode.should.equal(400)
      })
    })
  })

  describe('sendFormattedPersonalInfo', function () {
    beforeEach(function (ctx) {
      ctx.user = {
        _id: new ObjectId(),
        first_name: 'Douglas',
        last_name: 'Adams',
        email: 'doug@overleaf.com',
      }
      ctx.formattedInfo = {
        id: ctx.user._id.toString(),
        first_name: ctx.user.first_name,
        last_name: ctx.user.last_name,
        email: ctx.user.email,
      }
      ctx.UserInfoController.sendFormattedPersonalInfo(ctx.user, ctx.res)
    })

    it('should send the formatted details back to the client', function (ctx) {
      ctx.res.body.should.equal(JSON.stringify(ctx.formattedInfo))
    })
  })

  describe('formatPersonalInfo', function () {
    it('should return the correctly formatted data', function (ctx) {
      ctx.user = {
        _id: new ObjectId(),
        first_name: 'Douglas',
        last_name: 'Adams',
        email: 'doug@overleaf.com',
        password: 'should-not-get-included',
        signUpDate: new Date(),
        role: 'student',
        institution: 'sheffield',
      }
      expect(ctx.UserInfoController.formatPersonalInfo(ctx.user)).to.deep.equal(
        {
          id: ctx.user._id.toString(),
          first_name: ctx.user.first_name,
          last_name: ctx.user.last_name,
          email: ctx.user.email,
          signUpDate: ctx.user.signUpDate,
          role: ctx.user.role,
          institution: ctx.user.institution,
        }
      )
    })
  })

  describe('getUserFeatures', function () {
    describe('when the user is logged in', function () {
      beforeEach(async function (ctx) {
        ctx.user_id = new ObjectId().toString()
        ctx.features = {
          collaborators: 10,
          trackChanges: true,
          references: true,
        }
        ctx.SessionManager.getLoggedInUserId.returns(ctx.user_id)
        ctx.UserGetter.promises.getUserFeatures.resolves(ctx.features)
        await ctx.UserInfoController.getUserFeatures(ctx.req, ctx.res, ctx.next)
      })

      it('should fetch the user features', function (ctx) {
        expect(ctx.UserGetter.promises.getUserFeatures.callCount).to.equal(1)
        expect(
          ctx.UserGetter.promises.getUserFeatures.calledWith(ctx.user_id)
        ).to.equal(true)
      })

      it('should return the features as JSON', function (ctx) {
        expect(ctx.res.json).toHaveBeenCalledTimes(1)
        expect(ctx.res.json).toHaveBeenCalledWith(ctx.features)
      })
    })

    describe('when the user is not logged in', function () {
      beforeEach(async function (ctx) {
        ctx.SessionManager.getLoggedInUserId.returns(null)
        await ctx.UserInfoController.getUserFeatures(ctx.req, ctx.res, ctx.next)
      })

      it('should call next with an error', function (ctx) {
        expect(ctx.next.callCount).to.equal(1)
        expect(ctx.next.firstCall.args[0]).to.be.an.instanceof(Error)
        expect(ctx.next.firstCall.args[0].message).to.equal(
          'User is not logged in'
        )
      })
    })

    describe('when fetching features fails', function () {
      beforeEach(async function (ctx) {
        ctx.user_id = new ObjectId().toString()
        ctx.error = new Error('something went wrong')
        ctx.SessionManager.getLoggedInUserId.returns(ctx.user_id)
        ctx.UserGetter.promises.getUserFeatures.rejects(ctx.error)
        await ctx.UserInfoController.getUserFeatures(ctx.req, ctx.res, ctx.next)
      })

      it('should call next with the error', function (ctx) {
        expect(ctx.next.callCount).to.equal(1)
        expect(ctx.next.firstCall.args[0]).to.equal(ctx.error)
      })
    })
  })
})
