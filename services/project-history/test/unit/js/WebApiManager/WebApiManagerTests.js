import sinon from 'sinon'
import { expect } from 'chai'
import { strict as esmock } from 'esmock'
import { RequestFailedError } from '@overleaf/fetch-utils'

const MODULE_PATH = '../../../../app/js/WebApiManager.js'

describe('WebApiManager', function () {
  beforeEach(async function () {
    this.settings = {
      apis: {
        web: {
          url: 'http://example.com',
          user: 'overleaf',
          pass: 'password',
        },
      },
    }
    this.userId = 'mock-user-id'
    this.projectId = 'mock-project-id'
    this.project = { features: 'mock-features' }
    this.olProjectId = 12345
    this.Metrics = { inc: sinon.stub() }
    this.RedisManager = {
      promises: {
        getCachedHistoryId: sinon.stub(),
        setCachedHistoryId: sinon.stub().resolves(),
      },
    }
    this.FetchUtils = {
      fetchNothing: sinon.stub().resolves(),
      fetchJson: sinon.stub(),
      RequestFailedError,
    }
    this.WebApiManager = await esmock(MODULE_PATH, {
      '@overleaf/fetch-utils': this.FetchUtils,
      '@overleaf/settings': this.settings,
      '@overleaf/metrics': this.Metrics,
      '../../../../app/js/RedisManager.js': this.RedisManager,
    })
    this.WebApiManager.setRetryTimeoutMs(100)
  })

  describe('getHistoryId', function () {
    describe('when there is no cached value and the web request is successful', function () {
      beforeEach(function () {
        this.RedisManager.promises.getCachedHistoryId
          .withArgs(this.projectId) // first call, no cached value returned
          .onCall(0)
          .resolves(null)
        this.RedisManager.promises.getCachedHistoryId
          .withArgs(this.projectId) // subsequent calls, return cached value
          .resolves(this.olProjectId)
        this.RedisManager.promises.getCachedHistoryId
          .withArgs('mock-project-id-2') // no cached value for other project
          .resolves(null)
        this.FetchUtils.fetchJson.resolves({
          overleaf: { history: { id: this.olProjectId } },
        })
      })

      it('should only request project details once per project', async function () {
        for (let i = 0; i < 5; i++) {
          await this.WebApiManager.promises.getHistoryId(this.projectId)
        }
        this.FetchUtils.fetchJson.should.have.been.calledOnce

        await this.WebApiManager.promises.getHistoryId('mock-project-id-2')
        this.FetchUtils.fetchJson.should.have.been.calledTwice
      })

      it('should cache the history id', async function () {
        const olProjectId = await this.WebApiManager.promises.getHistoryId(
          this.projectId
        )
        this.RedisManager.promises.setCachedHistoryId
          .calledWith(this.projectId, olProjectId)
          .should.equal(true)
      })

      it("should return the project's history id", async function () {
        const olProjectId = await this.WebApiManager.promises.getHistoryId(
          this.projectId
        )

        expect(this.FetchUtils.fetchJson).to.have.been.calledWithMatch(
          `${this.settings.apis.web.url}/project/${this.projectId}/details`,
          {
            basicAuth: {
              user: this.settings.apis.web.user,
              password: this.settings.apis.web.pass,
            },
          }
        )
        expect(olProjectId).to.equal(this.olProjectId)
      })
    })

    describe('when the web API returns an error', function () {
      beforeEach(function () {
        this.error = new Error('something went wrong')
        this.FetchUtils.fetchJson.rejects(this.error)
        this.RedisManager.promises.getCachedHistoryId.resolves(null)
      })

      it('should throw an error', async function () {
        await expect(
          this.WebApiManager.promises.getHistoryId(this.projectId)
        ).to.be.rejectedWith(this.error)
      })
    })

    describe('when web returns a 404', function () {
      beforeEach(function () {
        this.FetchUtils.fetchJson.rejects(
          new RequestFailedError(
            'http://some-url',
            {},
            { status: 404 },
            'Not found'
          )
        )
        this.RedisManager.promises.getCachedHistoryId.resolves(null)
      })

      it('should throw an error', async function () {
        await expect(
          this.WebApiManager.promises.getHistoryId(this.projectId)
        ).to.be.rejectedWith('got a 404 from web api')
      })
    })

    describe('when web returns a failure error code', function () {
      beforeEach(function () {
        this.RedisManager.promises.getCachedHistoryId.resolves(null)
        this.FetchUtils.fetchJson.rejects(
          new RequestFailedError(
            'http://some-url',
            {},
            { status: 500 },
            'Error'
          )
        )
      })

      it('should throw an error', async function () {
        await expect(
          this.WebApiManager.promises.getHistoryId(this.projectId)
        ).to.be.rejectedWith(RequestFailedError)
      })
    })
  })
})
