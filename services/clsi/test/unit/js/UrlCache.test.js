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

    vi.doMock('../../../app/js/Png2Pdf', () => ({
      default: (ctx.Png2Pdf = {
        isEnabled: sinon.stub().returns(false),
        convertPngFilesInCacheDir: sinon.stub().resolves(),
      }),
    }))

    ctx.fs = {
      promises: {
        rm: sinon.stub().resolves(),
        copyFile: sinon.stub().resolves(),
        rename: sinon.stub().resolves(),
        access: sinon.stub().resolves(),
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

  describe('downloadUrlToFile with a conversion suffix', () => {
    beforeEach(ctx => {
      ctx.destPath = 'path/to/destination'
      ctx.conversionSuffix = '-user-cache-key'
    })

    it('should serve the optimized .opt variant from the cache', async ctx => {
      const result = await ctx.UrlCache.promises.downloadUrlToFile(
        ctx.project_id,
        ctx.url,
        ctx.fallbackURL,
        ctx.destPath,
        ctx.lastModified,
        ctx.conversionSuffix
      )
      // a cache hit copies the already-final file to destPath and returns nothing
      expect(result).to.be.undefined
      expect(ctx.fs.promises.copyFile.firstCall.args[0]).to.match(/\.opt$/)
      expect(ctx.UrlFetcher.promises.pipeUrlToFileWithRetry.called).to.equal(
        false
      )
    })

    it('should return a conversion handle pointing at the .opt path on a cache miss', async ctx => {
      const codedError = new Error()
      codedError.code = 'ENOENT'
      // miss on both the primary and the fallback .opt cache paths
      ctx.fs.promises.copyFile.onCall(0).rejects(codedError)
      ctx.fs.promises.copyFile.onCall(1).rejects(codedError)

      const result = await ctx.UrlCache.promises.downloadUrlToFile(
        ctx.project_id,
        ctx.url,
        ctx.fallbackURL,
        ctx.destPath,
        ctx.lastModified,
        ctx.conversionSuffix
      )

      expect(result.destPath).to.equal(ctx.destPath)
      expect(result.cachePath).to.match(/\.opt$/)
      expect(result.conversionPath).to.equal(
        result.cachePath + ctx.conversionSuffix
      )
      // the original is downloaded to the per-user conversion path, not destPath
      expect(
        ctx.UrlFetcher.promises.pipeUrlToFileWithRetry.calledWith(
          ctx.url,
          ctx.fallbackURL,
          result.conversionPath
        )
      ).to.equal(true)
    })
  })

  describe('commitConversion', () => {
    it('should rename the conversion file onto the cache path and copy it to dest', async ctx => {
      const conversionPath = '/cache/dir/project/key.opt-user-cache-key'
      const cachePath = '/cache/dir/project/key.opt'
      const destPath = 'path/to/destination'
      await ctx.UrlCache.promises.commitConversion(
        conversionPath,
        cachePath,
        destPath
      )
      expect(
        ctx.fs.promises.rename.calledWith(conversionPath, cachePath)
      ).to.equal(true)
      expect(ctx.fs.promises.copyFile.calledWith(cachePath, destPath)).to.equal(
        true
      )
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
