const sinon = require('sinon')
const { expect } = require('chai')
const { RequestFailedError } = require('@overleaf/fetch-utils')

const Errors = require('../../../../app/src/Features/Errors/Errors')

const modulePath = '../../../../app/src/Features/History/HistoryController'
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongodb-legacy')

describe('HistoryController', function () {
  beforeEach(function () {
    this.callback = sinon.stub()
    this.user_id = 'user-id-123'
    this.project_id = 'mock-project-id'
    this.stream = sinon.stub()
    this.fetchResponse = {
      headers: {
        get: sinon.stub(),
      },
    }
    this.next = sinon.stub()

    this.SessionManager = {
      getLoggedInUserId: sinon.stub().returns(this.user_id),
    }

    this.Stream = {
      pipeline: sinon.stub().resolves(),
    }

    this.HistoryManager = {
      promises: {
        injectUserDetails: sinon.stub(),
      },
    }

    this.ProjectEntityUpdateHandler = {
      promises: {
        resyncProjectHistory: sinon.stub().resolves(),
      },
    }

    this.fetchJson = sinon.stub()
    this.fetchStream = sinon.stub().resolves(this.stream)
    this.fetchStreamWithResponse = sinon
      .stub()
      .resolves({ stream: this.stream, response: this.fetchResponse })
    this.fetchNothing = sinon.stub().resolves()

    this.HistoryController = SandboxedModule.require(modulePath, {
      requires: {
        'stream/promises': this.Stream,
        '@overleaf/settings': (this.settings = {}),
        '@overleaf/fetch-utils': {
          fetchJson: this.fetchJson,
          fetchStream: this.fetchStream,
          fetchStreamWithResponse: this.fetchStreamWithResponse,
          fetchNothing: this.fetchNothing,
        },
        '@overleaf/Metrics': {},
        '../../infrastructure/mongodb': { ObjectId },
        '../Authentication/SessionManager': this.SessionManager,
        './HistoryManager': this.HistoryManager,
        '../Project/ProjectDetailsHandler': (this.ProjectDetailsHandler = {}),
        '../Project/ProjectEntityUpdateHandler':
          this.ProjectEntityUpdateHandler,
        '../User/UserGetter': (this.UserGetter = {}),
        '../Project/ProjectGetter': (this.ProjectGetter = {}),
        './RestoreManager': (this.RestoreManager = {}),
        '../../infrastructure/Features': (this.Features = sinon
          .stub()
          .withArgs('saas')
          .returns(true)),
      },
    })
    this.settings.apis = {
      project_history: {
        url: 'http://project_history.example.com',
      },
    }
  })

  describe('proxyToHistoryApi', function () {
    beforeEach(async function () {
      this.req = { url: '/mock/url', method: 'POST', session: sinon.stub() }
      this.res = {
        set: sinon.stub(),
      }
      this.contentType = 'application/json'
      this.contentLength = 212
      this.fetchResponse.headers.get
        .withArgs('Content-Type')
        .returns(this.contentType)
      this.fetchResponse.headers.get
        .withArgs('Content-Length')
        .returns(this.contentLength)
      await this.HistoryController.proxyToHistoryApi(
        this.req,
        this.res,
        this.next
      )
    })

    it('should get the user id', function () {
      this.SessionManager.getLoggedInUserId.should.have.been.calledWith(
        this.req.session
      )
    })

    it('should call the project history api', function () {
      this.fetchStreamWithResponse.should.have.been.calledWith(
        `${this.settings.apis.project_history.url}${this.req.url}`,
        {
          method: this.req.method,
          headers: {
            'X-User-Id': this.user_id,
          },
        }
      )
    })

    it('should pipe the response to the client', function () {
      expect(this.Stream.pipeline).to.have.been.calledWith(
        this.stream,
        this.res
      )
    })

    it('should propagate the appropriate headers', function () {
      expect(this.res.set).to.have.been.calledWith(
        'Content-Type',
        this.contentType
      )
      expect(this.res.set).to.have.been.calledWith(
        'Content-Length',
        this.contentLength
      )
    })
  })

  describe('proxyToHistoryApiAndInjectUserDetails', function () {
    beforeEach(async function () {
      this.req = { url: '/mock/url', method: 'POST' }
      this.res = { json: sinon.stub() }
      this.data = 'mock-data'
      this.dataWithUsers = 'mock-injected-data'
      this.fetchJson.resolves(this.data)
      this.HistoryManager.promises.injectUserDetails.resolves(
        this.dataWithUsers
      )
      await this.HistoryController.proxyToHistoryApiAndInjectUserDetails(
        this.req,
        this.res,
        this.next
      )
    })

    it('should get the user id', function () {
      this.SessionManager.getLoggedInUserId.should.have.been.calledWith(
        this.req.session
      )
    })

    it('should call the project history api', function () {
      this.fetchJson.should.have.been.calledWith(
        `${this.settings.apis.project_history.url}${this.req.url}`,
        {
          method: this.req.method,
          headers: {
            'X-User-Id': this.user_id,
          },
        }
      )
    })

    it('should inject the user data', function () {
      this.HistoryManager.promises.injectUserDetails.should.have.been.calledWith(
        this.data
      )
    })

    it('should return the data with users to the client', function () {
      this.res.json.should.have.been.calledWith(this.dataWithUsers)
    })
  })

  describe('proxyToHistoryApiAndInjectUserDetails (with the history API failing)', function () {
    beforeEach(async function () {
      this.url = '/mock/url'
      this.req = { url: this.url, method: 'POST' }
      this.res = { json: sinon.stub() }
      this.err = new RequestFailedError(this.url, {}, { status: 500 })
      this.fetchJson.rejects(this.err)
      await this.HistoryController.proxyToHistoryApiAndInjectUserDetails(
        this.req,
        this.res,
        this.next
      )
    })

    it('should not inject the user data', function () {
      this.HistoryManager.promises.injectUserDetails.should.not.have.been.called
    })

    it('should not return the data with users to the client', function () {
      this.res.json.should.not.have.been.called
    })

    it('should throw an error', function () {
      this.next.should.have.been.calledWith(this.err)
    })
  })

  describe('resyncProjectHistory', function () {
    describe('for a project without project-history enabled', function () {
      beforeEach(async function () {
        this.req = { params: { Project_id: this.project_id }, body: {} }
        this.res = { setTimeout: sinon.stub(), sendStatus: sinon.stub() }

        this.error = new Errors.ProjectHistoryDisabledError()
        this.ProjectEntityUpdateHandler.promises.resyncProjectHistory.rejects(
          this.error
        )

        await this.HistoryController.resyncProjectHistory(
          this.req,
          this.res,
          this.next
        )
      })

      it('response with a 404', function () {
        this.res.sendStatus.should.have.been.calledWith(404)
      })
    })

    describe('for a project with project-history enabled', function () {
      beforeEach(async function () {
        this.req = { params: { Project_id: this.project_id }, body: {} }
        this.res = { setTimeout: sinon.stub(), sendStatus: sinon.stub() }

        await this.HistoryController.resyncProjectHistory(
          this.req,
          this.res,
          this.next
        )
      })

      it('sets an extended response timeout', function () {
        this.res.setTimeout.should.have.been.calledWith(6 * 60 * 1000)
      })

      it('resyncs the project', function () {
        this.ProjectEntityUpdateHandler.promises.resyncProjectHistory.should.have.been.calledWith(
          this.project_id
        )
      })

      it('responds with a 204', function () {
        this.res.sendStatus.should.have.been.calledWith(204)
      })
    })
  })
})
