import { vi, expect } from 'vitest'
import sinon from 'sinon'

const MODULE_PATH = '../../../../app/src/Features/Compile/CompileManager.mjs'

describe('CompileManager', function () {
  beforeEach(async function (ctx) {
    ctx.rateLimiter = {
      consume: sinon.stub().resolves(),
    }
    ctx.timer = {
      done: sinon.stub(),
    }
    ctx.Metrics = {
      Timer: sinon.stub().returns(ctx.timer),
      inc: sinon.stub(),
    }

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.settings = {
        apis: {
          clsi: { submissionBackendClass: 'c3d' },
        },
        redis: { web: { host: '127.0.0.1', port: 42 } },
        rateLimit: { autoCompile: {} },
      }),
    }))

    vi.doMock('../../../../app/src/infrastructure/RedisWrapper', () => ({
      default: {
        client: () =>
          (ctx.rclient = {
            auth() {},
          }),
      },
    }))

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectRootDocManager',
      () => ({
        default: (ctx.ProjectRootDocManager = {
          promises: {},
        }),
      })
    )

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter', () => ({
      default: (ctx.ProjectGetter = { promises: {} }),
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: (ctx.UserGetter = { promises: {} }),
    }))

    vi.doMock('../../../../app/src/Features/Compile/ClsiManager', () => ({
      default: (ctx.ClsiManager = { promises: {} }),
    }))

    vi.doMock('../../../../app/src/infrastructure/RateLimiter.mjs', () => ({
      RateLimiter: sinon.stub().returns(ctx.rateLimiter),
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: ctx.Metrics,
    }))

    vi.doMock(
      '../../../../app/src/Features/Analytics/UserAnalyticsIdCache',
      () => ({
        default: (ctx.UserAnalyticsIdCache = {
          get: sinon.stub().resolves('abc'),
        }),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestHandler',
      () => ({
        default: (ctx.SplitTestHandler = {
          promises: {},
        }),
      })
    )

    ctx.CompileManager = (await import(MODULE_PATH)).default
    ctx.project_id = 'mock-project-id-123'
    ctx.user_id = 'mock-user-id-123'
    ctx.callback = sinon.stub()
    ctx.limits = {
      timeout: 42,
      compileGroup: 'standard',
    }
  })

  describe('compile', function () {
    beforeEach(function (ctx) {
      ctx.CompileManager._checkIfRecentlyCompiled = sinon.stub().resolves(false)
      ctx.ProjectRootDocManager.promises.ensureRootDocumentIsSet = sinon
        .stub()
        .resolves()
      ctx.CompileManager.promises.getProjectCompileLimits = sinon
        .stub()
        .resolves(ctx.limits)
      ctx.ClsiManager.promises.sendRequest = sinon.stub().resolves({
        status: (ctx.status = 'mock-status'),
        outputFiles: (ctx.outputFiles = []),
        clsiServerId: (ctx.output = 'mock output'),
      })
    })

    describe('succesfully', function () {
      let result
      beforeEach(async function (ctx) {
        ctx.CompileManager._checkIfAutoCompileLimitHasBeenHit = async (
          isAutoCompile,
          compileGroup
        ) => true
        ctx.ProjectGetter.promises.getProject = sinon
          .stub()
          .resolves(
            (ctx.project = { owner_ref: (ctx.owner_id = 'owner-id-123') })
          )
        ctx.UserGetter.promises.getUser = sinon.stub().resolves(
          (ctx.user = {
            features: { compileTimeout: '20s', compileGroup: 'standard' },
            analyticsId: 'abc',
          })
        )
        result = await ctx.CompileManager.promises.compile(
          ctx.project_id,
          ctx.user_id,
          {}
        )
      })

      it('should check the project has not been recently compiled', function (ctx) {
        ctx.CompileManager._checkIfRecentlyCompiled
          .calledWith(ctx.project_id, ctx.user_id)
          .should.equal(true)
      })

      it('should ensure that the root document is set', function (ctx) {
        ctx.ProjectRootDocManager.promises.ensureRootDocumentIsSet
          .calledWith(ctx.project_id)
          .should.equal(true)
      })

      it('should get the project compile limits', function (ctx) {
        ctx.CompileManager.promises.getProjectCompileLimits
          .calledWith(ctx.project_id)
          .should.equal(true)
      })

      it('should run the compile with the compile limits', function (ctx) {
        ctx.ClsiManager.promises.sendRequest
          .calledWith(ctx.project_id, ctx.user_id, {
            timeout: ctx.limits.timeout,
            compileGroup: 'standard',
            buildId: sinon.match(/[a-f0-9]+-[a-f0-9]+/),
          })
          .should.equal(true)
      })

      it('should resolve with the output', function (ctx) {
        expect(result).to.haveOwnProperty('status', ctx.status)
        expect(result).to.haveOwnProperty('clsiServerId', ctx.output)
        expect(result).to.haveOwnProperty('outputFiles', ctx.outputFiles)
      })

      it('should time the compile', function (ctx) {
        ctx.timer.done.called.should.equal(true)
      })
    })

    describe('when the project has been recently compiled', function () {
      it('should return', async function (ctx) {
        ctx.CompileManager._checkIfAutoCompileLimitHasBeenHit = async (
          isAutoCompile,
          compileGroup
        ) => true
        ctx.CompileManager._checkIfRecentlyCompiled = sinon
          .stub()
          .resolves(true)
        const { status } = await ctx.CompileManager.promises.compile(
          ctx.project_id,
          ctx.user_id,
          {}
        )
        status.should.equal('too-recently-compiled')
      })
    })

    describe('should check the rate limit', function () {
      it('should return', async function (ctx) {
        ctx.CompileManager._checkIfAutoCompileLimitHasBeenHit = sinon
          .stub()
          .resolves(false)
        const { status } = await ctx.CompileManager.promises.compile(
          ctx.project_id,
          ctx.user_id,
          {}
        )

        expect(status).to.equal('autocompile-backoff')
      })
    })
  })

  describe('getProjectCompileLimits', function () {
    beforeEach(async function (ctx) {
      ctx.features = {
        compileTimeout: (ctx.timeout = 42),
        compileGroup: (ctx.group = 'priority'),
      }
      ctx.ProjectGetter.promises.getProject = sinon
        .stub()
        .resolves(
          (ctx.project = { owner_ref: (ctx.owner_id = 'owner-id-123') })
        )
      ctx.UserGetter.promises.getUser = sinon
        .stub()
        .resolves((ctx.user = { features: ctx.features, analyticsId: 'abc' }))
      try {
        const result =
          await ctx.CompileManager.promises.getProjectCompileLimits(
            ctx.project_id
          )
        ctx.callback(null, result)
      } catch (error) {
        ctx.callback(error)
      }
    })

    it('should look up the owner of the project', function (ctx) {
      ctx.ProjectGetter.promises.getProject
        .calledWith(ctx.project_id, { owner_ref: 1, fromV1TemplateId: 1 })
        .should.equal(true)
    })

    it("should look up the owner's features", function (ctx) {
      ctx.UserGetter.promises.getUser
        .calledWith(ctx.project.owner_ref, {
          _id: 1,
          alphaProgram: 1,
          analyticsId: 1,
          betaProgram: 1,
          features: 1,
        })
        .should.equal(true)
    })

    it('should return the limits', function (ctx) {
      ctx.callback
        .calledWith(null, {
          timeout: ctx.timeout,
          compileGroup: ctx.group,
          compileBackendClass: 'c4d',
          ownerAnalyticsId: 'abc',
        })
        .should.equal(true)
    })
  })

  describe('compileBackendClass', function () {
    beforeEach(function (ctx) {
      ctx.features = {
        compileTimeout: 42,
        compileGroup: 'standard',
      }
      ctx.ProjectGetter.promises.getProject = sinon
        .stub()
        .resolves({ owner_ref: 'owner-id-123' })
      ctx.UserGetter.promises.getUser = sinon
        .stub()
        .resolves({ features: ctx.features, analyticsId: 'abc' })
    })

    describe('with priority compile', function () {
      beforeEach(function (ctx) {
        ctx.features.compileGroup = 'priority'
      })
      it('should return the default class', async function (ctx) {
        const { compileBackendClass } =
          await ctx.CompileManager.promises.getProjectCompileLimits(
            ctx.project_id
          )
        expect(compileBackendClass).to.equal('c4d')
      })
    })
  })

  describe('deleteAuxFiles', function () {
    let result

    beforeEach(async function (ctx) {
      ctx.CompileManager.promises.getProjectCompileLimits = sinon
        .stub()
        .resolves((ctx.limits = { compileGroup: 'mock-compile-group' }))
      ctx.ClsiManager.promises.deleteAuxFiles = sinon.stub().resolves('test')
      result = await ctx.CompileManager.promises.deleteAuxFiles(
        ctx.project_id,
        ctx.user_id
      )
    })

    it('should look up the compile group to use', function (ctx) {
      ctx.CompileManager.promises.getProjectCompileLimits
        .calledWith(ctx.project_id)
        .should.equal(true)
    })

    it('should delete the aux files', function (ctx) {
      ctx.ClsiManager.promises.deleteAuxFiles
        .calledWith(ctx.project_id, ctx.user_id, ctx.limits)
        .should.equal(true)
    })

    it('should resolve', function () {
      expect(result).not.to.be.undefined
    })
  })

  describe('_checkIfRecentlyCompiled', function () {
    describe('when the key exists in redis', function () {
      let result

      beforeEach(async function (ctx) {
        ctx.rclient.set = sinon.stub().resolves(null)
        result = await ctx.CompileManager._checkIfRecentlyCompiled(
          ctx.project_id,
          ctx.user_id
        )
      })

      it('should try to set the key', function (ctx) {
        ctx.rclient.set
          .calledWith(
            `compile:${ctx.project_id}:${ctx.user_id}`,
            true,
            'EX',
            ctx.CompileManager.COMPILE_DELAY,
            'NX'
          )
          .should.equal(true)
      })

      it('should resolve with true', function () {
        result.should.equal(true)
      })
    })

    describe('when the key does not exist in redis', function () {
      let result

      beforeEach(async function (ctx) {
        ctx.rclient.set = sinon.stub().resolves('OK')
        result = await ctx.CompileManager._checkIfRecentlyCompiled(
          ctx.project_id,
          ctx.user_id
        )
      })

      it('should try to set the key', function (ctx) {
        ctx.rclient.set
          .calledWith(
            `compile:${ctx.project_id}:${ctx.user_id}`,
            true,
            'EX',
            ctx.CompileManager.COMPILE_DELAY,
            'NX'
          )
          .should.equal(true)
      })

      it('should resolve with false', function () {
        result.should.equal(false)
      })
    })
  })

  describe('_checkIfAutoCompileLimitHasBeenHit', function () {
    it('should be able to compile if it is not an autocompile', async function (ctx) {
      const canCompile =
        await ctx.CompileManager._checkIfAutoCompileLimitHasBeenHit(
          false,
          'everyone'
        )
      expect(canCompile).to.equal(true)
    })

    it('should be able to compile if rate limit has remaining', async function (ctx) {
      const canCompile =
        await ctx.CompileManager._checkIfAutoCompileLimitHasBeenHit(
          true,
          'everyone'
        )

      expect(ctx.rateLimiter.consume).to.have.been.calledWith('global')
      expect(canCompile).to.equal(true)
    })

    it('should be not able to compile if rate limit has no remianing', async function (ctx) {
      ctx.rateLimiter.consume.rejects({ remainingPoints: 0 })
      const canCompile =
        await ctx.CompileManager._checkIfAutoCompileLimitHasBeenHit(
          true,
          'everyone'
        )

      expect(canCompile).to.equal(false)
    })

    it('should return false if there is an error in the rate limit', async function (ctx) {
      ctx.rateLimiter.consume.rejects(new Error('BOOM!'))
      const canCompile =
        await ctx.CompileManager._checkIfAutoCompileLimitHasBeenHit(
          true,
          'everyone'
        )

      expect(canCompile).to.equal(false)
    })
  })

  describe('wordCount', function () {
    let result
    const wordCount = 1

    beforeEach(async function (ctx) {
      ctx.CompileManager.promises.getProjectCompileLimits = sinon
        .stub()
        .resolves((ctx.limits = { compileGroup: 'mock-compile-group' }))
      ctx.ClsiManager.promises.wordCount = sinon.stub().resolves(wordCount)
      result = await ctx.CompileManager.promises.wordCount(
        ctx.project_id,
        ctx.user_id,
        false
      )
    })

    it('should look up the compile group to use', function (ctx) {
      ctx.CompileManager.promises.getProjectCompileLimits
        .calledWith(ctx.project_id)
        .should.equal(true)
    })

    it('should call wordCount for project', function (ctx) {
      ctx.ClsiManager.promises.wordCount
        .calledWith(ctx.project_id, ctx.user_id, false, ctx.limits)
        .should.equal(true)
    })

    it('should resolve with the wordCount from the ClsiManager', function () {
      expect(result).to.equal(wordCount)
    })
  })
})
