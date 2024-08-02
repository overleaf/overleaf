const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = '../../../../app/src/Features/User/UserInfoController.js'
const SandboxedModule = require('sandboxed-module')
const MockResponse = require('../helpers/MockResponse')
const MockRequest = require('../helpers/MockRequest')
const { ObjectId } = require('mongodb-legacy')

describe('UserInfoController', function () {
  beforeEach(function () {
    this.UserDeleter = { deleteUser: sinon.stub().callsArgWith(1) }
    this.UserUpdater = { updatePersonalInfo: sinon.stub() }
    this.UserGetter = {}

    this.UserInfoController = SandboxedModule.require(modulePath, {
      requires: {
        'mongodb-legacy': { ObjectId },
        './UserGetter': this.UserGetter,
        './UserUpdater': this.UserUpdater,
        './UserDeleter': this.UserDeleter,
        '../Authentication/SessionManager': (this.SessionManager = {
          getLoggedInUserId: sinon.stub(),
        }),
      },
    })

    this.req = new MockRequest()
    this.res = new MockResponse()
    this.next = sinon.stub()
  })

  describe('getPersonalInfo', function () {
    describe('when the user exists with mongo id', function () {
      beforeEach(function () {
        this.user_id = new ObjectId().toString()
        this.user = { _id: new ObjectId(this.user_id) }
        this.req.params = { user_id: this.user_id }
        this.UserGetter.getUser = sinon.stub().callsArgWith(2, null, this.user)
        this.UserInfoController.sendFormattedPersonalInfo = sinon.stub()
        this.UserInfoController.getPersonalInfo(this.req, this.res, this.next)
      })

      it('should look up the user in the database', function () {
        this.UserGetter.getUser
          .calledWith(
            { _id: new ObjectId(this.user_id) },
            { _id: true, first_name: true, last_name: true, email: true }
          )
          .should.equal(true)
      })
    })

    describe('when the user exists with overleaf id', function () {
      beforeEach(function () {
        this.user_id = 12345
        this.user = {
          _id: new ObjectId(),
          overleaf: {
            id: this.user_id,
          },
        }
        this.req.params = { user_id: this.user_id.toString() }
        this.UserGetter.getUser = sinon.stub().callsArgWith(2, null, this.user)
        this.UserInfoController.getPersonalInfo(this.req, this.res, this.next)
      })

      it('should look up the user in the database', function () {
        this.UserGetter.getUser
          .calledWith(
            { 'overleaf.id': this.user_id },
            { _id: true, first_name: true, last_name: true, email: true }
          )
          .should.equal(true)
      })
    })

    describe('when the user does not exist', function () {
      beforeEach(function () {
        this.user_id = new ObjectId().toString()
        this.req.params = { user_id: this.user_id }
        this.UserGetter.getUser = sinon.stub().callsArgWith(2, null, null)
        this.UserInfoController.getPersonalInfo(this.req, this.res, this.next)
      })

      it('should return 404 to the client', function () {
        this.res.statusCode.should.equal(404)
      })
    })

    describe('when the user id is invalid', function () {
      beforeEach(function () {
        this.user_id = 'invalid'
        this.req.params = { user_id: this.user_id }
        this.UserGetter.getUser = sinon.stub().callsArgWith(2, null, null)
        this.UserInfoController.getPersonalInfo(this.req, this.res, this.next)
      })

      it('should return 400 to the client', function () {
        this.res.statusCode.should.equal(400)
      })
    })
  })

  describe('sendFormattedPersonalInfo', function () {
    beforeEach(function () {
      this.user = {
        _id: new ObjectId(),
        first_name: 'Douglas',
        last_name: 'Adams',
        email: 'doug@overleaf.com',
      }
      this.formattedInfo = {
        id: this.user._id.toString(),
        first_name: this.user.first_name,
        last_name: this.user.last_name,
        email: this.user.email,
      }
      this.UserInfoController.sendFormattedPersonalInfo(this.user, this.res)
    })

    it('should send the formatted details back to the client', function () {
      this.res.body.should.equal(JSON.stringify(this.formattedInfo))
    })
  })

  describe('formatPersonalInfo', function () {
    it('should return the correctly formatted data', function () {
      this.user = {
        _id: new ObjectId(),
        first_name: 'Douglas',
        last_name: 'Adams',
        email: 'doug@overleaf.com',
        password: 'should-not-get-included',
        signUpDate: new Date(),
        role: 'student',
        institution: 'sheffield',
      }
      expect(
        this.UserInfoController.formatPersonalInfo(this.user)
      ).to.deep.equal({
        id: this.user._id.toString(),
        first_name: this.user.first_name,
        last_name: this.user.last_name,
        email: this.user.email,
        signUpDate: this.user.signUpDate,
        role: this.user.role,
        institution: this.user.institution,
      })
    })
  })
})
