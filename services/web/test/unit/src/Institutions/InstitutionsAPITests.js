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
const should = require('chai').should()
let { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const path = require('path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/Institutions/InstitutionsAPI'
)
;({ expect } = require('chai'))

describe('InstitutionsAPI', function() {
  beforeEach(function() {
    this.logger = { warn: sinon.stub(), err: sinon.stub(), log() {} }
    this.settings = { apis: { v1: { url: 'v1.url', user: '', pass: '' } } }
    this.request = sinon.stub()
    this.ipMatcherNotification = {
      read: (this.markAsReadIpMatcher = sinon.stub().callsArgWith(1, null))
    }
    this.InstitutionsAPI = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'logger-sharelatex': this.logger,
        'metrics-sharelatex': {
          timeAsyncMethod: sinon.stub()
        },
        'settings-sharelatex': this.settings,
        request: this.request,
        '../Notifications/NotificationsBuilder': {
          ipMatcherAffiliation: sinon.stub().returns(this.ipMatcherNotification)
        }
      }
    })

    this.stubbedUser = {
      _id: '3131231',
      name: 'bob',
      email: 'hello@world.com'
    }
    return (this.newEmail = 'bob@bob.com')
  })

  describe('getInstitutionAffiliations', function() {
    it('get affiliations', function(done) {
      this.institutionId = 123
      const responseBody = ['123abc', '456def']
      this.request.yields(null, { statusCode: 200 }, responseBody)
      return this.InstitutionsAPI.getInstitutionAffiliations(
        this.institutionId,
        (err, body) => {
          should.not.exist(err)
          this.request.calledOnce.should.equal(true)
          const requestOptions = this.request.lastCall.args[0]
          const expectedUrl = `v1.url/api/v2/institutions/${
            this.institutionId
          }/affiliations`
          requestOptions.url.should.equal(expectedUrl)
          requestOptions.method.should.equal('GET')
          should.not.exist(requestOptions.body)
          body.should.equal(responseBody)
          return done()
        }
      )
    })

    it('handle empty response', function(done) {
      this.settings.apis.v1.url = ''

      return this.InstitutionsAPI.getInstitutionAffiliations(
        this.institutionId,
        (err, body) => {
          should.not.exist(err)
          expect(body).to.be.a('Array')
          body.length.should.equal(0)
          return done()
        }
      )
    })
  })

  describe('getInstitutionLicences', function() {
    it('get licences', function(done) {
      this.institutionId = 123
      const responseBody = {
        lag: 'monthly',
        data: [{ key: 'users', values: [{ x: '2018-01-01', y: 1 }] }]
      }
      this.request.yields(null, { statusCode: 200 }, responseBody)
      const startDate = '1417392000'
      const endDate = '1420848000'
      return this.InstitutionsAPI.getInstitutionLicences(
        this.institutionId,
        startDate,
        endDate,
        'monthly',
        (err, body) => {
          should.not.exist(err)
          this.request.calledOnce.should.equal(true)
          const requestOptions = this.request.lastCall.args[0]
          const expectedUrl = `v1.url/api/v2/institutions/${
            this.institutionId
          }/institution_licences`
          requestOptions.url.should.equal(expectedUrl)
          requestOptions.method.should.equal('GET')
          requestOptions.body['start_date'].should.equal(startDate)
          requestOptions.body['end_date'].should.equal(endDate)
          requestOptions.body.lag.should.equal('monthly')
          body.should.equal(responseBody)
          return done()
        }
      )
    })
  })

  describe('getUserAffiliations', function() {
    it('get affiliations', function(done) {
      const responseBody = [{ foo: 'bar' }]
      this.request.callsArgWith(1, null, { statusCode: 201 }, responseBody)
      return this.InstitutionsAPI.getUserAffiliations(
        this.stubbedUser._id,
        (err, body) => {
          should.not.exist(err)
          this.request.calledOnce.should.equal(true)
          const requestOptions = this.request.lastCall.args[0]
          const expectedUrl = `v1.url/api/v2/users/${
            this.stubbedUser._id
          }/affiliations`
          requestOptions.url.should.equal(expectedUrl)
          requestOptions.method.should.equal('GET')
          should.not.exist(requestOptions.body)
          body.should.equal(responseBody)
          return done()
        }
      )
    })

    it('handle error', function(done) {
      const body = { errors: 'affiliation error message' }
      this.request.callsArgWith(1, null, { statusCode: 503 }, body)
      return this.InstitutionsAPI.getUserAffiliations(
        this.stubbedUser._id,
        err => {
          should.exist(err)
          err.message.should.have.string(503)
          err.message.should.have.string(body.errors)
          return done()
        }
      )
    })

    it('handle empty response', function(done) {
      this.settings.apis.v1.url = ''
      return this.InstitutionsAPI.getUserAffiliations(
        this.stubbedUser._id,
        (err, body) => {
          should.not.exist(err)
          expect(body).to.be.a('Array')
          body.length.should.equal(0)
          return done()
        }
      )
    })
  })

  describe('addAffiliation', function() {
    beforeEach(function() {
      return this.request.callsArgWith(1, null, { statusCode: 201 })
    })

    it('add affiliation', function(done) {
      const affiliationOptions = {
        university: { id: 1 },
        role: 'Prof',
        department: 'Math',
        confirmedAt: new Date()
      }
      return this.InstitutionsAPI.addAffiliation(
        this.stubbedUser._id,
        this.newEmail,
        affiliationOptions,
        err => {
          should.not.exist(err)
          this.request.calledOnce.should.equal(true)
          const requestOptions = this.request.lastCall.args[0]
          const expectedUrl = `v1.url/api/v2/users/${
            this.stubbedUser._id
          }/affiliations`
          requestOptions.url.should.equal(expectedUrl)
          requestOptions.method.should.equal('POST')

          const { body } = requestOptions
          Object.keys(body).length.should.equal(5)
          body.email.should.equal(this.newEmail)
          body.university.should.equal(affiliationOptions.university)
          body.department.should.equal(affiliationOptions.department)
          body.role.should.equal(affiliationOptions.role)
          body.confirmedAt.should.equal(affiliationOptions.confirmedAt)
          this.markAsReadIpMatcher.calledOnce.should.equal(true)
          return done()
        }
      )
    })

    it('handle error', function(done) {
      const body = { errors: 'affiliation error message' }
      this.request.callsArgWith(1, null, { statusCode: 422 }, body)
      return this.InstitutionsAPI.addAffiliation(
        this.stubbedUser._id,
        this.newEmail,
        {},
        err => {
          should.exist(err)
          err.message.should.have.string(422)
          err.message.should.have.string(body.errors)
          return done()
        }
      )
    })
  })

  describe('removeAffiliation', function() {
    beforeEach(function() {
      return this.request.callsArgWith(1, null, { statusCode: 404 })
    })

    it('remove affiliation', function(done) {
      return this.InstitutionsAPI.removeAffiliation(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.not.exist(err)
          this.request.calledOnce.should.equal(true)
          const requestOptions = this.request.lastCall.args[0]
          const expectedUrl = `v1.url/api/v2/users/${
            this.stubbedUser._id
          }/affiliations/remove`
          requestOptions.url.should.equal(expectedUrl)
          requestOptions.method.should.equal('POST')
          expect(requestOptions.body).to.deep.equal({ email: this.newEmail })
          return done()
        }
      )
    })

    it('handle error', function(done) {
      this.request.callsArgWith(1, null, { statusCode: 500 })
      return this.InstitutionsAPI.removeAffiliation(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          should.exist(err)
          err.message.should.exist
          return done()
        }
      )
    })
  })

  describe('deleteAffiliations', function() {
    it('delete affiliations', function(done) {
      this.request.callsArgWith(1, null, { statusCode: 200 })
      return this.InstitutionsAPI.deleteAffiliations(
        this.stubbedUser._id,
        err => {
          should.not.exist(err)
          this.request.calledOnce.should.equal(true)
          const requestOptions = this.request.lastCall.args[0]
          const expectedUrl = `v1.url/api/v2/users/${
            this.stubbedUser._id
          }/affiliations`
          requestOptions.url.should.equal(expectedUrl)
          requestOptions.method.should.equal('DELETE')
          return done()
        }
      )
    })

    it('handle error', function(done) {
      const body = { errors: 'affiliation error message' }
      this.request.callsArgWith(1, null, { statusCode: 518 }, body)
      return this.InstitutionsAPI.deleteAffiliations(
        this.stubbedUser._id,
        err => {
          should.exist(err)
          err.message.should.have.string(518)
          err.message.should.have.string(body.errors)
          return done()
        }
      )
    })
  })

  describe('endorseAffiliation', function() {
    beforeEach(function() {
      return this.request.callsArgWith(1, null, { statusCode: 204 })
    })

    it('endorse affiliation', function(done) {
      return this.InstitutionsAPI.endorseAffiliation(
        this.stubbedUser._id,
        this.newEmail,
        'Student',
        'Physics',
        err => {
          should.not.exist(err)
          this.request.calledOnce.should.equal(true)
          const requestOptions = this.request.lastCall.args[0]
          const expectedUrl = `v1.url/api/v2/users/${
            this.stubbedUser._id
          }/affiliations/endorse`
          requestOptions.url.should.equal(expectedUrl)
          requestOptions.method.should.equal('POST')

          const { body } = requestOptions
          Object.keys(body).length.should.equal(3)
          body.email.should.equal(this.newEmail)
          body.role.should.equal('Student')
          body.department.should.equal('Physics')
          return done()
        }
      )
    })
  })
})
