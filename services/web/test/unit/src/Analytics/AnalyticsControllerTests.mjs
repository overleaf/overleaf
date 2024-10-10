import esmock from 'esmock'
import sinon from 'sinon'
import MockResponse from '../helpers/MockResponse.js'
const modulePath = new URL(
  '../../../../app/src/Features/Analytics/AnalyticsController.mjs',
  import.meta.url
).pathname

describe('AnalyticsController', function () {
  beforeEach(async function () {
    this.SessionManager = { getLoggedInUserId: sinon.stub() }

    this.AnalyticsManager = {
      updateEditingSession: sinon.stub(),
      recordEventForSession: sinon.stub(),
    }

    this.Features = {
      hasFeature: sinon.stub().returns(true),
    }

    this.controller = await esmock.strict(modulePath, {
      '../../../../app/src/Features/Analytics/AnalyticsManager.js':
        this.AnalyticsManager,
      '../../../../app/src/Features/Authentication/SessionManager.js':
        this.SessionManager,
      '../../../../app/src/infrastructure/Features.js': this.Features,
      '../../../../app/src/infrastructure/GeoIpLookup.js': (this.GeoIpLookup = {
        promises: {
          getDetails: sinon.stub().resolves(),
        },
      }),
    })

    this.res = new MockResponse()
  })

  describe('updateEditingSession', function () {
    beforeEach(function () {
      this.req = {
        params: {
          projectId: 'a project id',
        },
        session: {},
        body: {
          segmentation: {
            editorType: 'abc',
          },
        },
      }
      this.GeoIpLookup.promises.getDetails = sinon
        .stub()
        .resolves({ country_code: 'XY' })
    })

    it('delegates to the AnalyticsManager', function (done) {
      this.SessionManager.getLoggedInUserId.returns('1234')
      this.res.callback = () => {
        sinon.assert.calledWith(
          this.AnalyticsManager.updateEditingSession,
          '1234',
          'a project id',
          'XY',
          { editorType: 'abc' }
        )
        done()
      }
      this.controller.updateEditingSession(this.req, this.res)
    })
  })

  describe('recordEvent', function () {
    beforeEach(function () {
      const body = {
        foo: 'stuff',
        _csrf: 'atoken123',
      }
      this.req = {
        params: {
          event: 'i_did_something',
        },
        body,
        sessionID: 'sessionIDHere',
        session: {},
      }

      this.expectedData = Object.assign({}, body)
      delete this.expectedData._csrf
    })

    it('should use the session', function (done) {
      this.controller.recordEvent(this.req, this.res)
      sinon.assert.calledWith(
        this.AnalyticsManager.recordEventForSession,
        this.req.session,
        this.req.params.event,
        this.expectedData
      )
      done()
    })

    it('should remove the CSRF token before sending to the manager', function (done) {
      this.controller.recordEvent(this.req, this.res)
      sinon.assert.calledWith(
        this.AnalyticsManager.recordEventForSession,
        this.req.session,
        this.req.params.event,
        this.expectedData
      )
      done()
    })
  })
})
