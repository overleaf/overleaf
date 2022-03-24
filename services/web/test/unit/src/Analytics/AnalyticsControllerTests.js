const SandboxedModule = require('sandboxed-module')
const path = require('path')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/Analytics/AnalyticsController'
)
const sinon = require('sinon')

describe('AnalyticsController', function () {
  beforeEach(function () {
    this.SessionManager = { getLoggedInUserId: sinon.stub() }

    this.AnalyticsManager = {
      updateEditingSession: sinon.stub(),
      recordEventForSession: sinon.stub(),
    }

    this.Features = {
      hasFeature: sinon.stub().returns(true),
    }

    this.controller = SandboxedModule.require(modulePath, {
      requires: {
        './AnalyticsManager': this.AnalyticsManager,
        '../Authentication/SessionManager': this.SessionManager,
        '../../infrastructure/Features': this.Features,
        '../../infrastructure/GeoIpLookup': (this.GeoIpLookup = {
          promises: {
            getDetails: sinon.stub().resolves(),
          },
        }),
      },
    })

    this.res = {
      send() {},
      sendStatus() {},
    }
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

    it('delegates to the AnalyticsManager', async function () {
      this.SessionManager.getLoggedInUserId.returns('1234')
      await this.controller.updateEditingSession(this.req, this.res)
      sinon.assert.calledWith(
        this.AnalyticsManager.updateEditingSession,
        '1234',
        'a project id',
        'XY',
        { editorType: 'abc' }
      )
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
