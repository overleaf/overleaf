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
const chai = require('chai')
const { assert } = require('chai')
const should = chai.should()
const { expect } = chai
const modulePath = '../../../../app/src/Features/User/UserInfoController.js'
const SandboxedModule = require('sandboxed-module')
const events = require('events')
const MockResponse = require('../helpers/MockResponse')
const MockRequest = require('../helpers/MockRequest')
const { ObjectId } = require('mongojs')

describe('UserInfoController', function() {
  beforeEach(function() {
    this.UserDeleter = { deleteUser: sinon.stub().callsArgWith(1) }
    this.UserUpdater = { updatePersonalInfo: sinon.stub() }
    this.sanitizer = {
      escape(v) {
        return v
      }
    }
    sinon.spy(this.sanitizer, 'escape')
    this.UserGetter = {}

    this.UserInfoController = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        './UserGetter': this.UserGetter,
        './UserUpdater': this.UserUpdater,
        './UserDeleter': this.UserDeleter,
        'logger-sharelatex': {
          log() {}
        },
        sanitizer: this.sanitizer,
        '../Authentication/AuthenticationController': (this.AuthenticationController = {
          getLoggedInUserId: sinon.stub()
        })
      }
    })

    this.req = new MockRequest()
    this.res = new MockResponse()
    return (this.next = sinon.stub())
  })

  describe('getLoggedInUsersPersonalInfo', function() {
    beforeEach(function() {
      this.user = { _id: ObjectId() }
      this.req.user = this.user
      this.req.session.user = this.user
      this.UserInfoController.sendFormattedPersonalInfo = sinon.stub()
      this.UserGetter.getUser = sinon.stub().callsArgWith(2, null, this.user)
      this.AuthenticationController.getLoggedInUserId = sinon
        .stub()
        .returns(this.user._id)
      return this.UserInfoController.getLoggedInUsersPersonalInfo(
        this.req,
        this.res,
        this.next
      )
    })

    it('should call sendFormattedPersonalInfo', function() {
      return this.UserInfoController.sendFormattedPersonalInfo
        .calledWith(this.user, this.res, this.next)
        .should.equal(true)
    })
  })

  describe('getPersonalInfo', function() {
    describe('when the user exists with sharelatex id', function() {
      beforeEach(function() {
        this.user_id = ObjectId().toString()
        this.user = { _id: ObjectId(this.user_id) }
        this.req.params = { user_id: this.user_id }
        this.UserGetter.getUser = sinon.stub().callsArgWith(2, null, this.user)
        this.UserInfoController.sendFormattedPersonalInfo = sinon.stub()
        return this.UserInfoController.getPersonalInfo(
          this.req,
          this.res,
          this.next
        )
      })

      it('should look up the user in the database', function() {
        return this.UserGetter.getUser
          .calledWith(
            { _id: ObjectId(this.user_id) },
            { _id: true, first_name: true, last_name: true, email: true }
          )
          .should.equal(true)
      })

      it('should send the formatted details back to the client', function() {
        return this.UserInfoController.sendFormattedPersonalInfo
          .calledWith(this.user, this.res, this.next)
          .should.equal(true)
      })
    })

    describe('when the user exists with overleaf id', function() {
      beforeEach(function() {
        this.user_id = 12345
        this.user = {
          _id: ObjectId(),
          overleaf: {
            id: this.user_id
          }
        }
        this.req.params = { user_id: this.user_id.toString() }
        this.UserGetter.getUser = sinon.stub().callsArgWith(2, null, this.user)
        this.UserInfoController.sendFormattedPersonalInfo = sinon.stub()
        return this.UserInfoController.getPersonalInfo(
          this.req,
          this.res,
          this.next
        )
      })

      it('should look up the user in the database', function() {
        return this.UserGetter.getUser
          .calledWith(
            { 'overleaf.id': this.user_id },
            { _id: true, first_name: true, last_name: true, email: true }
          )
          .should.equal(true)
      })

      it('should send the formatted details back to the client', function() {
        return this.UserInfoController.sendFormattedPersonalInfo
          .calledWith(this.user, this.res, this.next)
          .should.equal(true)
      })
    })

    describe('when the user does not exist', function() {
      beforeEach(function() {
        this.user_id = ObjectId().toString()
        this.req.params = { user_id: this.user_id }
        this.UserGetter.getUser = sinon.stub().callsArgWith(2, null, null)
        return this.UserInfoController.getPersonalInfo(
          this.req,
          this.res,
          this.next
        )
      })

      it('should return 404 to the client', function() {
        return this.res.statusCode.should.equal(404)
      })
    })

    describe('when the user id is invalid', function() {
      beforeEach(function() {
        this.user_id = 'invalid'
        this.req.params = { user_id: this.user_id }
        this.UserGetter.getUser = sinon.stub().callsArgWith(2, null, null)
        return this.UserInfoController.getPersonalInfo(
          this.req,
          this.res,
          this.next
        )
      })

      it('should return 400 to the client', function() {
        return this.res.statusCode.should.equal(400)
      })
    })
  })

  describe('sendFormattedPersonalInfo', function() {
    beforeEach(function() {
      this.user = {
        _id: ObjectId(),
        first_name: 'Douglas',
        last_name: 'Adams',
        email: 'doug@sharelatex.com'
      }
      this.formattedInfo = {
        id: this.user._id.toString(),
        first_name: this.user.first_name,
        last_name: this.user.last_name,
        email: this.user.email
      }
      this.UserInfoController.formatPersonalInfo = sinon
        .stub()
        .returns(this.formattedInfo)
      return this.UserInfoController.sendFormattedPersonalInfo(
        this.user,
        this.res
      )
    })

    it('should format the user details for the response', function() {
      return this.UserInfoController.formatPersonalInfo
        .calledWith(this.user)
        .should.equal(true)
    })

    it('should send the formatted details back to the client', function() {
      return this.res.body.should.equal(JSON.stringify(this.formattedInfo))
    })
  })

  describe('formatPersonalInfo', function() {
    it('should return the correctly formatted data', function() {
      this.user = {
        _id: ObjectId(),
        first_name: 'Douglas',
        last_name: 'Adams',
        email: 'doug@sharelatex.com',
        password: 'should-not-get-included',
        signUpDate: new Date(),
        role: 'student',
        institution: 'sheffield'
      }
      return expect(
        this.UserInfoController.formatPersonalInfo(this.user)
      ).to.deep.equal({
        id: this.user._id.toString(),
        first_name: this.user.first_name,
        last_name: this.user.last_name,
        email: this.user.email,
        signUpDate: this.user.signUpDate,
        role: this.user.role,
        institution: this.user.institution
      })
    })
  })
})
