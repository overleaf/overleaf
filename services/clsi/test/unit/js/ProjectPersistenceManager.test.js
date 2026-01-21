import { vi, describe, beforeEach, it } from 'vitest'
import sinon from 'sinon'
import path from 'node:path'

const modulePath = path.join(
  import.meta.dirname,
  '../../../app/js/ProjectPersistenceManager'
)

describe('ProjectPersistenceManager', () => {
  beforeEach(async ctx => {
    ctx.fsPromises = {
      statfs: sinon.stub(),
    }

    vi.doMock('@overleaf/metrics', () => ({
      default: (ctx.Metrics = { gauge: sinon.stub() }),
    }))

    vi.doMock('../../../app/js/UrlCache', () => ({
      default: (ctx.UrlCache = {}),
    }))

    vi.doMock('../../../app/js/CompileManager', () => ({
      default: (ctx.CompileManager = {}),
    }))

    vi.doMock('fs', () => ({
      default: { promises: ctx.fsPromises },
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.settings = {
        project_cache_length_ms: 1000,
        path: {
          compilesDir: '/compiles',
          outputDir: '/output',
          clsiCacheDir: '/cache',
        },
      }),
    }))

    ctx.ProjectPersistenceManager = (await import(modulePath)).default
    ctx.callback = sinon.stub()
    ctx.project_id = 'project-id-123'
    return (ctx.user_id = '1234')
  })

  describe('refreshExpiryTimeout', () => {
    it('should leave expiry alone if plenty of disk', async ctx => {
      await new Promise((resolve, reject) => {
        ctx.fsPromises.statfs.resolves({
          blocks: 100,
          bsize: 1,
          bavail: 40,
        })

        ctx.ProjectPersistenceManager.refreshExpiryTimeout(() => {
          ctx.Metrics.gauge.should.have.been.calledWith(
            'disk_available_percent',
            40
          )
          ctx.ProjectPersistenceManager.EXPIRY_TIMEOUT.should.equal(
            ctx.settings.project_cache_length_ms
          )
          resolve()
        })
      })
    })

    it('should drop EXPIRY_TIMEOUT 10% if low disk usage', async ctx => {
      await new Promise((resolve, reject) => {
        ctx.fsPromises.statfs.resolves({
          blocks: 100,
          bsize: 1,
          bavail: 5,
        })

        ctx.ProjectPersistenceManager.refreshExpiryTimeout(() => {
          ctx.Metrics.gauge.should.have.been.calledWith(
            'disk_available_percent',
            5
          )
          ctx.ProjectPersistenceManager.EXPIRY_TIMEOUT.should.equal(900)
          resolve()
        })
      })
    })

    it('should not drop EXPIRY_TIMEOUT to below 50% of project_cache_length_ms', async ctx => {
      await new Promise((resolve, reject) => {
        ctx.fsPromises.statfs.resolves({
          blocks: 100,
          bsize: 1,
          bavail: 5,
        })
        ctx.ProjectPersistenceManager.EXPIRY_TIMEOUT = 500
        ctx.ProjectPersistenceManager.refreshExpiryTimeout(() => {
          ctx.Metrics.gauge.should.have.been.calledWith(
            'disk_available_percent',
            5
          )
          ctx.ProjectPersistenceManager.EXPIRY_TIMEOUT.should.equal(500)
          resolve()
        })
      })
    })

    it('should not modify EXPIRY_TIMEOUT if there is an error getting disk values', async ctx => {
      await new Promise((resolve, reject) => {
        ctx.fsPromises.statfs.rejects(new Error())
        ctx.ProjectPersistenceManager.refreshExpiryTimeout(() => {
          ctx.ProjectPersistenceManager.EXPIRY_TIMEOUT.should.equal(1000)
          resolve()
        })
      })
    })
  })

  describe('clearExpiredProjects', () => {
    beforeEach(ctx => {
      ctx.project_ids = ['project-id-1', 'project-id-2']
      ctx.ProjectPersistenceManager._findExpiredProjectIds = sinon
        .stub()
        .callsArgWith(0, null, ctx.project_ids)
      ctx.ProjectPersistenceManager.clearProjectFromCache = sinon
        .stub()
        .callsArg(2)
      ctx.CompileManager.clearExpiredProjects = sinon.stub().callsArg(1)
      return ctx.ProjectPersistenceManager.clearExpiredProjects(ctx.callback)
    })

    it('should clear each expired project', ctx => {
      return Array.from(ctx.project_ids).map(projectId =>
        ctx.ProjectPersistenceManager.clearProjectFromCache
          .calledWith(projectId)
          .should.equal(true)
      )
    })

    return it('should call the callback', ctx => {
      return ctx.callback.called.should.equal(true)
    })
  })

  return describe('clearProject', () => {
    beforeEach(ctx => {
      ctx.ProjectPersistenceManager._clearProjectFromDatabase = sinon
        .stub()
        .callsArg(1)
      ctx.UrlCache.clearProject = sinon.stub().callsArg(2)
      ctx.CompileManager.clearProject = sinon.stub().callsArg(2)
      return ctx.ProjectPersistenceManager.clearProject(
        ctx.project_id,
        ctx.user_id,
        ctx.callback
      )
    })

    it('should clear the project from the database', ctx => {
      return ctx.ProjectPersistenceManager._clearProjectFromDatabase
        .calledWith(ctx.project_id)
        .should.equal(true)
    })

    it('should clear all the cached Urls for the project', ctx => {
      return ctx.UrlCache.clearProject
        .calledWith(ctx.project_id)
        .should.equal(true)
    })

    it('should clear the project compile folder', ctx => {
      return ctx.CompileManager.clearProject
        .calledWith(ctx.project_id, ctx.user_id)
        .should.equal(true)
    })

    return it('should call the callback', ctx => {
      return ctx.callback.called.should.equal(true)
    })
  })
})
