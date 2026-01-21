import { vi, expect, describe, beforeEach, it } from 'vitest'

import sinon from 'sinon'
import path from 'node:path'

const modulePath = path.join(import.meta.dirname, '../../../app/js/UrlCache')

describe('UrlCache', () => {
  beforeEach(async ctx => {
    ctx.callback = sinon.stub()
    ctx.url =
      'http://filestore/project/60b0dd39c418bc00598a0d22/file/60ae721ffb1d920027d3201f'
    ctx.fallbackURL = 'http://filestore/bucket/project-blobs/key/ab/cd/ef'
    ctx.project_id = '60b0dd39c418bc00598a0d22'

    vi.doMock('../../../app/js/UrlFetcher', () => ({
      default: (ctx.UrlFetcher = {
        promises: { pipeUrlToFileWithRetry: sinon.stub().resolves() },
      }),
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.Settings = {
        path: { clsiCacheDir: '/cache/dir' },
      }),
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: {
        Timer: sinon.stub().returns({ done: sinon.stub() }),
      },
    }))

    ctx.fs = {
      promises: {
        rm: sinon.stub().resolves(),
        copyFile: sinon.stub().resolves(),
      },
    }

    vi.doMock('fs', () => ({ default: ctx.fs }))

    return (ctx.UrlCache = (await import(modulePath)).default)
  })

  describe('downloadUrlToFile', () => {
    beforeEach(ctx => {
      ctx.destPath = 'path/to/destination'
    })

    it('should not download on the happy path', async ctx => {
      await new Promise((resolve, reject) => {
        ctx.UrlCache.downloadUrlToFile(
          ctx.project_id,
          ctx.url,
          ctx.fallbackURL,
          ctx.destPath,
          ctx.lastModified,
          error => {
            expect(error).to.not.exist
            expect(
              ctx.UrlFetcher.promises.pipeUrlToFileWithRetry.called
            ).to.equal(false)
            resolve()
          }
        )
      })
    })

    it('should not download on the semi-happy path', async ctx => {
      await new Promise((resolve, reject) => {
        const codedError = new Error()
        codedError.code = 'ENOENT'
        ctx.fs.promises.copyFile.onCall(0).rejects(codedError)
        ctx.fs.promises.copyFile.onCall(1).resolves()

        ctx.UrlCache.downloadUrlToFile(
          ctx.project_id,
          ctx.url,
          ctx.fallbackURL,
          ctx.destPath,
          ctx.lastModified,
          error => {
            expect(error).to.not.exist
            expect(
              ctx.UrlFetcher.promises.pipeUrlToFileWithRetry.called
            ).to.equal(false)
            resolve()
          }
        )
      })
    })

    it('should download on cache miss', async ctx => {
      await new Promise((resolve, reject) => {
        const codedError = new Error()
        codedError.code = 'ENOENT'
        ctx.fs.promises.copyFile.onCall(0).rejects(codedError)
        ctx.fs.promises.copyFile.onCall(1).rejects(codedError)
        ctx.fs.promises.copyFile.onCall(2).resolves()

        ctx.UrlCache.downloadUrlToFile(
          ctx.project_id,
          ctx.url,
          ctx.fallbackURL,
          ctx.destPath,
          ctx.lastModified,
          error => {
            expect(error).to.not.exist
            expect(
              ctx.UrlFetcher.promises.pipeUrlToFileWithRetry.called
            ).to.equal(true)
            resolve()
          }
        )
      })
    })

    it('should raise non cache-miss errors', async ctx => {
      await new Promise((resolve, reject) => {
        const codedError = new Error()
        codedError.code = 'FOO'
        ctx.fs.promises.copyFile.rejects(codedError)
        ctx.UrlCache.downloadUrlToFile(
          ctx.project_id,
          ctx.url,
          ctx.fallbackURL,
          ctx.destPath,
          ctx.lastModified,
          error => {
            expect(error).to.equal(codedError)
            resolve()
          }
        )
      })
    })
  })

  describe('clearProject', () => {
    beforeEach(async ctx => {
      await ctx.UrlCache.promises.clearProject(ctx.project_id)
    })

    it('should clear the cache in bulk', ctx => {
      expect(
        ctx.fs.promises.rm.calledWith('/cache/dir/' + ctx.project_id, {
          force: true,
          recursive: true,
        })
      ).to.equal(true)
    })
  })
})
