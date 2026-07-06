import Path from 'node:path'
import sinon from 'sinon'
import { vi, describe, beforeEach, it, expect } from 'vitest'

const MODULE_PATH = Path.join(import.meta.dirname, '../../../app/js/Png2Pdf')

describe('Png2Pdf', function () {
  beforeEach(async function (ctx) {
    ctx.CommandRunner = {
      promises: {
        run: sinon.stub().resolves({ stdout: '', stderr: '', exitCode: 0 }),
      },
    }

    ctx.Settings = {
      png2pdfImage: 'mock-png2pdf-image',
      enablePng2pdfConversions: true,
      conversionTimeoutSeconds: 60,
      clsi: { dockerRunner: true },
      path: { sandboxedCompilesHostDirCache: '/host/cache' },
    }

    vi.doMock('../../../app/js/CommandRunner', () => ({
      default: ctx.CommandRunner,
    }))

    vi.doMock('@overleaf/settings', () => ({ default: ctx.Settings }))

    vi.doMock('@overleaf/logger', () => ({
      default: { debug: sinon.stub(), warn: sinon.stub(), err: sinon.stub() },
    }))

    ctx.Metrics = {
      Timer: sinon.stub().returns({ done: sinon.stub().returns(42) }),
      count: sinon.stub(),
    }
    vi.doMock('@overleaf/metrics', () => ({ default: ctx.Metrics }))

    ctx.Png2Pdf = (await import(MODULE_PATH)).default
  })

  describe('isEnabled', function () {
    it('is true when enabled, sandboxed, a cache host dir and an image are set', function (ctx) {
      expect(ctx.Png2Pdf.isEnabled()).to.equal(true)
    })

    it('is false when conversions are disabled', function (ctx) {
      ctx.Settings.enablePng2pdfConversions = false
      expect(ctx.Png2Pdf.isEnabled()).to.equal(false)
    })

    it('is false without the docker runner', function (ctx) {
      ctx.Settings.clsi.dockerRunner = false
      expect(ctx.Png2Pdf.isEnabled()).to.equal(false)
    })

    it('is false without a cache host dir', function (ctx) {
      ctx.Settings.path.sandboxedCompilesHostDirCache = undefined
      expect(ctx.Png2Pdf.isEnabled()).to.equal(false)
    })

    it('is false without an image', function (ctx) {
      ctx.Settings.png2pdfImage = undefined
      expect(ctx.Png2Pdf.isEnabled()).to.equal(false)
    })
  })

  describe('convertPngFilesInCacheDir', function () {
    it('runs png2pdf over the files in the cache dir', async function (ctx) {
      ctx.CommandRunner.promises.run.resolves({
        stdout: 'Converted a.tmp to PDF\nConverted b.tmp to PDF\n',
        stderr: '',
        exitCode: 0,
      })
      const stats = {}
      const timings = {}
      await ctx.Png2Pdf.convertPngFilesInCacheDir(
        'project-1',
        '/cache/dir',
        ['a.tmp', 'b.tmp'],
        stats,
        timings
      )
      sinon.assert.calledWith(
        ctx.CommandRunner.promises.run,
        'project-1',
        ['--in-place', '--', 'a.tmp', 'b.tmp'],
        '/cache/dir',
        'mock-png2pdf-image',
        60 * 1000,
        {},
        'png2pdf',
        null
      )
      expect(stats.png2pdf).to.equal(2)
      expect(timings.png2pdf).to.equal(42)
    })

    it('records only the files actually converted (skipped pngs print nothing)', async function (ctx) {
      // The tool converted one of the two attempted files; the other was
      // already fast-includable and skipped silently.
      ctx.CommandRunner.promises.run.resolves({
        stdout: 'Converted a.tmp to PDF\n',
        stderr: '',
        exitCode: 0,
      })
      const stats = {}
      await ctx.Png2Pdf.convertPngFilesInCacheDir(
        'project-1',
        '/cache/dir',
        ['a.tmp', 'b.tmp'],
        stats,
        {}
      )
      expect(stats.png2pdf).to.equal(1)
      sinon.assert.calledWith(ctx.Metrics.count, 'png2pdf-converted', 1)
    })

    it('does nothing when disabled', async function (ctx) {
      ctx.Settings.clsi.dockerRunner = false
      const stats = {}
      const timings = {}
      await ctx.Png2Pdf.convertPngFilesInCacheDir(
        'project-1',
        '/cache/dir',
        ['a.tmp'],
        stats,
        timings
      )
      sinon.assert.notCalled(ctx.CommandRunner.promises.run)
      expect(stats.png2pdf).to.be.undefined
      expect(timings.png2pdf).to.be.undefined
    })

    it('records the timing but not stats on a non-zero exit code', async function (ctx) {
      ctx.CommandRunner.promises.run.resolves({
        stdout: '',
        stderr: 'boom',
        exitCode: 1,
      })
      const stats = {}
      const timings = {}
      await expect(
        ctx.Png2Pdf.convertPngFilesInCacheDir(
          'project-1',
          '/cache/dir',
          ['a.tmp'],
          stats,
          timings
        )
      ).to.be.rejectedWith('non-zero exit code from png2pdf')
      expect(stats.png2pdf).to.be.undefined
      expect(timings.png2pdf).to.equal(42)
    })
  })
})
