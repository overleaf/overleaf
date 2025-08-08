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
        '../../infrastructure/Modules': (this.Modules = {
          promises: {
            hooks: {
              fire: sinon.stub(),
            },
          },
        }),
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
    it('get affiliations', async function () {
      this.institutionId = 123
      const responseBody = ['123abc', '456def']
      this.request.yields(null, { statusCode: 200 }, responseBody)
      const body =
        await this.InstitutionsAPI.promises.getInstitutionAffiliations(
          this.institutionId
        )

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
    })

    it('handle empty response', async function () {
      this.settings.apis.v1.url = ''

      const body =
        await this.InstitutionsAPI.promises.getInstitutionAffiliations(
          this.institutionId
        )
      expect(body).to.be.a('Array')
      body.length.should.equal(0)
    })
  })

  describe('getLicencesForAnalytics', function () {
    const lag = 'daily'
    const queryDate = '2017-01-07:00:00.000Z'
    it('should send the request to v1', async function () {
      const v1Result = {
        lag: 'daily',
        date: queryDate,
        data: {
          user_counts: { total: [], new: [] },
          max_confirmation_months: [],
        },
      }
      this.request.callsArgWith(1, null, { statusCode: 201 }, v1Result)
      await this.InstitutionsAPI.promises.getLicencesForAnalytics(
        lag,
        queryDate
      )
      const requestOptions = this.request.lastCall.args[0]
      expect(requestOptions.body.query_date).to.equal(queryDate)
      expect(requestOptions.body.lag).to.equal(lag)
      requestOptions.method.should.equal('GET')
    })
    it('should handle errors', async function () {
      this.request.callsArgWith(1, null, { statusCode: 500 })
      let error

      try {
        await this.InstitutionsAPI.promises.getLicencesForAnalytics(
          lag,
          queryDate
        )
      } catch (err) {
        error = err
      }

      expect(error).to.be.instanceOf(Errors.V1ConnectionError)
    })
  })

  describe('getUserAffiliations', function () {
    it('get affiliations with commons', async function () {
      const responseBody = [
        {
          foo: 'bar',
          institution: {
            commonsAccount: true,
          },
        },
      ]
      this.request.callsArgWith(1, null, { statusCode: 201 }, responseBody)
      const body = await this.InstitutionsAPI.promises.getUserAffiliations(
        this.stubbedUser._id
      )
      this.request.calledOnce.should.equal(true)
      const requestOptions = this.request.lastCall.args[0]
      const expectedUrl = `v1.url/api/v2/users/${this.stubbedUser._id}/affiliations`
      requestOptions.url.should.equal(expectedUrl)
      requestOptions.method.should.equal('GET')
      requestOptions.maxAttempts.should.equal(3)
      this.Modules.promises.hooks.fire.should.not.have.been.called
      expect(requestOptions.body).not.to.exist
      expect(body).to.deep.equal(responseBody)
    })

    it('get affiliations with domain capture for groups', async function () {
      const responseBody = [
        {
          id: '123abc',
          foo: 'bar',
          institution: {
            commonsAccount: false,
          },
        },
      ]
      this.request.callsArgWith(1, null, { statusCode: 201 }, responseBody)
      this.Modules.promises.hooks.fire.resolves([
        { domainCaptureEnabled: true },
      ])
      const body = await this.InstitutionsAPI.promises.getUserAffiliations(
        this.stubbedUser._id
      )
      this.request.calledOnce.should.equal(true)
      const requestOptions = this.request.lastCall.args[0]
      const expectedUrl = `v1.url/api/v2/users/${this.stubbedUser._id}/affiliations`
      requestOptions.url.should.equal(expectedUrl)
      requestOptions.method.should.equal('GET')
      requestOptions.maxAttempts.should.equal(3)
      this.Modules.promises.hooks.fire.should.have.been.calledWith(
        'getGroupWithDomainCaptureByV1Id',
        responseBody[0].institution.id
      )
      expect(requestOptions.body).not.to.exist
      expect(body).to.deep.equal([
        { ...responseBody[0], group: { domainCaptureEnabled: true } },
      ])
    })

    it('handle error', async function () {
      const body = { errors: 'affiliation error message' }
      this.request.callsArgWith(1, null, { statusCode: 503 }, body)
      let error

      try {
        await this.InstitutionsAPI.promises.getUserAffiliations(
          this.stubbedUser._id
        )
      } catch (err) {
        error = err
      }

      expect(error).to.be.instanceOf(Errors.V1ConnectionError)
    })

    it('handle empty response', async function () {
      this.settings.apis.v1.url = ''
      const body = await this.InstitutionsAPI.promises.getUserAffiliations(
        this.stubbedUser._id
      )
      expect(body).to.be.a('Array')
      body.length.should.equal(0)
    })
  })

  describe('getUsersNeedingReconfirmationsLapsedProcessed', function () {
    it('get the list of users', async function () {
      this.fetchJson.resolves({ statusCode: 200 })
      await this.InstitutionsAPI.promises.getUsersNeedingReconfirmationsLapsedProcessed()
      this.fetchJson.calledOnce.should.equal(true)
      const requestOptions = this.fetchJson.lastCall.args[1]
      const expectedUrl = `v1.url/api/v2/institutions/need_reconfirmation_lapsed_processed`
      this.fetchJson.lastCall.args[0].should.equal(expectedUrl)
      requestOptions.method.should.equal('GET')
    })

    it('handle error', async function () {
      this.fetchJson.throws({ info: { statusCode: 500 } })
      await expect(
        this.InstitutionsAPI.promises.getUsersNeedingReconfirmationsLapsedProcessed()
      ).to.be.rejected
    })
  })

  describe('addAffiliation', function () {
    beforeEach(function () {
      this.fetchNothing.resolves({ status: 201 })
    })

    it('add affiliation', async function () {
      const affiliationOptions = {
        university: { id: 1 },
        department: 'Math',
        role: 'Prof',
        confirmedAt: new Date(),
        entitlement: true,
      }
      await this.InstitutionsAPI.promises.addAffiliation(
        this.stubbedUser._id,
        this.newEmail,
        affiliationOptions
      )
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
    })

    it('handles 422 error', async function () {
      const messageFromApi = 'affiliation error message'
      const body = JSON.stringify({ errors: messageFromApi })
      this.fetchNothing.throws({ response: { status: 422 }, body })
      let error

      try {
        await this.InstitutionsAPI.promises.addAffiliation(
          this.stubbedUser._id,
          this.newEmail,
          {}
        )
      } catch (err) {
        error = err
      }

      expect(error).to.be.instanceOf(Errors.InvalidInstitutionalEmailError)
      expect(error).to.have.property('message', `422: ${messageFromApi}`)
    })

    it('handles 500 error', async function () {
      const body = { errors: 'affiliation error message' }
      this.fetchNothing.throws({ response: { status: 500 }, body })
      let error

      try {
        await this.InstitutionsAPI.promises.addAffiliation(
          this.stubbedUser._id,
          this.newEmail,
          {}
        )
      } catch (err) {
        error = err
      }

      expect(error).to.be.instanceOf(Errors.V1ConnectionError)
      expect(error.message).to.equal('error getting affiliations from v1')
      expect(error.info).to.eql({
        status: 500,
        body: { errors: 'affiliation error message' },
      })
    })

    it('uses default error message when no error body in response', async function () {
      this.fetchNothing.throws({ response: { status: 429 } })
      let error

      try {
        await this.InstitutionsAPI.promises.addAffiliation(
          this.stubbedUser._id,
          this.newEmail,
          {}
        )
      } catch (err) {
        error = err
      }

      expect(error).to.be.instanceOf(Error)
      expect(error).to.have.property(
        'message',
        "Couldn't create affiliation: 429"
      )
    })

    it('does not try to mark IP matcher notifications as read if no university passed', async function () {
      const affiliationOptions = {
        confirmedAt: new Date(),
      }

      await this.InstitutionsAPI.promises.addAffiliation(
        this.stubbedUser._id,
        this.newEmail,
        affiliationOptions
      )

      expect(this.markAsReadIpMatcher.callCount).to.equal(0)
    })
  })

  describe('removeAffiliation', function () {
    beforeEach(function () {
      this.fetchNothing.throws({ response: { status: 404 } })
    })

    it('remove affiliation', async function () {
      await this.InstitutionsAPI.promises.removeAffiliation(
        this.stubbedUser._id,
        this.newEmail
      )
      this.fetchNothing.calledOnce.should.equal(true)
      const requestOptions = this.fetchNothing.lastCall.args[1]
      const expectedUrl = `v1.url/api/v2/users/${this.stubbedUser._id}/affiliations/remove`
      this.fetchNothing.lastCall.args[0].should.equal(expectedUrl)
      requestOptions.method.should.equal('POST')
      expect(requestOptions.json).to.deep.equal({ email: this.newEmail })
    })

    it('handle error', async function () {
      this.fetchNothing.throws({ response: { status: 500 } })
      let error

      try {
        await this.InstitutionsAPI.promises.removeAffiliation(
          this.stubbedUser._id,
          this.newEmail
        )
      } catch (err) {
        error = err
      }

      expect(error).to.exist
      expect(error).to.have.property('message')
    })
  })

  describe('deleteAffiliations', function () {
    it('delete affiliations', async function () {
      this.request.callsArgWith(1, null, { statusCode: 200 })
      await this.InstitutionsAPI.promises.deleteAffiliations(
        this.stubbedUser._id
      )
      this.request.calledOnce.should.equal(true)
      const requestOptions = this.request.lastCall.args[0]
      const expectedUrl = `v1.url/api/v2/users/${this.stubbedUser._id}/affiliations`
      requestOptions.url.should.equal(expectedUrl)
      requestOptions.method.should.equal('DELETE')
    })

    it('handle error', async function () {
      const body = { errors: 'affiliation error message' }
      this.request.callsArgWith(1, null, { statusCode: 518 }, body)
      let error

      try {
        await this.InstitutionsAPI.promises.deleteAffiliations(
          this.stubbedUser._id
        )
      } catch (err) {
        error = err
      }

      expect(error).to.be.instanceOf(Errors.V1ConnectionError)
    })
  })

  describe('endorseAffiliation', function () {
    beforeEach(function () {
      this.request.callsArgWith(1, null, { statusCode: 204 })
    })

    it('endorse affiliation', async function () {
      await this.InstitutionsAPI.promises.endorseAffiliation(
        this.stubbedUser._id,
        this.newEmail,
        'Student',
        'Physics'
      )
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
    })
  })

  describe('sendUsersWithReconfirmationsLapsedProcessed', function () {
    const users = ['abc123', 'def456']

    it('sends the list of users', async function () {
      this.request.callsArgWith(1, null, { statusCode: 200 })
      await this.InstitutionsAPI.promises.sendUsersWithReconfirmationsLapsedProcessed(
        users
      )
      this.request.calledOnce.should.equal(true)
      const requestOptions = this.request.lastCall.args[0]
      const expectedUrl =
        'v1.url/api/v2/institutions/reconfirmation_lapsed_processed'
      requestOptions.url.should.equal(expectedUrl)
      requestOptions.method.should.equal('POST')
      expect(requestOptions.body).to.deep.equal({ users })
    })

    it('handle error', async function () {
      this.request.callsArgWith(1, null, { statusCode: 500 })
      let error

      try {
        await this.InstitutionsAPI.promises.sendUsersWithReconfirmationsLapsedProcessed(
          users
        )
      } catch (err) {
        error = err
      }

      expect(error).to.exist
    })
  })
})
