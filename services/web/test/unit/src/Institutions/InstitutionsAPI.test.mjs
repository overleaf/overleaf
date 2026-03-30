import { vi, expect } from 'vitest'
import path from 'node:path'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
import Errors from '../../../../app/src/Features/Errors/Errors.js'

const modulePath = path.join(
  import.meta.dirname,
  '../../../../app/src/Features/Institutions/InstitutionsAPI'
)
const { ObjectId } = mongodb
vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)

describe('InstitutionsAPI', function () {
  beforeEach(async function (ctx) {
    ctx.settings = {
      apis: { v1: { url: 'v1.url', user: '', pass: '', timeout: 5000 } },
    }

    ctx.ipMatcherNotification = {
      read: (ctx.markAsReadIpMatcher = sinon.stub().resolves()),
    }

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock('@overleaf/fetch-utils', () => ({
      fetchNothing: (ctx.fetchNothing = sinon.stub()),
      fetchJson: (ctx.fetchJson = sinon.stub()),
    }))

    vi.doMock(
      '../../../../app/src/Features/Notifications/NotificationsBuilder',
      () => ({
        default: {
          promises: {
            ipMatcherAffiliation: sinon
              .stub()
              .returns(ctx.ipMatcherNotification),
          },
        },
      })
    )

    vi.doMock('../../../../app/src/infrastructure/Modules', () => ({
      default: (ctx.Modules = {
        promises: {
          hooks: {
            fire: sinon.stub(),
          },
        },
      }),
    }))

    ctx.InstitutionsAPI = (await import(modulePath)).default

    ctx.stubbedUser = {
      _id: '3131231',
      name: 'bob',
      email: 'hello@world.com',
    }
    ctx.newEmail = 'bob@bob.com'
  })

  describe('getInstitutionAffiliations', function () {
    it('get affiliations', async function (ctx) {
      ctx.institutionId = 123
      const responseBody = ['123abc', '456def']
      ctx.fetchJson.resolves(responseBody)
      const body =
        await ctx.InstitutionsAPI.promises.getInstitutionAffiliations(
          ctx.institutionId
        )

      ctx.fetchJson.calledOnce.should.equal(true)
      const expectedUrl = `v1.url/api/v2/institutions/${ctx.institutionId}/affiliations`
      ctx.fetchJson.lastCall.args[0].should.equal(expectedUrl)
      const requestOptions = ctx.fetchJson.lastCall.args[1]
      requestOptions.method.should.equal('GET')
      expect(requestOptions.json).not.to.exist
      body.should.equal(responseBody)
    })

    it('handle empty response', async function (ctx) {
      ctx.institutionId = 123
      ctx.settings.apis.v1.url = ''

      const body =
        await ctx.InstitutionsAPI.promises.getInstitutionAffiliations(
          ctx.institutionId
        )
      expect(body).to.be.a('Array')
      body.length.should.equal(0)
    })
  })

  describe('getLicencesForAnalytics', function () {
    const lag = 'daily'
    const queryDate = '2017-01-07:00:00.000Z'
    it('should send the request to v1', async function (ctx) {
      const v1Result = {
        lag: 'daily',
        date: queryDate,
        data: {
          user_counts: { total: [], new: [] },
          max_confirmation_months: [],
        },
      }
      ctx.fetchJson.resolves(v1Result)
      await ctx.InstitutionsAPI.promises.getLicencesForAnalytics(lag, queryDate)
      const expectedUrl = `v1.url/api/v2/institutions/institutions_licences`
      ctx.fetchJson.lastCall.args[0].should.equal(expectedUrl)
      const requestOptions = ctx.fetchJson.lastCall.args[1]
      expect(requestOptions.json.query_date).to.equal(queryDate)
      expect(requestOptions.json.lag).to.equal(lag)
      requestOptions.method.should.equal('GET')
    })
    it('should handle errors', async function (ctx) {
      ctx.fetchJson.throws({ response: { status: 500 } })
      let error

      try {
        await ctx.InstitutionsAPI.promises.getLicencesForAnalytics(
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
    it('get affiliations with commons', async function (ctx) {
      const responseBody = [
        {
          foo: 'bar',
          institution: {
            commonsAccount: true,
            confirmed: true,
          },
        },
      ]
      ctx.fetchJson.resolves(responseBody)
      const body = await ctx.InstitutionsAPI.promises.getUserAffiliations(
        ctx.stubbedUser._id
      )
      ctx.fetchJson.calledOnce.should.equal(true)
      const expectedUrl = `v1.url/api/v2/users/${ctx.stubbedUser._id}/affiliations`
      ctx.fetchJson.lastCall.args[0].should.equal(expectedUrl)
      const requestOptions = ctx.fetchJson.lastCall.args[1]
      requestOptions.method.should.equal('GET')
      ctx.Modules.promises.hooks.fire.should.have.been.called
      expect(requestOptions.json).not.to.exist
      expect(body).to.deep.equal(responseBody)
    })

    it('get affiliations with domain capture for groups', async function (ctx) {
      const responseBody = [
        {
          id: '123abc',
          foo: 'bar',
          institution: {
            id: 'test-institution-id',
            commonsAccount: false,
            confirmed: true,
          },
        },
      ]
      ctx.fetchJson.resolves(responseBody)
      const groupResponse = {
        _id: new ObjectId(),
        managedUsersEnabled: false,
        domainCaptureEnabled: true,
      }
      ctx.Modules.promises.hooks.fire
        .withArgs(
          'getGroupWithDomainCaptureByV1Id',
          responseBody[0].institution.id
        )
        .resolves([groupResponse])
      const body = await ctx.InstitutionsAPI.promises.getUserAffiliations(
        ctx.stubbedUser._id
      )
      ctx.fetchJson.calledOnce.should.equal(true)
      const expectedUrl = `v1.url/api/v2/users/${ctx.stubbedUser._id}/affiliations`
      ctx.fetchJson.lastCall.args[0].should.equal(expectedUrl)
      const requestOptions = ctx.fetchJson.lastCall.args[1]
      requestOptions.method.should.equal('GET')
      ctx.Modules.promises.hooks.fire.should.have.been.calledWith(
        'getGroupWithDomainCaptureByV1Id',
        responseBody[0].institution.id
      )
      expect(requestOptions.json).not.to.exist
      expect(body).to.deep.equal([
        {
          ...responseBody[0],
          group: {
            ...groupResponse,
          },
        },
      ])
    })

    it('does not query for group with domain capture if domain is not confirmed', async function (ctx) {
      const responseBody = [
        {
          id: '123abc',
          foo: 'bar',
          institution: {
            commonsAccount: false,
            confirmed: false,
          },
        },
      ]
      ctx.fetchJson.resolves(responseBody)

      const body = await ctx.InstitutionsAPI.promises.getUserAffiliations(
        ctx.stubbedUser._id
      )
      ctx.fetchJson.calledOnce.should.equal(true)
      const expectedUrl = `v1.url/api/v2/users/${ctx.stubbedUser._id}/affiliations`
      ctx.fetchJson.lastCall.args[0].should.equal(expectedUrl)
      const requestOptions = ctx.fetchJson.lastCall.args[1]
      requestOptions.method.should.equal('GET')
      ctx.Modules.promises.hooks.fire.should.not.have.been.called
      expect(requestOptions.json).not.to.exist
      expect(body).to.deep.equal([
        {
          ...responseBody[0],
        },
      ])
    })

    it('handle error', async function (ctx) {
      ctx.fetchJson.throws({ response: { status: 503 } })
      let error

      try {
        await ctx.InstitutionsAPI.promises.getUserAffiliations(
          ctx.stubbedUser._id
        )
      } catch (err) {
        error = err
      }

      expect(error).to.be.instanceOf(Errors.V1ConnectionError)
    })

    it('handle empty response', async function (ctx) {
      ctx.settings.apis.v1.url = ''
      const body = await ctx.InstitutionsAPI.promises.getUserAffiliations(
        ctx.stubbedUser._id
      )
      expect(body).to.be.a('Array')
      body.length.should.equal(0)
    })
  })

  describe('getUsersNeedingReconfirmationsLapsedProcessed', function () {
    it('get the list of users', async function (ctx) {
      ctx.fetchJson.resolves({})
      await ctx.InstitutionsAPI.promises.getUsersNeedingReconfirmationsLapsedProcessed()
      ctx.fetchJson.calledOnce.should.equal(true)
      const expectedUrl = `v1.url/api/v2/institutions/need_reconfirmation_lapsed_processed`
      ctx.fetchJson.lastCall.args[0].should.equal(expectedUrl)
      const requestOptions = ctx.fetchJson.lastCall.args[1]
      requestOptions.method.should.equal('GET')
    })

    it('handle error', async function (ctx) {
      ctx.fetchJson.throws({ response: { status: 500 } })
      await expect(
        ctx.InstitutionsAPI.promises.getUsersNeedingReconfirmationsLapsedProcessed()
      ).to.be.rejected
    })
  })

  describe('addAffiliation', function () {
    beforeEach(function (ctx) {
      ctx.fetchNothing.resolves()
    })

    it('add affiliation', async function (ctx) {
      const affiliationOptions = {
        university: { id: 1 },
        department: 'Math',
        role: 'Prof',
        confirmedAt: new Date(),
        entitlement: true,
      }
      await ctx.InstitutionsAPI.promises.addAffiliation(
        ctx.stubbedUser._id,
        ctx.newEmail,
        affiliationOptions
      )
      ctx.fetchNothing.calledOnce.should.equal(true)
      const expectedUrl = `v1.url/api/v2/users/${ctx.stubbedUser._id}/affiliations`
      expect(ctx.fetchNothing.lastCall.args[0]).to.equal(expectedUrl)
      const requestOptions = ctx.fetchNothing.lastCall.args[1]
      requestOptions.method.should.equal('POST')

      const { json } = requestOptions
      Object.keys(json).length.should.equal(7)
      expect(json).to.deep.equal(
        Object.assign(
          { email: ctx.newEmail, rejectIfBlocklisted: undefined },
          affiliationOptions
        )
      )
      ctx.markAsReadIpMatcher.calledOnce.should.equal(true)
    })

    it('handles 422 error', async function (ctx) {
      const messageFromApi = 'affiliation error message'
      const body = JSON.stringify({ errors: messageFromApi })
      ctx.fetchNothing.throws({ response: { status: 422 }, body })
      let error

      try {
        await ctx.InstitutionsAPI.promises.addAffiliation(
          ctx.stubbedUser._id,
          ctx.newEmail,
          {}
        )
      } catch (err) {
        error = err
      }

      expect(error).to.be.instanceOf(Errors.InvalidInstitutionalEmailError)
      expect(error).to.have.property('message', `422: ${messageFromApi}`)
    })

    it('handles 500 error', async function (ctx) {
      const body = { errors: 'affiliation error message' }
      ctx.fetchNothing.throws({ response: { status: 500 }, body })
      let error

      try {
        await ctx.InstitutionsAPI.promises.addAffiliation(
          ctx.stubbedUser._id,
          ctx.newEmail,
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

    it('uses default error message when no error body in response', async function (ctx) {
      ctx.fetchNothing.throws({ response: { status: 429 } })
      let error

      try {
        await ctx.InstitutionsAPI.promises.addAffiliation(
          ctx.stubbedUser._id,
          ctx.newEmail,
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

    it('does not try to mark IP matcher notifications as read if no university passed', async function (ctx) {
      const affiliationOptions = {
        confirmedAt: new Date(),
      }

      await ctx.InstitutionsAPI.promises.addAffiliation(
        ctx.stubbedUser._id,
        ctx.newEmail,
        affiliationOptions
      )

      expect(ctx.markAsReadIpMatcher.callCount).to.equal(0)
    })
  })

  describe('removeAffiliation', function () {
    beforeEach(function (ctx) {
      ctx.fetchNothing.throws({ response: { status: 404 } })
    })

    it('remove affiliation', async function (ctx) {
      await ctx.InstitutionsAPI.promises.removeAffiliation(
        ctx.stubbedUser._id,
        ctx.newEmail
      )
      ctx.fetchNothing.calledOnce.should.equal(true)
      const expectedUrl = `v1.url/api/v2/users/${ctx.stubbedUser._id}/affiliations/remove`
      ctx.fetchNothing.lastCall.args[0].should.equal(expectedUrl)
      const requestOptions = ctx.fetchNothing.lastCall.args[1]
      requestOptions.method.should.equal('POST')
      expect(requestOptions.json).to.deep.equal({ email: ctx.newEmail })
    })

    it('handle error', async function (ctx) {
      ctx.fetchNothing.throws({ response: { status: 500 } })
      let error

      try {
        await ctx.InstitutionsAPI.promises.removeAffiliation(
          ctx.stubbedUser._id,
          ctx.newEmail
        )
      } catch (err) {
        error = err
      }

      expect(error).to.exist
      expect(error).to.have.property('message')
    })
  })

  describe('deleteAffiliations', function () {
    it('delete affiliations', async function (ctx) {
      ctx.fetchNothing.resolves()
      await ctx.InstitutionsAPI.promises.deleteAffiliations(ctx.stubbedUser._id)
      ctx.fetchNothing.calledOnce.should.equal(true)
      const expectedUrl = `v1.url/api/v2/users/${ctx.stubbedUser._id}/affiliations`
      ctx.fetchNothing.lastCall.args[0].should.equal(expectedUrl)
      const requestOptions = ctx.fetchNothing.lastCall.args[1]
      requestOptions.method.should.equal('DELETE')
    })

    it('handle error', async function (ctx) {
      ctx.fetchNothing.throws({ response: { status: 518 } })
      let error

      try {
        await ctx.InstitutionsAPI.promises.deleteAffiliations(
          ctx.stubbedUser._id
        )
      } catch (err) {
        error = err
      }

      expect(error).to.be.instanceOf(Errors.V1ConnectionError)
    })
  })

  describe('endorseAffiliation', function () {
    beforeEach(function (ctx) {
      ctx.fetchNothing.resolves()
    })

    it('endorse affiliation', async function (ctx) {
      await ctx.InstitutionsAPI.promises.endorseAffiliation(
        ctx.stubbedUser._id,
        ctx.newEmail,
        'Student',
        'Physics'
      )
      ctx.fetchNothing.calledOnce.should.equal(true)
      const expectedUrl = `v1.url/api/v2/users/${ctx.stubbedUser._id}/affiliations/endorse`
      ctx.fetchNothing.lastCall.args[0].should.equal(expectedUrl)
      const requestOptions = ctx.fetchNothing.lastCall.args[1]
      requestOptions.method.should.equal('POST')

      const { json } = requestOptions
      Object.keys(json).length.should.equal(3)
      json.email.should.equal(ctx.newEmail)
      json.role.should.equal('Student')
      json.department.should.equal('Physics')
    })
  })

  describe('sendUsersWithReconfirmationsLapsedProcessed', function () {
    const users = ['abc123', 'def456']

    it('sends the list of users', async function (ctx) {
      ctx.fetchNothing.resolves()
      await ctx.InstitutionsAPI.promises.sendUsersWithReconfirmationsLapsedProcessed(
        users
      )
      ctx.fetchNothing.calledOnce.should.equal(true)
      const expectedUrl =
        'v1.url/api/v2/institutions/reconfirmation_lapsed_processed'
      ctx.fetchNothing.lastCall.args[0].should.equal(expectedUrl)
      const requestOptions = ctx.fetchNothing.lastCall.args[1]
      requestOptions.method.should.equal('POST')
      expect(requestOptions.json).to.deep.equal({ users })
    })

    it('handle error', async function (ctx) {
      ctx.fetchNothing.throws({ response: { status: 500 } })
      let error

      try {
        await ctx.InstitutionsAPI.promises.sendUsersWithReconfirmationsLapsedProcessed(
          users
        )
      } catch (err) {
        error = err
      }

      expect(error).to.exist
    })
  })
})
