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
      recordEvent: sinon.stub(),
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
          getDetails: sinon.stub(),
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
      }
      this.GeoIpLookup.getDetails = sinon
        .stub()
        .callsArgWith(1, null, { country_code: 'XY' })
    })

    it('delegates to the AnalyticsManager', function (done) {
      this.SessionManager.getLoggedInUserId.returns('1234')
      this.controller.updateEditingSession(this.req, this.res)

      this.AnalyticsManager.updateEditingSession
        .calledWith('1234', 'a project id', 'XY')
        .should.equal(true)
      done()
    })
  })

  describe('recordEvent', function () {
    beforeEach(function () {
      this.req = {
        params: {
          event: 'i_did_something',
        },
        body: 'stuff',
        sessionID: 'sessionIDHere',
        session: {},
      }
    })

    it('should use the user_id', function (done) {
      this.SessionManager.getLoggedInUserId.returns('1234')
      this.controller.recordEvent(this.req, this.res)
      this.AnalyticsManager.recordEvent
        .calledWith('1234', this.req.params.event, this.req.body)
        .should.equal(true)
      done()
    })

    it('should use the session id', function (done) {
      this.controller.recordEvent(this.req, this.res)
      this.AnalyticsManager.recordEvent
        .calledWith(this.req.sessionID, this.req.params.event, this.req.body)
        .should.equal(true)
      done()
    })
  })
})
