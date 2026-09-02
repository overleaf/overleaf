import { beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'
import MockRequest from '../helpers/MockRequest.mjs'
import MockResponse from '../helpers/MockResponse.mjs'
import {
  NotFoundError,
  ResourceGoneError,
} from '../../../../app/src/Features/Errors/Errors.js'

const MODULE_PATH =
  '../../../../app/src/Features/Compile/ClsiCacheController.mjs'

// pin Errors.js to a single module instance so `instanceof` checks in the
// controller (loaded dynamically below, after other modules are mocked)
// see the same error classes this file imports statically
vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)

describe('ClsiCacheController', function () {
  beforeEach(async function (ctx) {
    // Project_id/editorBuildId are validated by the schema
    ctx.projectId = '507f191e810c19729de860ea'
    ctx.userId = '507f191e810c19729de860eb'
    ctx.editorBuildId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa-1111111-2222222'

    ctx.ClsiCacheHandler = {
      isAllowedFilename: sinon.stub().returns(true),
      getOutputFile: sinon.stub(),
      getEgressLabel: sinon.stub().returns('output.pdf'),
    }
    ctx.ClsiCacheManager = { getLatestCompileResult: sinon.stub() }
    ctx.CompileController = {
      _getUserIdForCompile: sinon.stub().returns(ctx.userId),
      _getSafeProjectName: sinon.stub().returns('project-name'),
      _getSplitTestOptions: sinon.stub().resolves({
        pdfCachingMinChunkSize: 100,
        pdfDownloadDomain: 'https://example.com',
      }),
    }
    ctx.ProjectGetter = {
      promises: { getProject: sinon.stub().resolves({ name: 'project' }) },
    }

    vi.doMock('../../../../app/src/Features/Compile/ClsiCacheHandler', () => ({
      default: ctx.ClsiCacheHandler,
    }))
    vi.doMock('../../../../app/src/Features/Compile/ClsiCacheManager', () => ({
      default: ctx.ClsiCacheManager,
    }))
    vi.doMock('../../../../app/src/Features/Compile/CompileController', () => ({
      default: ctx.CompileController,
    }))
    vi.doMock('../../../../app/src/Features/Project/ProjectGetter', () => ({
      default: ctx.ProjectGetter,
    }))

    ctx.controller = (await import(MODULE_PATH)).default
    ctx.req = new MockRequest(vi)
    ctx.req.params = { Project_id: ctx.projectId }
    ctx.res = new MockResponse(vi)
    ctx.res.json = sinon.stub()
    ctx.res.sendStatus = sinon.stub()
  })

  describe('getLatestBuildFromCache', function () {
    beforeEach(function (ctx) {
      ctx.result = {
        zone: 'a',
        outputFiles: [],
        compileGroup: 'standard',
        clsiServerId: 'server-1',
        clsiCacheShard: 'shard-1',
        options: {},
        stats: {},
        timings: {},
      }
    })

    it('should return the cached compile result as json', async function (ctx) {
      ctx.ClsiCacheManager.getLatestCompileResult.resolves(ctx.result)
      await ctx.controller.getLatestBuildFromCache(ctx.req, ctx.res)
      ctx.ClsiCacheManager.getLatestCompileResult
        .calledWith(ctx.projectId, ctx.userId)
        .should.equal(true)
      ctx.res.json
        .calledWithMatch({
          fromCache: true,
          status: 'success',
          clsiServerId: 'server-1',
          pdfDownloadDomain: 'https://example.com/zone/a',
        })
        .should.equal(true)
    })

    it('should return 404 when the compile result is not found', async function (ctx) {
      ctx.ClsiCacheManager.getLatestCompileResult.rejects(new NotFoundError())
      await ctx.controller.getLatestBuildFromCache(ctx.req, ctx.res)
      ctx.res.sendStatus.calledWith(404).should.equal(true)
    })

    it('should return 410 when the compile result is gone', async function (ctx) {
      ctx.ClsiCacheManager.getLatestCompileResult.rejects(
        new ResourceGoneError()
      )
      await ctx.controller.getLatestBuildFromCache(ctx.req, ctx.res)
      ctx.res.sendStatus.calledWith(410).should.equal(true)
    })

    it('should reject a malformed project id', async function (ctx) {
      ctx.req.params = { Project_id: 'not-an-object-id' }
      await expect(ctx.controller.getLatestBuildFromCache(ctx.req, ctx.res)).to
        .be.rejected
      ctx.ClsiCacheManager.getLatestCompileResult.called.should.equal(false)
    })
  })

  describe('downloadFromCache', function () {
    beforeEach(function (ctx) {
      ctx.req.params = {
        Project_id: ctx.projectId,
        editorBuildId: ctx.editorBuildId,
        filename: 'output.pdf',
      }
    })

    it('should reject a malformed project id', async function (ctx) {
      ctx.req.params.Project_id = 'not-an-object-id'
      await expect(ctx.controller.downloadFromCache(ctx.req, ctx.res)).to.be
        .rejected
      ctx.ClsiCacheHandler.getOutputFile.called.should.equal(false)
    })

    it('should reject a malformed editorBuildId', async function (ctx) {
      ctx.req.params.editorBuildId = 'not-a-valid-build-id'
      await expect(ctx.controller.downloadFromCache(ctx.req, ctx.res)).to.be
        .rejected
      ctx.ClsiCacheHandler.getOutputFile.called.should.equal(false)
    })

    it('should reject a path traversal filename', async function (ctx) {
      ctx.req.params.filename = '../../../etc/passwd'
      await expect(ctx.controller.downloadFromCache(ctx.req, ctx.res)).to.be
        .rejected
      ctx.ClsiCacheHandler.getOutputFile.called.should.equal(false)
    })

    it('should reject a filename rejected by ClsiCacheHandler', async function (ctx) {
      ctx.ClsiCacheHandler.isAllowedFilename.returns(false)
      await expect(ctx.controller.downloadFromCache(ctx.req, ctx.res)).to.be
        .rejected
      ctx.ClsiCacheHandler.getOutputFile.called.should.equal(false)
    })
  })
})
