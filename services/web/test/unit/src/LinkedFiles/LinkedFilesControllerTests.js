const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const modulePath =
  '../../../../app/src/Features/LinkedFiles/LinkedFilesController'

describe('LinkedFilesController', function () {
  beforeEach(function () {
    this.fakeTime = new Date()
    this.clock = sinon.useFakeTimers(this.fakeTime.getTime())
  })

  afterEach(function () {
    this.clock.restore()
  })

  beforeEach(function () {
    this.userId = 'user-id'
    this.Agent = {
      createLinkedFile: sinon.stub().yields(),
      refreshLinkedFile: sinon.stub().yields(),
    }
    this.projectId = 'projectId'
    this.provider = 'provider'
    this.name = 'linked-file-name'
    this.data = { customAgentData: 'foo' }
    this.LinkedFilesHandler = {
      getFileById: sinon.stub(),
    }
    this.AnalyticsManager = {}
    this.SessionManager = {
      getLoggedInUserId: sinon.stub().returns(this.userId),
    }
    this.EditorRealTimeController = {}
    this.ReferencesHandler = {}
    this.UrlAgent = {}
    this.ProjectFileAgent = {}
    this.ProjectOutputFileAgent = {}
    this.EditorController = {}
    this.ProjectLocator = {}
    this.logger = {}
    this.settings = { enabledLinkedFileTypes: [] }
    this.LinkedFilesController = SandboxedModule.require(modulePath, {
      requires: {
        '../Authentication/SessionManager': this.SessionManager,
        '../../../../app/src/Features/Analytics/AnalyticsManager':
          this.AnalyticsManager,
        './LinkedFilesHandler': this.LinkedFilesHandler,
        '../Editor/EditorRealTimeController': this.EditorRealTimeController,
        '../References/ReferencesHandler': this.ReferencesHandler,
        './UrlAgent': this.UrlAgent,
        './ProjectFileAgent': this.ProjectFileAgent,
        './ProjectOutputFileAgent': this.ProjectOutputFileAgent,
        '../Editor/EditorController': this.EditorController,
        '../Project/ProjectLocator': this.ProjectLocator,
        '@overleaf/logger': this.logger,
        '@overleaf/settings': this.settings,
      },
    })
    this.LinkedFilesController._getAgent = sinon.stub().returns(this.Agent)
  })

  describe('createLinkedFile', function () {
    beforeEach(function () {
      this.req = {
        params: { project_id: this.projectId },
        body: {
          name: this.name,
          provider: this.provider,
          data: this.data,
        },
      }
      this.next = sinon.stub()
    })

    it('sets importedAt timestamp on linkedFileData', function (done) {
      this.next = sinon.stub().callsFake(() => done('unexpected error'))
      this.res = {
        json: () => {
          expect(this.Agent.createLinkedFile).to.have.been.calledWith(
            this.projectId,
            { ...this.data, importedAt: this.fakeTime.toISOString() },
            this.name,
            undefined,
            this.userId
          )
          done()
        },
      }
      this.LinkedFilesController.createLinkedFile(this.req, this.res, this.next)
    })
  })
  describe('refreshLinkedFiles', function () {
    beforeEach(function () {
      this.data.provider = this.provider
      this.file = {
        name: this.name,
        linkedFileData: {
          ...this.data,
          importedAt: new Date(2020, 1, 1).toISOString(),
        },
      }
      this.LinkedFilesHandler.getFileById
        .withArgs(this.projectId, 'file-id')
        .yields(null, this.file, 'fake-path', {
          _id: 'parent-folder-id',
        })
      this.req = {
        params: { project_id: this.projectId, file_id: 'file-id' },
        body: {},
      }
      this.next = sinon.stub()
    })

    it('resets importedAt timestamp on linkedFileData', function (done) {
      this.next = sinon.stub().callsFake(() => done('unexpected error'))
      this.res = {
        json: () => {
          expect(this.Agent.refreshLinkedFile).to.have.been.calledWith(
            this.projectId,
            {
              ...this.data,
              importedAt: this.fakeTime.toISOString(),
            },
            this.name,
            'parent-folder-id',
            this.userId
          )
          done()
        },
      }
      this.LinkedFilesController.refreshLinkedFile(
        this.req,
        this.res,
        this.next
      )
    })
  })
})
