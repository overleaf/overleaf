const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')
const path = require('path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/Institutions/InstitutionsAPI'
)
const Errors = require('../../../../app/src/Features/Errors/Errors')

describe('InstitutionsAPI', function() {
  beforeEach(function() {
    this.settings = { apis: { v1: { url: 'v1.url', user: '', pass: '' } } }
    this.request = sinon.stub()
    this.ipMatcherNotification = {
      read: (this.markAsReadIpMatcher = sinon.stub().callsArgWith(1, null))
    }
    this.InstitutionsAPI = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/metrics': {
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
    this.newEmail = 'bob@bob.com'
  })

  describe('getInstitutionAffiliations', function() {
    it('get affiliations', function(done) {
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
          expect(requestOptions.body).not.to.exist
          body.should.equal(responseBody)
          done()
        }
      )
    })

    it('handle empty response', function(done) {
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
      this.InstitutionsAPI.getInstitutionLicences(
        this.institutionId,
        startDate,
        endDate,
        'monthly',
        (err, body) => {
          expect(err).not.to.exist
          this.request.calledOnce.should.equal(true)
          const requestOptions = this.request.lastCall.args[0]
          const expectedUrl = `v1.url/api/v2/institutions/${this.institutionId}/institution_licences`
          requestOptions.url.should.equal(expectedUrl)
          requestOptions.method.should.equal('GET')
          requestOptions.body.start_date.should.equal(startDate)
          requestOptions.body.end_date.should.equal(endDate)
          requestOptions.body.lag.should.equal('monthly')
          body.should.equal(responseBody)
          done()
        }
      )
    })
  })

  describe('getLicencesForAnalytics', function() {
    const lag = 'daily'
    const queryDate = '2017-01-07:00:00.000Z'
    it('should send the request to v1', function(done) {
      const v1Result = {
        lag: 'daily',
        date: queryDate,
        data: {
          user_counts: { total: [], new: [] },
          max_confirmation_months: []
        }
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
    it('should handle errors', function(done) {
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

  describe('getUserAffiliations', function() {
    it('get affiliations', function(done) {
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
          expect(requestOptions.body).not.to.exist
          body.should.equal(responseBody)
          done()
        }
      )
    })

    it('handle error', function(done) {
      const body = { errors: 'affiliation error message' }
      this.request.callsArgWith(1, null, { statusCode: 503 }, body)
      this.InstitutionsAPI.getUserAffiliations(this.stubbedUser._id, err => {
        expect(err).to.be.instanceof(Errors.V1ConnectionError)
        done()
      })
    })

    it('handle empty response', function(done) {
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

  describe('addAffiliation', function() {
    beforeEach(function() {
      this.request.callsArgWith(1, null, { statusCode: 201 })
    })

    it('add affiliation', function(done) {
      const affiliationOptions = {
        university: { id: 1 },
        role: 'Prof',
        department: 'Math',
        confirmedAt: new Date(),
        entitlement: true
      }
      this.InstitutionsAPI.addAffiliation(
        this.stubbedUser._id,
        this.newEmail,
        affiliationOptions,
        err => {
          expect(err).not.to.exist
          this.request.calledOnce.should.equal(true)
          const requestOptions = this.request.lastCall.args[0]
          const expectedUrl = `v1.url/api/v2/users/${this.stubbedUser._id}/affiliations`
          requestOptions.url.should.equal(expectedUrl)
          requestOptions.method.should.equal('POST')

          const { body } = requestOptions
          Object.keys(body).length.should.equal(7)
          body.email.should.equal(this.newEmail)
          body.university.should.equal(affiliationOptions.university)
          body.department.should.equal(affiliationOptions.department)
          body.role.should.equal(affiliationOptions.role)
          body.confirmedAt.should.equal(affiliationOptions.confirmedAt)
          body.entitlement.should.equal(affiliationOptions.entitlement)
          this.markAsReadIpMatcher.calledOnce.should.equal(true)
          done()
        }
      )
    })

    it('handle error', function(done) {
      const body = { errors: 'affiliation error message' }
      this.request.callsArgWith(1, null, { statusCode: 422 }, body)
      this.InstitutionsAPI.addAffiliation(
        this.stubbedUser._id,
        this.newEmail,
        {},
        err => {
          expect(err).to.exist
          err.message.should.have.string(422)
          err.message.should.have.string(body.errors)
          done()
        }
      )
    })
  })

  describe('removeAffiliation', function() {
    beforeEach(function() {
      this.request.callsArgWith(1, null, { statusCode: 404 })
    })

    it('remove affiliation', function(done) {
      this.InstitutionsAPI.removeAffiliation(
        this.stubbedUser._id,
        this.newEmail,
        err => {
          expect(err).not.to.exist
          this.request.calledOnce.should.equal(true)
          const requestOptions = this.request.lastCall.args[0]
          const expectedUrl = `v1.url/api/v2/users/${this.stubbedUser._id}/affiliations/remove`
          requestOptions.url.should.equal(expectedUrl)
          requestOptions.method.should.equal('POST')
          expect(requestOptions.body).to.deep.equal({ email: this.newEmail })
          done()
        }
      )
    })

    it('handle error', function(done) {
      this.request.callsArgWith(1, null, { statusCode: 500 })
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

  describe('deleteAffiliations', function() {
    it('delete affiliations', function(done) {
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

    it('handle error', function(done) {
      const body = { errors: 'affiliation error message' }
      this.request.callsArgWith(1, null, { statusCode: 518 }, body)
      this.InstitutionsAPI.deleteAffiliations(this.stubbedUser._id, err => {
        expect(err).to.be.instanceof(Errors.V1ConnectionError)
        done()
      })
    })
  })

  describe('endorseAffiliation', function() {
    beforeEach(function() {
      this.request.callsArgWith(1, null, { statusCode: 204 })
    })

    it('endorse affiliation', function(done) {
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
})
