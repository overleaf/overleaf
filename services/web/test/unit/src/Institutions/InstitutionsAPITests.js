const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')
const path = require('path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/Institutions/InstitutionsAPI'
)
const Errors = require('../../../../app/src/Features/Errors/Errors')

describe('InstitutionsAPI', function () {
  beforeEach(function () {
    this.settings = {
      apis: { v1: { url: 'v1.url', user: '', pass: '', timeout: 5000 } },
    }
    this.request = sinon.stub()
    this.fetchNothing = sinon.stub()
    this.ipMatcherNotification = {
      read: (this.markAsReadIpMatcher = sinon.stub().resolves()),
    }
    this.InstitutionsAPI = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': this.settings,
        requestretry: this.request,
        '@overleaf/fetch-utils': {
          fetchNothing: this.fetchNothing,
          fetchJson: (this.fetchJson = sinon.stub()),
        },
        '../Notifications/NotificationsBuilder': {
          promises: {
            ipMatcherAffiliation: sinon
              .stub()
              .returns(this.ipMatcherNotification),
          },
        },
      },
    })

    this.stubbedUser = {
      _id: '3131231',
      name: 'bob',
      email: 'hello@world.com',
    }
    this.newEmail = 'bob@bob.com'
  })

  describe('getInstitutionAffiliations', function () {
    it('get affiliations', function (done) {
      this.institutionId = 123
      const responseBody = ['123abc', '456def']
      this.request.yields(null, { statusCode: 200 }, responseBody)
      this.InstitutionsAPI.getInstitutionAffiliations(
        this.institutionId,
        (err, body) => {
          expect(err).not.to.exist
          this.request.calledOnce.should.equal(true)
          const requestOptions = this.request.lastCall.args[0]
          const expectedUrl = `v1.url/api/v2/institutions/${this.institutionId}/affiliations`
          requestOptions.url.should.equal(expectedUrl)
          requestOptions.method.should.equal('GET')
          requestOptions.maxAttempts.should.exist
          requestOptions.maxAttempts.should.not.equal(0)
          requestOptions.retryDelay.should.exist
          expect(requestOptions.body).not.to.exist
          body.should.equal(responseBody)
          done()
        }
      )
    })

    it('handle empty response', function (done) {
      this.settings.apis.v1.url = ''

      this.InstitutionsAPI.getInstitutionAffiliations(
        this.institutionId,
        (err, body) => {
          expect(err).not.to.exist
          expect(body).to.be.a('Array')
          body.length.should.equal(0)
          done()
        }
      )
    })
  })

  describe('getLicencesForAnalytics', function () {
    const lag = 'daily'
    const queryDate = '2017-01-07:00:00.000Z'
    it('should send the request to v1', function (done) {
      const v1Result = {
        lag: 'daily',
        date: queryDate,
        data: {
          user_counts: { total: [], new: [] },
          max_confirmation_months: [],
        },
      }
      this.request.callsArgWith(1, null, { statusCode: 201 }, v1Result)
      this.InstitutionsAPI.getLicencesForAnalytics(
        lag,
        queryDate,
        (error, result) => {
          expect(error).not.to.exist
          const requestOptions = this.request.lastCall.args[0]
          expect(requestOptions.body.query_date).to.equal(queryDate)
          expect(requestOptions.body.lag).to.equal(lag)
          requestOptions.method.should.equal('GET')
          done()
        }
      )
    })
    it('should handle errors', function (done) {
      this.request.callsArgWith(1, null, { statusCode: 500 })
      this.InstitutionsAPI.getLicencesForAnalytics(
        lag,
        queryDate,
        (error, result) => {
          expect(error).to.be.instanceof(Errors.V1ConnectionError)
          done()
        }
      )
    })
  })

  describe('getUserAffiliations', function () {
    it('get affiliations', function (done) {
      const responseBody = [{ foo: 'bar' }]
      this.request.callsArgWith(1, null, { statusCode: 201 }, responseBody)
      this.InstitutionsAPI.getUserAffiliations(
        this.stubbedUser._id,
        (err, body) => {
          expect(err).not.to.exist
          this.request.calledOnce.should.equal(true)
          const requestOptions = this.request.lastCall.args[0]
          const expectedUrl = `v1.url/api/v2/users/${this.stubbedUser._id}/affiliations`
          requestOptions.url.should.equal(expectedUrl)
          requestOptions.method.should.equal('GET')
          requestOptions.maxAttempts.should.equal(3)
          expect(requestOptions.body).not.to.exist
          body.should.equal(responseBody)
          done()
        }
      )
    })

    it('handle error', function (done) {
      const body = { errors: 'affiliation error message' }
      this.request.callsArgWith(1, null, { statusCode: 503 }, body)
      this.InstitutionsAPI.getUserAffiliations(this.stubbedUser._id, err => {
        expect(err).to.be.instanceof(Errors.V1ConnectionError)
        done()
      })
    })

    it('handle empty response', function (done) {
      this.settings.apis.v1.url = ''
      this.InstitutionsAPI.getUserAffiliations(
        this.stubbedUser._id,
        (err, body) => {
          expect(err).not.to.exist
          expect(body).to.be.a('Array')
          body.length.should.equal(0)
          done()
        }
      )
    })
  })

  describe('getUsersNeedingReconfirmationsLapsedProcessed', function () {
    it('get the list of users', function (done) {
      this.fetchJson.resolves({ statusCode: 200 })
      this.InstitutionsAPI.getUsersNeedingReconfirmationsLapsedProcessed(
        error => {
          expect(error).not.to.exist
          this.fetchJson.calledOnce.should.equal(true)
          const requestOptions = this.fetchJson.lastCall.args[1]
          const expectedUrl = `v1.url/api/v2/institutions/need_reconfirmation_lapsed_processed`
          this.fetchJson.lastCall.args[0].should.equal(expectedUrl)
          requestOptions.method.should.equal('GET')
          done()
        }
      )
    })

    it('handle error', function (done) {
      this.fetchJson.throws({ info: { statusCode: 500 } })
      this.InstitutionsAPI.getUsersNeedingReconfirmationsLapsedProcessed(
        error => {
          expect(error).to.exist
          done()
        }
      )
    })
  })

  describe('addAffiliation', function () {
    beforeEach(function () {
      this.fetchNothing.resolves({ status: 201 })
    })

    it('add affiliation', function (done) {
      const affiliationOptions = {
        university: { id: 1 },
        department: 'Math',
        role: 'Prof',
        confirmedAt: new Date(),
        entitlement: true,
      }
      this.InstitutionsAPI.addAffiliation(
        this.stubbedUser._id,
        this.newEmail,
        affiliationOptions,
        err => {
          expect(err).not.to.exist
          this.fetchNothing.calledOnce.should.equal(true)
          const requestOptions = this.fetchNothing.lastCall.args[1]
          const expectedUrl = `v1.url/api/v2/users/${this.stubbedUser._id}/affiliations`
          expect(this.fetchNothing.lastCall.args[0]).to.equal(expectedUrl)
          requestOptions.method.should.equal('POST')

          const { json } = requestOptions
          Object.keys(json).length.should.equal(7)
          expect(json).to.deep.equal(
            Object.assign(
              { email: this.newEmail, rejectIfBlocklisted: undefined },
              affiliationOptions
            )
          )
          this.markAsReadIpMatcher.calledOnce.should.equal(true)
          done()
        }
      )
    })

    it('handles 422 error', function (done) {
      const messageFromApi = 'affiliation error message'
      const body = JSON.stringify({ errors: messageFromApi })
      this.fetchNothing.throws({ response: { status: 422 }, body })
      this.InstitutionsAPI.addAffiliation(
        this.stubbedUser._id,
        this.newEmail,
        {},
        err => {
          expect(err).to.exist
          expect(err).to.be.instanceOf(Errors.InvalidInstitutionalEmailError)
          err.message.should.have.string(422)
          err.message.should.have.string(messageFromApi)
          done()
        }
      )
    })

    it('handles 500 error', function (done) {
      const body = { errors: 'affiliation error message' }
      this.fetchNothing.throws({ response: { status: 500 }, body })
      this.InstitutionsAPI.addAffiliation(
        this.stubbedUser._id,
        this.newEmail,
        {},
        err => {
          expect(err).to.be.instanceOf(Errors.V1ConnectionError)
          expect(err.message).to.equal('error getting affiliations from v1')
          expect(err.info).to.deep.equal({ status: 500, body })
          done()
        }
      )
    })

    it('uses default error message when no error body in response', function (done) {
      this.fetchNothing.throws({ response: { status: 429 } })
      this.InstitutionsAPI.addAffiliation(
        this.stubbedUser._id,
        this.newEmail,
        {},
        err => {
          expect(err).to.exist
          expect(err.message).to.equal("Couldn't create affiliation: 429")
          done()
        }
      )
    })

    it('does not try to mark IP matcher notifications as read if no university passed', function (done) {
      const affiliationOptions = {
        confirmedAt: new Date(),
      }

      this.InstitutionsAPI.addAffiliation(
        this.stubbedUser._id,
        this.newEmail,
        affiliationOptions,
        err => {
          expect(err).not.to.exist
          expect(this.markAsReadIpMatcher.callCount).to.equal(0)
          done()
        }
      )
    })
  })

  describe('removeAffiliation', function () {
    beforeEach(function () {
      this.fetchNothing.throws({ response: { status: 404 } })
    })

    it('remove affiliation', function (done) {
      this.InstitutionsAPI.removeAffiliation(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          expect(err).not.to.exist
          this.fetchNothing.calledOnce.should.equal(true)
          const requestOptions = this.fetchNothing.lastCall.args[1]
          const expectedUrl = `v1.url/api/v2/users/${this.stubbedUser._id}/affiliations/remove`
          this.fetchNothing.lastCall.args[0].should.equal(expectedUrl)
          requestOptions.method.should.equal('POST')
          expect(requestOptions.json).to.deep.equal({ email: this.newEmail })
          done()
        }
      )
    })

    it('handle error', function (done) {
      this.fetchNothing.throws({ response: { status: 500 } })
      this.InstitutionsAPI.removeAffiliation(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          expect(err).to.exist
          err.message.should.exist
          done()
        }
      )
    })
  })

  describe('deleteAffiliations', function () {
    it('delete affiliations', function (done) {
      this.request.callsArgWith(1, null, { statusCode: 200 })
      this.InstitutionsAPI.deleteAffiliations(this.stubbedUser._id, err => {
        expect(err).not.to.exist
        this.request.calledOnce.should.equal(true)
        const requestOptions = this.request.lastCall.args[0]
        const expectedUrl = `v1.url/api/v2/users/${this.stubbedUser._id}/affiliations`
        requestOptions.url.should.equal(expectedUrl)
        requestOptions.method.should.equal('DELETE')
        done()
      })
    })

    it('handle error', function (done) {
      const body = { errors: 'affiliation error message' }
      this.request.callsArgWith(1, null, { statusCode: 518 }, body)
      this.InstitutionsAPI.deleteAffiliations(this.stubbedUser._id, err => {
        expect(err).to.be.instanceof(Errors.V1ConnectionError)
        done()
      })
    })
  })

  describe('endorseAffiliation', function () {
    beforeEach(function () {
      this.request.callsArgWith(1, null, { statusCode: 204 })
    })

    it('endorse affiliation', function (done) {
      this.InstitutionsAPI.endorseAffiliation(
        this.stubbedUser._id,
        this.newEmail,
        'Student',
        'Physics',
        err => {
          expect(err).not.to.exist
          this.request.calledOnce.should.equal(true)
          const requestOptions = this.request.lastCall.args[0]
          const expectedUrl = `v1.url/api/v2/users/${this.stubbedUser._id}/affiliations/endorse`
          requestOptions.url.should.equal(expectedUrl)
          requestOptions.method.should.equal('POST')

          const { body } = requestOptions
          Object.keys(body).length.should.equal(3)
          body.email.should.equal(this.newEmail)
          body.role.should.equal('Student')
          body.department.should.equal('Physics')
          done()
        }
      )
    })
  })

  describe('sendUsersWithReconfirmationsLapsedProcessed', function () {
    const users = ['abc123', 'def456']

    it('sends the list of users', function (done) {
      this.request.callsArgWith(1, null, { statusCode: 200 })
      this.InstitutionsAPI.sendUsersWithReconfirmationsLapsedProcessed(
        users,
        error => {
          expect(error).not.to.exist
          this.request.calledOnce.should.equal(true)
          const requestOptions = this.request.lastCall.args[0]
          const expectedUrl =
            'v1.url/api/v2/institutions/reconfirmation_lapsed_processed'
          requestOptions.url.should.equal(expectedUrl)
          requestOptions.method.should.equal('POST')
          expect(requestOptions.body).to.deep.equal({ users })
          done()
        }
      )
    })

    it('handle error', function (done) {
      this.request.callsArgWith(1, null, { statusCode: 500 })
      this.InstitutionsAPI.sendUsersWithReconfirmationsLapsedProcessed(
        users,
        error => {
          expect(error).to.exist
          done()
        }
      )
    })
  })
})
