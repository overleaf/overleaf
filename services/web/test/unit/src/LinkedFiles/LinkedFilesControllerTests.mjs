import { expect } from 'chai'
import esmock from 'esmock'
import sinon from 'sinon'
const modulePath =
  '../../../../app/src/Features/LinkedFiles/LinkedFilesController.mjs'

describe('LinkedFilesController', function () {
  beforeEach(function () {
    this.fakeTime = new Date()
    this.clock = sinon.useFakeTimers(this.fakeTime.getTime())
  })

  afterEach(function () {
    this.clock.restore()
  })

  beforeEach(async function () {
    this.userId = 'user-id'
    this.Agent = {
      promises: {
        createLinkedFile: sinon.stub().resolves(),
        refreshLinkedFile: sinon.stub().resolves(),
      },
    }
    this.projectId = 'projectId'
    this.provider = 'provider'
    this.name = 'linked-file-name'
    this.data = { customAgentData: 'foo' }
    this.LinkedFilesHandler = {
      promises: {
        getFileById: sinon.stub(),
      },
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
    this.logger = {
      error: sinon.stub(),
    }
    this.settings = { enabledLinkedFileTypes: [] }
    this.LinkedFilesController = await esmock.strict(modulePath, {
      '.../../../../app/src/Features/Authentication/SessionManager':
        this.SessionManager,
      '../../../../app/src/Features/Analytics/AnalyticsManager':
        this.AnalyticsManager,
      '../../../../app/src/Features/LinkedFiles/LinkedFilesHandler':
        this.LinkedFilesHandler,
      '../../../../app/src/Features/Editor/EditorRealTimeController':
        this.EditorRealTimeController,
      '../../../../app/src/Features/References/ReferencesHandler':
        this.ReferencesHandler,
      '../../../../app/src/Features/LinkedFiles/UrlAgent': this.UrlAgent,
      '../../../../app/src/Features/LinkedFiles/ProjectFileAgent':
        this.ProjectFileAgent,
      '../../../../app/src/Features/LinkedFiles/ProjectOutputFileAgent':
        this.ProjectOutputFileAgent,
      '../../../../app/src/Features/Editor/EditorController':
        this.EditorController,
      '../../../../app/src/Features/Project/ProjectLocator':
        this.ProjectLocator,
      '@overleaf/logger': this.logger,
      '@overleaf/settings': this.settings,
    })
    this.LinkedFilesController._getAgent = sinon.stub().resolves(this.Agent)
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
          expect(this.Agent.promises.createLinkedFile).to.have.been.calledWith(
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
      this.LinkedFilesHandler.promises.getFileById
        .withArgs(this.projectId, 'file-id')
        .resolves({
          file: this.file,
          path: 'fake-path',
          parentFolder: {
            _id: 'parent-folder-id',
          },
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
          expect(this.Agent.promises.refreshLinkedFile).to.have.been.calledWith(
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
