import { describe, it, expect } from 'vitest'
import {
  A4_PT,
  pdfPageSize,
  fitContent,
} from '../../../frontend/js/util/diagram-export.ts'

describe('pdfPageSize', function () {
  it('uses the SVG width/height as the page size (1 unit = 1 pt)', function () {
    const p = pdfPageSize('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"></svg>')
    expect(p).toEqual({ w: 400, h: 300, fallback: false })
  })

  it('accepts px-suffixed dimensions', function () {
    const p = pdfPageSize('<svg width="200px" height="100px"></svg>')
    expect(p).toEqual({ w: 200, h: 100, fallback: false })
  })

  it('rounds to two decimals', function () {
    const p = pdfPageSize('<svg width="722.7467811158798" height="510.7296137339056"></svg>')
    expect(p).toEqual({ w: 722.75, h: 510.73, fallback: false })
  })

  it('falls back to the viewBox for width/height', function () {
    const p = pdfPageSize('<svg viewBox="0 0 50 50"></svg>')
    expect(p).toEqual({ w: 50, h: 50, fallback: false })
  })

  it('returns the A4 fallback for SVGs without usable dimensions', function () {
    expect(pdfPageSize('<svg></svg>')).toEqual({
      w: A4_PT.w,
      h: A4_PT.h,
      fallback: true,
    })
    expect(pdfPageSize('<svg width="0" height="0"></svg>').fallback).toBe(true)
    expect(pdfPageSize('').fallback).toBe(true)
  })
})

describe('jsPDF page-size handling (regression: jsPDF 4.x defaults to portrait)', function () {
  it('keeps a landscape custom format only when orientation is explicit', async function () {
    const mod = await import('jspdf')
    const J = mod.jsPDF ?? mod.default
    // What the export pipeline does:
    const withOrient = new J({ unit: 'pt', format: [722.75, 510.73], orientation: 'landscape' })
    expect(withOrient.internal.pageSize.getWidth('pt')).toBeCloseTo(722.75)
    expect(withOrient.internal.pageSize.getHeight('pt')).toBeCloseTo(510.73)
    // The quirk this guards against: without an explicit orientation jsPDF
    // treats the pair as portrait and silently swaps it (landscape canvas
    // would come out transposed):
    const without = new J({ unit: 'pt', format: [722.75, 510.73] })
    expect(without.internal.pageSize.getWidth('pt')).toBeCloseTo(510.73)
    expect(without.internal.pageSize.getHeight('pt')).toBeCloseTo(722.75)
  })
})

describe('fitContent', function () {
  const PW = A4_PT.w
  const PH = A4_PT.h
  const M = 25

  it('fits landscape content to the page width, centred', function () {
    const box = fitContent(PW, PH, M, 4 / 3)
    expect(box.x).toEqual(M)
    expect(box.y).toEqual(M)
    expect(box.w).toBeCloseTo(PW - 2 * M)
    expect(box.h).toBeCloseTo((PW - 2 * M) / (4 / 3))
  })

  it('fits portrait content to the page height, centred', function () {
    // 2/3 < maxW/maxH (≈0.711) ⇒ height-constrained
    const box = fitContent(PW, PH, M, 2 / 3)
    expect(box.h).toBeCloseTo(PH - 2 * M)
    expect(box.w).toBeCloseTo((PH - 2 * M) * (2 / 3))
  })

  it('keeps width-constrained content for mild portrait ratios', function () {
    const box = fitContent(PW, PH, M, 3 / 4)
    expect(box.w).toBeCloseTo(PW - 2 * M)
    expect(box.h).toBeCloseTo((PW - 2 * M) / (3 / 4))
  })

  it('treats a missing ratio as 1:1', function () {
    const box = fitContent(PW, PH, M, null)
    expect(box.w).toBeCloseTo(box.h)
  })
})
