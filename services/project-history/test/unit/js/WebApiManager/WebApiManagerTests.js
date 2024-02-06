import async from 'async'
import sinon from 'sinon'
import { expect } from 'chai'
import { strict as esmock } from 'esmock'

const MODULE_PATH = '../../../../app/js/WebApiManager.js'

describe('WebApiManager', function () {
  beforeEach(async function () {
    this.request = sinon.stub()
    this.settings = {
      apis: {
        web: {
          url: 'http://example.com',
          user: 'overleaf',
          pass: 'password',
        },
      },
    }
    this.callback = sinon.stub()
    this.userId = 'mock-user-id'
    this.projectId = 'mock-project-id'
    this.project = { features: 'mock-features' }
    this.olProjectId = 12345
    this.Metrics = { inc: sinon.stub() }
    this.RedisManager = {
      getCachedHistoryId: sinon.stub(),
      setCachedHistoryId: sinon.stub().yields(),
    }
    this.WebApiManager = await esmock(MODULE_PATH, {
      requestretry: this.request,
      '@overleaf/settings': this.settings,
      '@overleaf/metrics': this.Metrics,
      '../../../../app/js/RedisManager.js': this.RedisManager,
    })
  })

  describe('getHistoryId', function () {
    describe('when there is no cached value and the web request is successful', function () {
      beforeEach(function () {
        this.RedisManager.getCachedHistoryId
          .withArgs(this.projectId) // first call, no cached value returned
          .onCall(0)
          .yields()
        this.RedisManager.getCachedHistoryId
          .withArgs(this.projectId) // subsequent calls, return cached value
          .yields(null, this.olProjectId)
        this.RedisManager.getCachedHistoryId
          .withArgs('mock-project-id-2') // no cached value for other project
          .yields()
        this.request.yields(
          null,
          { statusCode: 200 },
          { overleaf: { history: { id: this.olProjectId } } }
        )
      })

      it('should only request project details once per project', function (done) {
        async.times(
          5,
          (n, cb) => {
            this.WebApiManager.getHistoryId(this.projectId, cb)
          },
          () => {
            this.request.callCount.should.equal(1)

            this.WebApiManager.getHistoryId('mock-project-id-2', () => {
              this.request.callCount.should.equal(2)
              done()
            })
          }
        )
      })

      it('should cache the history id', function (done) {
        this.WebApiManager.getHistoryId(
          this.projectId,
          (error, olProjectId) => {
            if (error) return done(error)
            this.RedisManager.setCachedHistoryId
              .calledWith(this.projectId, olProjectId)
              .should.equal(true)
            done()
          }
        )
      })

      it('should call the callback with the project', function (done) {
        this.WebApiManager.getHistoryId(
          this.projectId,
          (error, olProjectId) => {
            expect(error).to.be.null
            expect(
              this.request.calledWithMatch({
                method: 'GET',
                url: `${this.settings.apis.web.url}/project/${this.projectId}/details`,
                json: true,
                auth: {
                  user: this.settings.apis.web.user,
                  pass: this.settings.apis.web.pass,
                  sendImmediately: true,
                },
              })
            ).to.be.true
            expect(olProjectId).to.equal(this.olProjectId)
            done()
          }
        )
      })
    })

    describe('when the web API returns an error', function () {
      beforeEach(function () {
        this.error = new Error('something went wrong')
        this.request.yields(this.error)
        this.RedisManager.getCachedHistoryId.yields()
        this.WebApiManager.getHistoryId(this.projectId, this.callback)
      })

      it('should return an error to the callback', function () {
        this.callback.calledWith(this.error).should.equal(true)
      })
    })

    describe('when web returns a 404', function () {
      beforeEach(function () {
        this.request.callsArgWith(1, null, { statusCode: 404 }, '')
        this.RedisManager.getCachedHistoryId.yields()
        this.WebApiManager.getHistoryId(this.projectId, this.callback)
      })

      it('should return the callback with an error', function () {
        this.callback
          .calledWith(sinon.match.has('message', 'got a 404 from web api'))
          .should.equal(true)
      })
    })

    describe('when web returns a failure error code', function () {
      beforeEach(function () {
        this.RedisManager.getCachedHistoryId.yields()
        this.request.callsArgWith(
          1,
          null,
          { statusCode: 500, attempts: 42 },
          ''
        )
        this.WebApiManager.getHistoryId(this.projectId, this.callback)
      })

      it('should return the callback with an error', function () {
        this.callback
          .calledWith(
            sinon.match.has(
              'message',
              'web returned a non-success status code: 500 (attempts: 42)'
            )
          )
          .should.equal(true)
      })
    })
  })
})
