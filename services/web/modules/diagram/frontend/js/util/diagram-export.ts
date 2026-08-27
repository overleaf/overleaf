/**
 * Client-side export pipeline for the SVG diagram editor (modules/diagram).
 *
 * Everything happens in the browser — no server dependency, no network:
 *
 *   SVG  ──(canvas)────────> PNG bitmap (rasterised exactly onto the
 *                            requested pixel size — the diagram canvas at
 *                            2× scale, no letterboxing, no extra space)
 *   SVG  ──(svg2pdf.js + jsPDF)──> VECTOR PDF for `\includegraphics`
 *
 * The SVG itself is the document source, so no intermediate serialisation
 * is needed (this used to be maxGraph's ImageExport; svgcanvas exports the
 * SVG string directly).
 */
import { svgDimensions } from './diagram-model'

function svgToImage(svgXml: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to rasterise the SVG diagram'))
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgXml)
  })
}

export function svgToPngBlob(
  svgXml: string,
  width: number,
  height: number
): Promise<Blob> {
  return svgToImage(svgXml).then(
    img =>
      new Promise<Blob>((resolve, reject) => {
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.ceil(width))
        canvas.height = Math.max(1, Math.ceil(height))
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas 2D not available in this browser'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          blob =>
            blob
              ? resolve(blob)
              : reject(new Error('PNG encoding failed')),
          'image/png'
        )
      })
  )
}

/**
 * Vector PDF via svg2pdf.js + jsPDF (browser-only, fully offline).
 * svg2pdf.js v2 API: `svg2pdf(element, pdf, { x, y, width, height })`.
 *
 * Page-size rule: the PDF page is exactly the size of the diagram
 * document, drawn at full page with zero offset — 1 SVG user unit =
 * 1 PDF point. SVG-Edit's coordinate space is points (its standard A4
 * canvas is 842×595 = A4 landscape in points), so the companion renders
 * at precisely the size the diagram has in the editor (`\includegraphics`
 * at natural size, no A4 letterboxing, no rescaling). The previous
 * behaviour — always A4 with the diagram fitted inside — changed the
 * apparent size of the document; an intermediate 96-dpi px→pt mapping
 * additionally shrank everything by 25%.
 */

/** A4 in points — the only fallback page (SVG without usable dimensions). */
export const A4_PT = { w: 595.28, h: 841.89 } as const

/**
 * Pure PDF page size for a diagram: the SVG's own dimensions (width/height
 * attributes, else the viewBox), units mapped 1:1 to PDF points (see the
 * module note above). When the SVG carries no usable dimensions (rare —
 * svg-edit always sets width/height), fall back to A4 with the legacy
 * margin-fit so the export stays usable.
 */
export function pdfPageSize(svgText: string): {
  w: number
  h: number
  fallback: boolean
} {
  const dims = svgDimensions(svgText)
  const w = dims.w != null && Number.isFinite(dims.w) && dims.w > 0 ? dims.w : null
  const h = dims.h != null && Number.isFinite(dims.h) && dims.h > 0 ? dims.h : null
  if (w != null && h != null) {
    const r2 = (n: number) => Math.round(n * 100) / 100
    return { w: r2(w), h: r2(h), fallback: false }
  }
  return { w: A4_PT.w, h: A4_PT.h, fallback: true }
}

/**
 * Pure content fit (fallback path only): preserve the content's aspect
 * ratio inside a page minus margin, centred. `contentRatio` null → square.
 */
export function fitContent(
  pageW: number,
  pageH: number,
  margin: number,
  contentRatio: number | null
): { x: number; y: number; w: number; h: number } {
  const maxW = Math.max(1, pageW - 2 * margin)
  const maxH = Math.max(1, pageH - 2 * margin)
  const ratio = contentRatio != null && contentRatio > 0 ? contentRatio : 1
  let w = maxW
  let h = maxW / ratio
  if (h > maxH) {
    h = maxH
    w = maxH * ratio
  }
  return { x: margin, y: margin, w, h }
}

export async function svgToPdfBlob(svgText: string): Promise<Blob> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsPdfModule: any = await import('jspdf')
  const jsPDFCtor = jsPdfModule?.jsPDF ?? jsPdfModule?.default
  if (typeof jsPDFCtor !== 'function') {
    throw new Error('jsPDF is not available in this browser')
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svg2pdfModule: any = await import('svg2pdf.js')
  const svg2pdf = svg2pdfModule?.svg2pdf ?? svg2pdfModule?.default
  if (typeof svg2pdf !== 'function') {
    throw new Error('svg2pdf.js is not available in this browser')
  }

  const page = pdfPageSize(svgText)
  // Explicit orientation is required: jsPDF defaults to portrait and
  // *swaps* a landscape [width, height] pair into [height, width]
  // (observed on jsPDF 4.x: a 722.75x510.73 canvas came out as a
  // 510.73x722.75 page), so the page would silently transpose.
  const doc = new jsPDFCtor({
    unit: 'pt',
    format: [page.w, page.h],
    orientation: page.w >= page.h ? 'landscape' : 'portrait',
  })

  let box: { x: number; y: number; w: number; h: number }
  if (page.fallback) {
    // No usable SVG dimensions: keep the legacy A4 margin-fit so the
    // export is still sensible.
    const iw = Number(svgDimensions(svgText).w)
    const ih = Number(svgDimensions(svgText).h)
    let ratio: number | null = null
    if (Number.isFinite(iw) && iw > 0 && Number.isFinite(ih) && ih > 0) {
      ratio = iw / ih
    }
    box = fitContent(page.w, page.h, 25, ratio)
  } else {
    // Page == document size: draw the diagram at full page, zero offset.
    box = { x: 0, y: 0, w: page.w, h: page.h }
  }

  const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svgEl.innerHTML = svgText
  // svg2pdf.js v2 option names are width/height (plus x/y offset).
  await svg2pdf(svgEl.firstElementChild ?? svgEl, doc, {
    x: box.x,
    y: box.y,
    width: box.w,
    height: box.h,
  })
  return doc.output('blob') as unknown as Blob
}
