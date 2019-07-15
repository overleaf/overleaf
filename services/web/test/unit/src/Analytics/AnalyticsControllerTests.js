const SandboxedModule = require('sandboxed-module')
const path = require('path')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/Analytics/AnalyticsController'
)
const sinon = require('sinon')

describe('AnalyticsController', function() {
  beforeEach(function() {
    this.AuthenticationController = { getLoggedInUserId: sinon.stub() }

    this.AnalyticsManager = {
      updateEditingSession: sinon.stub().callsArgWith(3),
      recordEvent: sinon.stub().callsArgWith(3)
    }

    this.InstitutionsAPI = {
      getInstitutionLicences: sinon.stub().callsArgWith(4)
    }

    this.controller = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        './AnalyticsManager': this.AnalyticsManager,
        '../Authentication/AuthenticationController': this
          .AuthenticationController,
        '../Institutions/InstitutionsAPI': this.InstitutionsAPI,
        'logger-sharelatex': {
          log() {}
        },
        '../../infrastructure/GeoIpLookup': (this.GeoIpLookup = {
          getDetails: sinon.stub()
        })
      }
    })

    this.res = { send() {} }
  })

  describe('updateEditingSession', function() {
    beforeEach(function() {
      this.req = {
        params: {
          projectId: 'a project id'
        }
      }
      this.GeoIpLookup.getDetails = sinon
        .stub()
        .callsArgWith(1, null, { country_code: 'XY' })
    })

    it('delegates to the AnalyticsManager', function(done) {
      this.AuthenticationController.getLoggedInUserId.returns('1234')
      this.controller.updateEditingSession(this.req, this.res)

      this.AnalyticsManager.updateEditingSession
        .calledWith('1234', 'a project id', 'XY')
        .should.equal(true)
      done()
    })
  })

  describe('recordEvent', function() {
    beforeEach(function() {
      this.req = {
        params: {
          event: 'i_did_something'
        },
        body: 'stuff',
        sessionID: 'sessionIDHere',
        session: {}
      }
    })

    it('should use the user_id', function(done) {
      this.AuthenticationController.getLoggedInUserId.returns('1234')
      this.controller.recordEvent(this.req, this.res)
      this.AnalyticsManager.recordEvent
        .calledWith('1234', this.req.params['event'], this.req.body)
        .should.equal(true)
      done()
    })

    it('should use the session id', function(done) {
      this.controller.recordEvent(this.req, this.res)
      this.AnalyticsManager.recordEvent
        .calledWith(this.req.sessionID, this.req.params['event'], this.req.body)
        .should.equal(true)
      done()
    })
  })

  describe('licences', function() {
    beforeEach(function() {
      this.req = {
        query: {
          resource_id: 1,
          start_date: '1514764800',
          end_date: '1530662400',
          resource_type: 'institution'
        },
        sessionID: 'sessionIDHere',
        session: {}
      }
    })

    it('should trigger institutions api to fetch licences graph data', function(done) {
      this.controller.licences(this.req, this.res)
      this.InstitutionsAPI.getInstitutionLicences
        .calledWith(
          this.req.query['resource_id'],
          this.req.query['start_date'],
          this.req.query['end_date'],
          this.req.query['lag']
        )
        .should.equal(true)
      done()
    })
  })
})
