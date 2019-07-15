/* eslint-disable
    max-len,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const chai = require('chai')
chai.should()
const sinon = require('sinon')

const Errors = require('../../../../app/src/Features/Errors/Errors')

const modulePath = '../../../../app/src/Features/History/HistoryController'
const SandboxedModule = require('sandboxed-module')

describe('HistoryController', function() {
  beforeEach(function() {
    this.callback = sinon.stub()
    this.user_id = 'user-id-123'
    this.AuthenticationController = {
      getLoggedInUserId: sinon.stub().returns(this.user_id)
    }
    this.HistoryController = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        request: (this.request = sinon.stub()),
        'settings-sharelatex': (this.settings = {}),
        'logger-sharelatex': (this.logger = {
          log: sinon.stub(),
          warn: sinon.stub(),
          error: sinon.stub()
        }),
        '../Authentication/AuthenticationController': this
          .AuthenticationController,
        '../Errors/Errors': Errors,
        './HistoryManager': (this.HistoryManager = {}),
        '../Project/ProjectDetailsHandler': (this.ProjectDetailsHandler = {}),
        '../Project/ProjectEntityUpdateHandler': (this.ProjectEntityUpdateHandler = {}),
        './RestoreManager': (this.RestoreManager = {})
      }
    })
    return (this.settings.apis = {
      trackchanges: {
        enabled: false,
        url: 'http://trackchanges.example.com'
      },
      project_history: {
        url: 'http://project_history.example.com'
      }
    })
  })

  describe('selectHistoryApi', function() {
    beforeEach(function() {
      this.req = { url: '/mock/url', method: 'POST' }
      this.res = 'mock-res'
      return (this.next = sinon.stub())
    })

    describe('for a project with project history', function() {
      beforeEach(function() {
        this.ProjectDetailsHandler.getDetails = sinon
          .stub()
          .callsArgWith(1, null, {
            overleaf: { history: { id: 42, display: true } }
          })
        return this.HistoryController.selectHistoryApi(
          this.req,
          this.res,
          this.next
        )
      })

      it('should set the flag for project history to true', function() {
        return this.req.useProjectHistory.should.equal(true)
      })
    })

    describe('for any other project ', function() {
      beforeEach(function() {
        this.ProjectDetailsHandler.getDetails = sinon
          .stub()
          .callsArgWith(1, null, {})
        return this.HistoryController.selectHistoryApi(
          this.req,
          this.res,
          this.next
        )
      })

      it('should not set the flag for project history to false', function() {
        return this.req.useProjectHistory.should.equal(false)
      })
    })
  })

  describe('proxyToHistoryApi', function() {
    beforeEach(function() {
      this.req = { url: '/mock/url', method: 'POST' }
      this.res = 'mock-res'
      this.next = sinon.stub()
      this.proxy = {
        events: {},
        pipe: sinon.stub(),
        on(event, handler) {
          return (this.events[event] = handler)
        }
      }
      return this.request.returns(this.proxy)
    })

    describe('for a project with the project history flag', function() {
      beforeEach(function() {
        this.req.useProjectHistory = true
        return this.HistoryController.proxyToHistoryApi(
          this.req,
          this.res,
          this.next
        )
      })

      it('should get the user id', function() {
        return this.AuthenticationController.getLoggedInUserId
          .calledWith(this.req)
          .should.equal(true)
      })

      it('should call the project history api', function() {
        return this.request
          .calledWith({
            url: `${this.settings.apis.project_history.url}${this.req.url}`,
            method: this.req.method,
            headers: {
              'X-User-Id': this.user_id
            }
          })
          .should.equal(true)
      })

      it('should pipe the response to the client', function() {
        return this.proxy.pipe.calledWith(this.res).should.equal(true)
      })
    })

    describe('for a project without the project history flag', function() {
      beforeEach(function() {
        this.req.useProjectHistory = false
        return this.HistoryController.proxyToHistoryApi(
          this.req,
          this.res,
          this.next
        )
      })

      it('should get the user id', function() {
        return this.AuthenticationController.getLoggedInUserId
          .calledWith(this.req)
          .should.equal(true)
      })

      it('should call the track changes api', function() {
        return this.request
          .calledWith({
            url: `${this.settings.apis.trackchanges.url}${this.req.url}`,
            method: this.req.method,
            headers: {
              'X-User-Id': this.user_id
            }
          })
          .should.equal(true)
      })

      it('should pipe the response to the client', function() {
        return this.proxy.pipe.calledWith(this.res).should.equal(true)
      })
    })

    describe('with an error', function() {
      beforeEach(function() {
        this.HistoryController.proxyToHistoryApi(this.req, this.res, this.next)
        return this.proxy.events['error'].call(
          this.proxy,
          (this.error = new Error('oops'))
        )
      })

      it('should pass the error up the call chain', function() {
        return this.next.calledWith(this.error).should.equal(true)
      })
    })
  })

  describe('proxyToHistoryApiAndInjectUserDetails', function() {
    beforeEach(function() {
      this.req = { url: '/mock/url', method: 'POST' }
      this.res = { json: sinon.stub() }
      this.next = sinon.stub()
      this.request.yields(null, { statusCode: 200 }, (this.data = 'mock-data'))
      return (this.HistoryManager.injectUserDetails = sinon
        .stub()
        .yields(null, (this.data_with_users = 'mock-injected-data')))
    })

    describe('for a project with the project history flag', function() {
      beforeEach(function() {
        this.req.useProjectHistory = true
        return this.HistoryController.proxyToHistoryApiAndInjectUserDetails(
          this.req,
          this.res,
          this.next
        )
      })

      it('should get the user id', function() {
        return this.AuthenticationController.getLoggedInUserId
          .calledWith(this.req)
          .should.equal(true)
      })

      it('should call the project history api', function() {
        return this.request
          .calledWith({
            url: `${this.settings.apis.project_history.url}${this.req.url}`,
            method: this.req.method,
            json: true,
            headers: {
              'X-User-Id': this.user_id
            }
          })
          .should.equal(true)
      })

      it('should inject the user data', function() {
        return this.HistoryManager.injectUserDetails
          .calledWith(this.data)
          .should.equal(true)
      })

      it('should return the data with users to the client', function() {
        return this.res.json.calledWith(this.data_with_users).should.equal(true)
      })
    })

    describe('for a project without the project history flag', function() {
      beforeEach(function() {
        this.req.useProjectHistory = false
        return this.HistoryController.proxyToHistoryApiAndInjectUserDetails(
          this.req,
          this.res,
          this.next
        )
      })

      it('should get the user id', function() {
        return this.AuthenticationController.getLoggedInUserId
          .calledWith(this.req)
          .should.equal(true)
      })

      it('should call the track changes api', function() {
        return this.request
          .calledWith({
            url: `${this.settings.apis.trackchanges.url}${this.req.url}`,
            method: this.req.method,
            json: true,
            headers: {
              'X-User-Id': this.user_id
            }
          })
          .should.equal(true)
      })

      it('should inject the user data', function() {
        return this.HistoryManager.injectUserDetails
          .calledWith(this.data)
          .should.equal(true)
      })

      it('should return the data with users to the client', function() {
        return this.res.json.calledWith(this.data_with_users).should.equal(true)
      })
    })
  })

  describe('proxyToHistoryApiAndInjectUserDetails (with the history API failing)', function() {
    beforeEach(function() {
      this.req = { url: '/mock/url', method: 'POST', useProjectHistory: true }
      this.res = { json: sinon.stub() }
      this.next = sinon.stub()
      this.request.yields(null, { statusCode: 500 }, (this.data = 'mock-data'))
      this.HistoryManager.injectUserDetails = sinon
        .stub()
        .yields(null, (this.data_with_users = 'mock-injected-data'))
      return this.HistoryController.proxyToHistoryApiAndInjectUserDetails(
        this.req,
        this.res,
        this.next
      )
    })

    it('should not inject the user data', function() {
      return this.HistoryManager.injectUserDetails
        .calledWith(this.data)
        .should.equal(false)
    })

    it('should not return the data with users to the client', function() {
      return this.res.json.calledWith(this.data_with_users).should.equal(false)
    })
  })

  describe('resyncProjectHistory', function() {
    describe('for a project without project-history enabled', function() {
      beforeEach(function() {
        this.project_id = 'mock-project-id'
        this.req = { params: { Project_id: this.project_id } }
        this.res = { sendStatus: sinon.stub() }
        this.next = sinon.stub()

        this.error = new Errors.ProjectHistoryDisabledError()
        this.ProjectEntityUpdateHandler.resyncProjectHistory = sinon
          .stub()
          .yields(this.error)

        return this.HistoryController.resyncProjectHistory(
          this.req,
          this.res,
          this.next
        )
      })

      it('response with a 404', function() {
        return this.res.sendStatus.calledWith(404).should.equal(true)
      })
    })

    describe('for a project with project-history enabled', function() {
      beforeEach(function() {
        this.project_id = 'mock-project-id'
        this.req = { params: { Project_id: this.project_id } }
        this.res = { sendStatus: sinon.stub() }
        this.next = sinon.stub()

        this.ProjectEntityUpdateHandler.resyncProjectHistory = sinon
          .stub()
          .yields()

        return this.HistoryController.resyncProjectHistory(
          this.req,
          this.res,
          this.next
        )
      })

      it('resyncs the project', function() {
        return this.ProjectEntityUpdateHandler.resyncProjectHistory
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('responds with a 204', function() {
        return this.res.sendStatus.calledWith(204).should.equal(true)
      })
    })
  })
})
