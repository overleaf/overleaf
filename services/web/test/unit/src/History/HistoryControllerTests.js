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
const sinon = require('sinon')
const { expect } = require('chai')

const Errors = require('../../../../app/src/Features/Errors/Errors')

const modulePath = '../../../../app/src/Features/History/HistoryController'
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongodb-legacy')

describe('HistoryController', function () {
  beforeEach(function () {
    this.callback = sinon.stub()
    this.user_id = 'user-id-123'
    this.SessionManager = {
      getLoggedInUserId: sinon.stub().returns(this.user_id),
    }
    this.Stream = {
      pipeline: sinon.stub(),
    }
    this.HistoryController = SandboxedModule.require(modulePath, {
      requires: {
        request: (this.request = sinon.stub()),
        '@overleaf/settings': (this.settings = {}),
        '@overleaf/fetch-utils': {},
        '@overleaf/Metrics': {},
        '../../infrastructure/mongodb': { ObjectId },
        stream: this.Stream,
        '../Authentication/SessionManager': this.SessionManager,
        './HistoryManager': (this.HistoryManager = {}),
        '../Project/ProjectDetailsHandler': (this.ProjectDetailsHandler = {}),
        '../Project/ProjectEntityUpdateHandler':
          (this.ProjectEntityUpdateHandler = {}),
        '../User/UserGetter': (this.UserGetter = {}),
        '../Project/ProjectGetter': (this.ProjectGetter = {}),
        './RestoreManager': (this.RestoreManager = {}),
        '../../infrastructure/Features': (this.Features = sinon
          .stub()
          .withArgs('saas')
          .returns(true)),
      },
    })
    return (this.settings.apis = {
      project_history: {
        url: 'http://project_history.example.com',
      },
    })
  })

  describe('proxyToHistoryApi', function () {
    beforeEach(function () {
      this.req = { url: '/mock/url', method: 'POST' }
      this.res = 'mock-res'
      this.next = sinon.stub()
      this.proxy = sinon.stub()
      this.request.returns(this.proxy)
    })

    describe('for a project with the project history flag', function () {
      beforeEach(function () {
        this.req.useProjectHistory = true
        return this.HistoryController.proxyToHistoryApi(
          this.req,
          this.res,
          this.next
        )
      })

      it('should get the user id', function () {
        return this.SessionManager.getLoggedInUserId
          .calledWith(this.req.session)
          .should.equal(true)
      })

      it('should call the project history api', function () {
        return this.request
          .calledWith({
            url: `${this.settings.apis.project_history.url}${this.req.url}`,
            method: this.req.method,
            headers: {
              'X-User-Id': this.user_id,
            },
          })
          .should.equal(true)
      })

      it('should pipe the response to the client', function () {
        expect(this.Stream.pipeline).to.have.been.calledWith(
          this.proxy,
          this.res
        )
      })
    })

    describe('for a project without the project history flag', function () {
      beforeEach(function () {
        this.req.useProjectHistory = false
        return this.HistoryController.proxyToHistoryApi(
          this.req,
          this.res,
          this.next
        )
      })

      it('should get the user id', function () {
        return this.SessionManager.getLoggedInUserId
          .calledWith(this.req.session)
          .should.equal(true)
      })

      it('should pipe the response to the client', function () {
        expect(this.Stream.pipeline).to.have.been.calledWith(
          this.proxy,
          this.res
        )
      })
    })
  })

  describe('proxyToHistoryApiAndInjectUserDetails', function () {
    beforeEach(function () {
      this.req = { url: '/mock/url', method: 'POST' }
      this.res = { json: sinon.stub() }
      this.next = sinon.stub()
      this.request.yields(null, { statusCode: 200 }, (this.data = 'mock-data'))
      return (this.HistoryManager.injectUserDetails = sinon
        .stub()
        .yields(null, (this.data_with_users = 'mock-injected-data')))
    })

    describe('for a project with the project history flag', function () {
      beforeEach(function () {
        this.req.useProjectHistory = true
        return this.HistoryController.proxyToHistoryApiAndInjectUserDetails(
          this.req,
          this.res,
          this.next
        )
      })

      it('should get the user id', function () {
        return this.SessionManager.getLoggedInUserId
          .calledWith(this.req.session)
          .should.equal(true)
      })

      it('should call the project history api', function () {
        return this.request
          .calledWith({
            url: `${this.settings.apis.project_history.url}${this.req.url}`,
            method: this.req.method,
            json: true,
            headers: {
              'X-User-Id': this.user_id,
            },
          })
          .should.equal(true)
      })

      it('should inject the user data', function () {
        return this.HistoryManager.injectUserDetails
          .calledWith(this.data)
          .should.equal(true)
      })

      it('should return the data with users to the client', function () {
        return this.res.json.calledWith(this.data_with_users).should.equal(true)
      })
    })

    describe('for a project without the project history flag', function () {
      beforeEach(function () {
        this.req.useProjectHistory = false
        return this.HistoryController.proxyToHistoryApiAndInjectUserDetails(
          this.req,
          this.res,
          this.next
        )
      })

      it('should get the user id', function () {
        return this.SessionManager.getLoggedInUserId
          .calledWith(this.req.session)
          .should.equal(true)
      })

      it('should inject the user data', function () {
        return this.HistoryManager.injectUserDetails
          .calledWith(this.data)
          .should.equal(true)
      })

      it('should return the data with users to the client', function () {
        return this.res.json.calledWith(this.data_with_users).should.equal(true)
      })
    })
  })

  describe('proxyToHistoryApiAndInjectUserDetails (with the history API failing)', function () {
    beforeEach(function () {
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

    it('should not inject the user data', function () {
      return this.HistoryManager.injectUserDetails
        .calledWith(this.data)
        .should.equal(false)
    })

    it('should not return the data with users to the client', function () {
      return this.res.json.calledWith(this.data_with_users).should.equal(false)
    })
  })

  describe('resyncProjectHistory', function () {
    describe('for a project without project-history enabled', function () {
      beforeEach(function () {
        this.project_id = 'mock-project-id'
        this.req = { params: { Project_id: this.project_id }, body: {} }
        this.res = { setTimeout: sinon.stub(), sendStatus: sinon.stub() }
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

      it('response with a 404', function () {
        return this.res.sendStatus.calledWith(404).should.equal(true)
      })
    })

    describe('for a project with project-history enabled', function () {
      beforeEach(function () {
        this.project_id = 'mock-project-id'
        this.req = { params: { Project_id: this.project_id }, body: {} }
        this.res = { setTimeout: sinon.stub(), sendStatus: sinon.stub() }
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

      it('sets an extended response timeout', function () {
        this.res.setTimeout.should.have.been.calledWith(6 * 60 * 1000)
      })

      it('resyncs the project', function () {
        return this.ProjectEntityUpdateHandler.resyncProjectHistory
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('responds with a 204', function () {
        return this.res.sendStatus.calledWith(204).should.equal(true)
      })
    })
  })
})
