/**
 * Pure helpers for the SVG diagram editor (modules/diagram).
 *
 * Kept free of React/DOM dependencies so it can be unit-tested in Node
 * (`modules/diagram/test/unit` via vitest).
 */

export const DEFAULT_CANVAS_W = 842
export const DEFAULT_CANVAS_H = 595

/**
 * New diagram document: a standalone SVG. The SVG text is the source of
 * truth (human-readable, diffable, editable — and the input of the vector
 * PDF + PNG companion export for `\includegraphics`).
 */
export function blankDiagram(
  width: number = DEFAULT_CANVAS_W,
  height: number = DEFAULT_CANVAS_H
): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}"></svg>`
  )
}

/**
 * Strip third-party tool branding comments from an exported SVG before it
 * is saved as the project source (e.g. "Created with SVG-edit" style
 * comments emitted by the canvas library).
 */
export function stripBrandingComments(svg: string): string {
  return svg.replace(/<!--\s*Created with[^\n]*?-->/g, '')
}

/**
 * Normalise raw document content into a single `<svg>` document string, or
 * `null` when the content is empty or not SVG (caller then starts from the
 * blank canvas).
 */
export function toSvgDocument(content: string | null | undefined): string | null {
  const text = (content ?? '').trim()
  if (text.length === 0) {
    return null
  }
  if (/^<svg\b/i.test(text)) {
    return text
  }
  const match = text.match(/<svg\b[\s\S]*?<\/svg>/i)
  return match ? match[0] : null
}

/**
 * Intrinsic pixel dimensions of an SVG document (from the root element's
 * `width`/`height`; `viewBox` as a fallback). Used to size the companion
 * raster export. Returns `null` entries when a dimension is missing/invalid.
 */
export function svgDimensions(svg: string): { w: number | null; h: number | null } {
  let w: number | null = null
  let h: number | null = null
  const root = (svg.match(/<svg\b[^>]*>/i) || [null])[0]
  if (root) {
    const wm = root.match(/\swidth="([^"]+)"/i)
    const hm = root.match(/\sheight="([^"]+)"/i)
    if (wm) w = Number(wm[1].replace(/px$/i, ''))
    if (hm) h = Number(hm[1].replace(/px$/i, ''))
    if (!w || !h) {
      const vb = root.match(/viewBox="([\d.\s-]+)"/i)
      if (vb) {
        const parts = vb[1].trim().split(/[\s,]+/).map(Number)
        if (parts.length === 4) {
          if (!w) w = parts[2]
          if (!h) h = parts[3]
        }
      }
    }
    w = Number.isFinite(w as number) && (w as number) > 0 ? (w as number) : null
    h = Number.isFinite(h as number) && (h as number) > 0 ? (h as number) : null
  }
  return { w, h }
}
