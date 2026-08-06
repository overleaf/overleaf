import Path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import sinon from 'sinon'
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest'

const MODULE_PATH = Path.join(
  import.meta.dirname,
  '../../../app/js/HistoryResourceWriter'
)

describe('HistoryResourceWriter', function () {
  beforeEach(async function (ctx) {
    ctx.tmp = fs.mkdtempSync(Path.join(os.tmpdir(), 'clsi-hrw-'))
    ctx.projectId = 'p1'
    ctx.userId = 'u1'
    ctx.cacheKey = `${ctx.projectId}-${ctx.userId}`
    ctx.compileDir = Path.join(ctx.tmp, 'compiles', ctx.cacheKey)
    fs.mkdirSync(ctx.compileDir, { recursive: true })

    ctx.Settings = {
      path: { clsiCacheDir: Path.join(ctx.tmp, 'cache') },
      parallelFileDownloads: 1,
      png2pdfMinFileSizeBytes: 1024 * 1024,
      apis: {
        filestore: { url: 'http://filestore.test' },
        clsiPerf: { host: 'perf.test' },
      },
    }

    // Models the on-disk cache: `optCache` holds the urls that have an optimised
    // (.opt) entry. A conversion download misses the first time (returns a
    // handle and records the .opt entry) and hits thereafter (returns
    // undefined, i.e. no reconversion). Every download writes the destination
    // file so the compile dir reflects what a real download would leave behind.
    ctx.optCache = new Set()
    ctx.downloadUrlToFile = sinon
      .stub()
      .callsFake(
        async (projectId, url, fallback, destPath, lastModified, suffix) => {
          await fs.promises.writeFile(destPath, 'png-bytes')
          if (suffix) {
            if (ctx.optCache.has(url)) return undefined
            ctx.optCache.add(url)
            return {
              conversionPath: destPath + '.conv',
              cachePath: destPath + '.opt',
              destPath,
            }
          }
          return undefined
        }
      )
    ctx.commitConversion = sinon.stub().resolves()
    ctx.isConversionCached = sinon
      .stub()
      .callsFake(async (projectId, url) => ctx.optCache.has(url))
    ctx.UrlCache = {
      promises: {
        createProjectDir: sinon.stub().resolves(),
        downloadUrlToFile: ctx.downloadUrlToFile,
        commitConversion: ctx.commitConversion,
        isConversionCached: ctx.isConversionCached,
      },
      getProjectCacheDir: sinon
        .stub()
        .returns(Path.join(ctx.tmp, 'cache', ctx.projectId)),
    }

    ctx.convertPng = sinon.stub().resolves()
    ctx.Png2Pdf = {
      isEnabled: () => true,
      convertPngFilesInCacheDir: ctx.convertPng,
    }

    vi.doMock('@overleaf/settings', () => ({ default: ctx.Settings }))
    vi.doMock('@overleaf/logger', () => ({
      default: { debug: sinon.stub(), warn: sinon.stub(), err: sinon.stub() },
    }))
    vi.doMock('@overleaf/metrics', () => ({ default: { inc: sinon.stub() } }))
    vi.doMock('@overleaf/fetch-utils', () => ({
      fetchString: sinon.stub(),
      RequestFailedError: class extends Error {},
    }))
    vi.doMock('../../../app/js/UrlCache', () => ({ default: ctx.UrlCache }))
    vi.doMock('../../../app/js/Png2Pdf', () => ({ default: ctx.Png2Pdf }))
    vi.doMock('../../../app/js/TikzManager', () => ({
      default: { writeOutputFileIfNeeded: sinon.stub().resolves() },
    }))
    vi.doMock('../../../app/js/DraftModeManager', () => ({
      default: { PREFIX: '' },
    }))
    vi.doMock('../../../app/js/CLSICacheHandler', () => ({
      default: { downloadHistorySnapshot: sinon.stub().resolves(false) },
    }))
    vi.doMock('../../../app/js/ResourceWriter', () => ({
      default: { isExtraneousFile: () => false },
    }))
    vi.doMock('../../../app/js/Metrics', () => ({
      default: {
        shouldSkipMetrics: () => true,
        snapshotApplyAllDurationSeconds: { observe: sinon.stub() },
        snapshotLoadEagerDurationSeconds: { observe: sinon.stub() },
      },
    }))
    // Use the real overleaf-editor-core Snapshot/File; the fixtures below are
    // representable without any blob loading (an inline string file and a
    // hash+byteLength binary file), so no blobStore access is needed.

    ctx.HistoryResourceWriter = await import(MODULE_PATH)

    // Real overleaf-editor-core raw FileMap: an object keyed by pathname.
    // { hash, byteLength } -> BinaryFileData (the PNG); { content } ->
    // StringFileData (the root doc). The hash must be a 40-char hex string.
    ctx.pngHash = '0123456789012345678901234567890123456789'
    ctx.rawSnapshot = {
      files: {
        'fig.png': { hash: ctx.pngHash, byteLength: 2 * 1024 * 1024 },
        'main.tex': { content: 'hello' },
      },
    }
    ctx.makeRequest = (overrides = {}) => ({
      project_id: ctx.projectId,
      user_id: ctx.userId,
      baseHistoryVersion: 0,
      rawSnapshot: ctx.rawSnapshot,
      globalBlobs: [],
      rawChangeOperations: [],
      populateClsiCache: false,
      png2pdf: true,
      historyId: 'hist1',
      filestoreBlobPrefix: '',
      clsiPerfVariant: '',
      draft: false,
      rootResourcePath: 'main.tex',
      compileGroup: 'standard',
      ...overrides,
    })
    ctx.sync = async (overrides = {}) => {
      const stats = {}
      const result = await ctx.HistoryResourceWriter.syncResourcesToDisk(
        ctx.projectId,
        ctx.userId,
        ctx.makeRequest(overrides),
        ctx.compileDir,
        {},
        stats
      )
      return { ...result, stats }
    }
  })

  afterEach(function (ctx) {
    fs.rmSync(ctx.tmp, { recursive: true, force: true })
    vi.resetModules()
    vi.clearAllMocks()
  })

  describe('saveSlowPngList', function () {
    it('writes the list to png2pdf-slow.json in the cache dir', async function (ctx) {
      await ctx.HistoryResourceWriter.saveSlowPngList(ctx.cacheKey, [
        'a.png',
        'b.png',
      ])
      const file = Path.join(
        ctx.Settings.path.clsiCacheDir,
        ctx.cacheKey,
        'png2pdf-slow.json'
      )
      expect(JSON.parse(fs.readFileSync(file, 'utf-8'))).to.deep.equal([
        'a.png',
        'b.png',
      ])
    })
  })

  describe('slow-list-gated conversion', function () {
    it('does not convert PNGs until they are known to be slow, then converts once', async function (ctx) {
      // Sync 1: no slow-list yet -> the PNG is downloaded normally, not converted.
      await ctx.sync()
      expect(ctx.downloadUrlToFile.callCount).to.equal(1)
      expect(ctx.downloadUrlToFile.getCall(0).args[3]).to.equal(
        Path.join(ctx.compileDir, 'fig.png')
      )
      expect(ctx.downloadUrlToFile).to.have.been.calledOnce
      expect(ctx.downloadUrlToFile).to.have.been.calledWithMatch(
        ctx.projectId,
        sinon.match.string,
        null,
        Path.join(ctx.compileDir, 'fig.png'),
        sinon.match.date
      )
      expect(ctx.convertPng.called).to.equal(false)

      // A compile then flags fig.png as slow.
      await ctx.HistoryResourceWriter.saveSlowPngList(ctx.cacheKey, ['fig.png'])

      // Sync 2: the newly-slow PNG is pulled in and routed through conversion.
      ctx.downloadUrlToFile.resetHistory()
      ctx.convertPng.resetHistory()
      ctx.commitConversion.resetHistory()
      await ctx.sync()
      expect(ctx.downloadUrlToFile.callCount).to.equal(1)
      expect(ctx.downloadUrlToFile.getCall(0).args[5]).to.equal(ctx.cacheKey)
      expect(ctx.convertPng.calledOnce).to.equal(true)
      expect(ctx.commitConversion.calledOnce).to.equal(true)

      // Sync 3: already attempted -> not converted again (attempt-once).
      ctx.downloadUrlToFile.resetHistory()
      ctx.convertPng.resetHistory()
      await ctx.sync()
      expect(ctx.convertPng.called).to.equal(false)
      expect(ctx.downloadUrlToFile.called).to.equal(false)
    })

    it('re-serves an already-optimised PNG after a png2pdf mode switch', async function (ctx) {
      // Get fig.png converted so it has an .opt cache entry.
      await ctx.HistoryResourceWriter.saveSlowPngList(ctx.cacheKey, ['fig.png'])
      await ctx.sync()
      expect(ctx.convertPng.calledOnce).to.equal(true)

      // The next compile no longer flags it slow (it is now included as a PDF),
      // so it drops off the slow-list.
      await ctx.HistoryResourceWriter.saveSlowPngList(ctx.cacheKey, [])

      // Toggle png2pdf off: the PNG reverts to the original on disk (downloaded
      // without the conversion cacheKey suffix).
      ctx.downloadUrlToFile.resetHistory()
      ctx.convertPng.resetHistory()
      await ctx.sync({ png2pdf: false })
      expect(ctx.downloadUrlToFile.calledOnce).to.equal(true)
      expect(ctx.downloadUrlToFile.getCall(0).args[5]).to.equal(undefined)

      // Toggle png2pdf back on: even though fig.png is no longer on the
      // slow-list, its cached .opt entry is re-served (routed through the
      // conversion path with the cacheKey), so it is restored to the optimised
      // variant rather than reverting to the original - and without a new
      // conversion.
      ctx.downloadUrlToFile.resetHistory()
      ctx.convertPng.resetHistory()
      await ctx.sync({ png2pdf: true })
      expect(ctx.downloadUrlToFile.calledOnce).to.equal(true)
      expect(ctx.downloadUrlToFile.getCall(0).args[5]).to.equal(ctx.cacheKey)
      expect(ctx.convertPng.called).to.equal(false)
    })
  })

  describe('projectHasUnconvertedPngs (analytics flag)', function () {
    it('reports false and converts nothing when no PNG is on the slow-list', async function (ctx) {
      // No slow-list saved: fig.png is large enough to convert but was never
      // flagged slow, so it is not a conversion candidate.
      const { stats } = await ctx.sync()
      expect(stats.projectHasUnconvertedPngs).to.equal(undefined)
      expect(stats['optimisable-png-count']).to.equal(undefined)
      expect(ctx.convertPng.called).to.equal(false)
    })

    it('reports true without converting when the project has a slow PNG but png2pdf is off', async function (ctx) {
      // The headline analytics case: a project in the default (non-png2pdf)
      // group that WOULD have had a PNG converted is still flagged, so the two
      // rollout groups can be compared like-for-like - but no conversion runs.
      await ctx.HistoryResourceWriter.saveSlowPngList(ctx.cacheKey, ['fig.png'])
      const { stats } = await ctx.sync({ png2pdf: false })
      expect(stats.projectHasUnconvertedPngs).to.equal(1)
      expect(stats['optimisable-png-count']).to.equal(1)
      expect(ctx.convertPng.called).to.equal(false)
    })

    it('reports true and converts when the project has a slow PNG and png2pdf is on', async function (ctx) {
      // The rollout group: the same convertible PNG is both flagged and
      // actually converted. The flag is independent of mode; conversion tracks
      // mode.
      await ctx.HistoryResourceWriter.saveSlowPngList(ctx.cacheKey, ['fig.png'])
      const { stats } = await ctx.sync({ png2pdf: true })
      expect(stats.projectHasUnconvertedPngs).to.equal(1)
      expect(stats['optimisable-png-count']).to.equal(1)
      expect(ctx.convertPng.calledOnce).to.equal(true)
    })

    it('reports false for a slow PNG below the conversion size threshold', async function (ctx) {
      // A slow-listed PNG that is too small to be worth converting is not a
      // conversion candidate, so it must not be counted as convertible either -
      // the analytics flag uses the same size-filtered set as conversion, so
      // the optimised and default groups stay comparable.
      ctx.rawSnapshot.files['fig.png'].byteLength = 512 * 1024
      await ctx.HistoryResourceWriter.saveSlowPngList(ctx.cacheKey, ['fig.png'])
      const { stats } = await ctx.sync({ png2pdf: true })
      expect(stats.projectHasUnconvertedPngs).to.equal(undefined)
      expect(stats['optimisable-png-count']).to.equal(undefined)
      expect(ctx.convertPng.called).to.equal(false)
    })

    it('counts each convertible PNG separately when multiple are slow', async function (ctx) {
      // With a single PNG, the count can never be more than 1 and so is
      // indistinguishable from the boolean flag - add a second qualifying PNG
      // to prove this field is an actual count.
      ctx.rawSnapshot.files['fig2.png'] = {
        hash: '1123456789012345678901234567890123456789',
        byteLength: 2 * 1024 * 1024,
      }
      await ctx.HistoryResourceWriter.saveSlowPngList(ctx.cacheKey, [
        'fig.png',
        'fig2.png',
      ])
      const { stats } = await ctx.sync({ png2pdf: true })
      expect(stats.projectHasUnconvertedPngs).to.equal(1)
      expect(stats['optimisable-png-count']).to.equal(2)
    })

    it('only counts the PNGs above the size threshold when slow PNGs are mixed', async function (ctx) {
      // One slow PNG qualifies by size and one does not - the count must
      // reflect only the size-filtered set, not the raw slow-list size.
      ctx.rawSnapshot.files['fig.png'].byteLength = 512 * 1024 // below threshold
      ctx.rawSnapshot.files['fig2.png'] = {
        hash: '1123456789012345678901234567890123456789',
        byteLength: 2 * 1024 * 1024, // above threshold
      }
      await ctx.HistoryResourceWriter.saveSlowPngList(ctx.cacheKey, [
        'fig.png',
        'fig2.png',
      ])
      const { stats } = await ctx.sync({ png2pdf: true })
      expect(stats.projectHasUnconvertedPngs).to.equal(1)
      expect(stats['optimisable-png-count']).to.equal(1)
    })
  })
})
