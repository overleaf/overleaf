import fs from 'node:fs'
import path from 'node:path'
import { expect, describe, beforeEach, it } from 'vitest'
import LatexMetrics from '../../../app/js/LatexMetrics.js'

const { addLatexFdbMetrics, addLatexMkMetrics } = LatexMetrics

describe('LatexMetrics', function () {
  describe('addLatexFdbMetrics', function () {
    beforeEach(function (ctx) {
      ctx.stats = {}
      Object.defineProperty(ctx.stats, 'latexmk', {
        value: {},
        enumerable: false,
      })
    })

    it('should do nothing if fdbContent is null or empty', function (ctx) {
      addLatexFdbMetrics(null, ctx.stats)
      expect(ctx.stats.latexmk).to.deep.equal({})
      addLatexFdbMetrics('', ctx.stats)
      expect(ctx.stats.latexmk).to.deep.equal({})
    })

    it('should parse v3 fdb content and add to stats', function (ctx) {
      const fdbContent = fs.readFileSync(
        path.join(import.meta.dirname, 'fixtures', 'v3.fdb_latexmk'),
        'utf8'
      )
      addLatexFdbMetrics(fdbContent, ctx.stats)
      expect(ctx.stats.latexmk['fdb-file-types']).to.deep.equal({
        system: [
          { ext: 'fmt', count: 1, size: 3847283 },
          { ext: 'map', count: 2, size: 1644257 },
          { ext: 'pfb', count: 12, size: 404691 },
          { ext: 'sty', count: 19, size: 209868 },
          { ext: 'mkii', count: 1, size: 71627 },
          { ext: 'def', count: 1, size: 55368 },
          { ext: 'cnf', count: 2, size: 32268 },
          { ext: 'bst', count: 1, size: 24635 },
          { ext: 'tfm', count: 16, size: 20608 },
          { ext: 'cls', count: 1, size: 20496 },
          { ext: 'clo', count: 1, size: 8967 },
          { ext: 'cfg', count: 2, size: 4241 },
          { ext: 'fd', count: 2, size: 4089 },
        ],
        user: [
          { ext: 'png', count: 2, size: 3886031 },
          { ext: 'tex', count: 1, size: 6147 },
          { ext: 'aux', count: 1, size: 1080 },
          { ext: 'bib', count: 1, size: 230 },
          { ext: 'bbl', count: 1, size: 203 },
        ],
        total: {
          fontFileCount: 0,
          fontFileSize: 0,
          imageFileCount: 2,
          imageFileSize: 3886031,
          otherFileCount: 2,
          otherFileSize: 1283,
          systemFileCount: 61,
          systemFileSize: 6348398,
          textFileCount: 2,
          textFileSize: 6377,
        },
      })
    })

    it('should parse v4 fdb content and add to stats', function (ctx) {
      const fdbContent = fs.readFileSync(
        path.join(import.meta.dirname, 'fixtures', 'v4.fdb_latexmk'),
        'utf8'
      )
      addLatexFdbMetrics(fdbContent, ctx.stats)
      expect(ctx.stats.latexmk['fdb-file-types']).to.deep.equal({
        system: [
          { ext: 'fmt', count: 1, size: 8172536 },
          { ext: 'map', count: 2, size: 4652176 },
          { ext: 'pfb', count: 13, size: 542949 },
          { ext: 'sty', count: 9, size: 100959 },
          { ext: 'mkii', count: 1, size: 71627 },
          { ext: 'def', count: 2, size: 49388 },
          { ext: 'cnf', count: 2, size: 41037 },
          { ext: 'bst', count: 1, size: 24635 },
          { ext: 'tfm', count: 17, size: 22144 },
          { ext: 'cls', count: 1, size: 20144 },
          { ext: 'clo', count: 1, size: 8448 },
          { ext: 'enc', count: 1, size: 2900 },
          { ext: 'fd', count: 1, size: 2470 },
          { ext: 'cfg', count: 2, size: 1902 },
        ],
        user: [
          { ext: 'png', count: 2, size: 3886031 },
          { ext: 'tex', count: 1, size: 6147 },
          { ext: 'aux', count: 1, size: 1382 },
          { ext: 'bib', count: 1, size: 230 },
          { ext: 'bbl', count: 1, size: 203 },
        ],
        total: {
          fontFileCount: 0,
          fontFileSize: 0,
          imageFileCount: 2,
          imageFileSize: 3886031,
          otherFileCount: 2,
          otherFileSize: 1585,
          systemFileCount: 54,
          systemFileSize: 13713315,
          textFileCount: 2,
          textFileSize: 6377,
        },
      })
    })
  })

  describe('addLatexMkMetrics', function () {
    beforeEach(function (ctx) {
      ctx.stats = {}
      Object.defineProperty(ctx.stats, 'latexmk', {
        value: {},
        enumerable: false,
      })
    })

    describe('latexmk-img-times', function () {
      it('should parse image timing information from stderr', function (ctx) {
        const output = {
          stderr:
            'Image written (PNG, 100 ms): output/image1.png\n' +
            'Image written (JPG, 50 ms): output/image2.jpg\n',
        }
        addLatexMkMetrics(output, ctx.stats)

        expect(ctx.stats.latexmk['latexmk-img-times']).to.deep.equal([
          { type: 'PNG', time_ms: 100 },
          { type: 'JPG', time_ms: 50 },
        ])
      })

      it('should convert PDF type with .png extension to PNG-png2pdf', function (ctx) {
        const output = {
          stderr: 'Image written (PDF, 150 ms): image.png\n',
        }
        addLatexMkMetrics(output, ctx.stats)

        expect(ctx.stats.latexmk['latexmk-img-times']).to.deep.equal([
          { type: 'PNG-png2pdf', time_ms: 150 },
        ])
      })

      it('should handle uppercase .PNG extension', function (ctx) {
        const output = {
          stderr: 'Image written (PDF, 200 ms): image.PNG\n',
        }
        addLatexMkMetrics(output, ctx.stats)

        expect(ctx.stats.latexmk['latexmk-img-times']).to.deep.equal([
          { type: 'PNG-png2pdf', time_ms: 200 },
        ])
      })

      it('should keep PDF type for non-png extensions', function (ctx) {
        const output = {
          stderr:
            'Image written (PDF, 100 ms): document.pdf\n' +
            'Image written (PDF, 80 ms): image.jpg\n',
        }
        addLatexMkMetrics(output, ctx.stats)

        expect(ctx.stats.latexmk['latexmk-img-times']).to.deep.equal([
          { type: 'PDF', time_ms: 180 },
        ])
      })

      it('should accumulate timing for the same type', function (ctx) {
        const output = {
          stderr:
            'Image written (PDF, 100 ms): image1.png\n' +
            'Image written (PDF, 150 ms): image2.png\n' +
            'Image written (PNG, 50 ms): image3.png\n',
        }
        addLatexMkMetrics(output, ctx.stats)

        const result = ctx.stats.latexmk['latexmk-img-times'].sort((a, b) =>
          a.type.localeCompare(b.type)
        )
        expect(result).to.deep.equal([
          { type: 'PNG', time_ms: 50 },
          { type: 'PNG-png2pdf', time_ms: 250 },
        ])
      })

      it('should handle PNG with category from PNG copy skipped', function (ctx) {
        const output = {
          stderr:
            'PNG copy skipped (alpha): image1.png\n' +
            'Image written (PNG, 75 ms): image1.png\n',
        }
        addLatexMkMetrics(output, ctx.stats)

        expect(ctx.stats.latexmk['latexmk-img-times']).to.deep.equal([
          { type: 'PNG-alpha', time_ms: 75 },
        ])
      })

      it('should mix PDF-to-png2pdf and PNG types', function (ctx) {
        const output = {
          stderr:
            'Image written (PDF, 100 ms): converted.png\n' +
            'Image written (PNG, 50 ms): native.png\n' +
            'Image written (JPG, 30 ms): photo.jpg\n',
        }
        addLatexMkMetrics(output, ctx.stats)

        const result = ctx.stats.latexmk['latexmk-img-times'].sort((a, b) =>
          a.type.localeCompare(b.type)
        )
        expect(result).to.deep.equal([
          { type: 'JPG', time_ms: 30 },
          { type: 'PNG', time_ms: 50 },
          { type: 'PNG-png2pdf', time_ms: 100 },
        ])
      })
    })
  })
})
