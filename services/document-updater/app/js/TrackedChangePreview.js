// @ts-check

/**
 * Builds sparse previews of an accept/reject tracked-change batch. A batch can
 * cover changes spread across the whole document, so the changes are first
 * clustered by proximity: each cluster becomes one preview, with its own
 * section path, start line and bounded slice of surrounding text. Web
 * assembles the diff, before/after context and truncation from that.
 *
 * The clustering gap must stay in step with MERGE_MAX_GAP in
 * services/web/modules/notifications/app/src/emails/changeBlock.mjs, which
 * groups pending (not yet resolved) changes the same way.
 *
 * A small amount of logic here (section-header pattern, line lookup) is also
 * present in services/web/modules/notifications/app/src/emails/previewHelpers.mjs
 */

// Matches LaTeX sectioning commands: command name (1), short title (2), full
// title (3). Handles starred variants and one level of nested braces.
const SECTION_HEADER_PATTERN =
  /^\s*\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?(?:\[([^\]]*)\])?\{((?:[^{}]|\{[^{}]*\})*)\}/

const SECTION_LEVELS = {
  part: 0,
  chapter: 1,
  section: 2,
  subsection: 3,
  subsubsection: 4,
  paragraph: 5,
  subparagraph: 6,
}

const CONTEXT_PADDING_CHARS = 500

// Maximum gap, in characters, between two changes that still read as one
// preview.
const MERGE_MAX_GAP = 50

/**
 * @typedef {{ id?: string, op: { i?: string, d?: string, p: number }, metadata?: { user_id?: string } }} Change
 */

/**
 * @typedef {object} SparseChangePreview
 * @property {string[]} sectionPath
 * @property {number} startLine
 * @property {{ i?: string, d?: string, p: number }[]} changes
 * @property {string} slice
 * @property {number} sliceStart
 * @property {string[]} userIds - authors of the changes in this cluster
 */

/**
 * Length a change occupies in document-content coordinate space. Inserts are
 * present in the document; deletes are zero-width (their text is no longer
 * there, so it doesn't shift later offsets). See ranges-tracker/index.cjs.
 * @param {{ i?: string }} op
 * @returns {number}
 */
function contentLength(op) {
  return op.i?.length || 0
}

/**
 * Character offset of the first character of each line, so position lookups
 * don't re-walk the document for every cluster.
 * @param {string[]} lines
 * @returns {number[]}
 */
function buildLineStarts(lines) {
  const starts = new Array(lines.length)
  let offset = 0
  for (let i = 0; i < lines.length; i++) {
    starts[i] = offset
    offset += lines[i].length + 1 // +1 for \n
  }
  return starts
}

/**
 * @param {number[]} lineStarts
 * @param {number} charPosition
 * @returns {number} 0-based line index
 */
function charPositionToLineIndex(lineStarts, charPosition) {
  let low = 0
  let high = lineStarts.length - 1
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (lineStarts[mid] > charPosition) {
      high = mid - 1
    } else {
      low = mid
    }
  }
  return low
}

/**
 * Collects every sectioning header in one pass, so per-cluster section lookup
 * doesn't rescan the document body.
 * @param {string[]} lines
 * @returns {{ lineIndex: number, level: number, title: string }[]}
 */
function collectSectionHeaders(lines) {
  const headers = []
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(SECTION_HEADER_PATTERN)
    if (!match) {
      continue
    }
    headers.push({
      lineIndex: i,
      level: SECTION_LEVELS[match[1]],
      title: match[2] || match[3],
    })
  }
  return headers
}

/**
 * @param {{ lineIndex: number, level: number, title: string }[]} headers
 * @param {number} lineIndex
 * @returns {string[]}
 */
function sectionPathAtLine(headers, lineIndex) {
  const ancestors = []
  let maxLevel = Infinity
  for (let i = headers.length - 1; i >= 0; i--) {
    const header = headers[i]
    if (header.lineIndex > lineIndex) {
      continue
    }
    if (header.level >= maxLevel) {
      continue
    }
    ancestors.push(header.title)
    maxLevel = header.level
    if (header.level === 0) {
      break
    }
  }
  return ancestors.reverse()
}

/**
 * Groups changes that sit close enough together to read as one preview.
 * @param {Change[]} changes
 * @returns {Change[][]}
 */
function clusterChanges(changes) {
  const sorted = [...changes].sort((a, b) => a.op.p - b.op.p)
  const clusters = [[sorted[0]]]
  for (let i = 1; i < sorted.length; i++) {
    const change = sorted[i]
    const cluster = clusters[clusters.length - 1]
    const previous = cluster[cluster.length - 1]
    const previousEnd = previous.op.p + contentLength(previous.op)
    if (change.op.p - previousEnd <= MERGE_MAX_GAP) {
      cluster.push(change)
    } else {
      clusters.push([change])
    }
  }
  return clusters
}

/**
 * Builds the sparse change previews that web hydrates into stored previews,
 * one per cluster of nearby changes.
 *
 * @param {object} opts
 * @param {Change[]} opts.changes - ranges-format change records
 * @param {string[]} opts.lines - pre-change doc lines snapshot
 * @returns {SparseChangePreview[]}
 */
function buildSparseChangePreviews({ changes, lines }) {
  if (!changes || !changes.length || !lines || !lines.length) {
    return []
  }

  const lineStarts = buildLineStarts(lines)
  const headers = collectSectionHeaders(lines)

  return clusterChanges(changes).map(cluster => {
    const firstPos = cluster[0].op.p
    const lastChange = cluster[cluster.length - 1]
    const lastEnd = lastChange.op.p + contentLength(lastChange.op)
    const lineIndex = charPositionToLineIndex(lineStarts, firstPos)

    const windowStart = Math.max(0, firstPos - CONTEXT_PADDING_CHARS)
    const windowEnd = lastEnd + CONTEXT_PADDING_CHARS

    const userIds = [
      ...new Set(
        cluster.flatMap(change =>
          change.metadata?.user_id ? [change.metadata.user_id] : []
        )
      ),
    ]

    return {
      sectionPath: sectionPathAtLine(headers, lineIndex),
      startLine: lineIndex + 1,
      changes: cluster.map(change => ({
        i: change.op.i,
        d: change.op.d,
        p: change.op.p,
      })),
      slice: extractWindow(lines, lineStarts, windowStart, windowEnd),
      sliceStart: windowStart,
      userIds,
    }
  })
}

/**
 * Extracts `lines.join('\n').slice(windowStart, windowEnd)` without
 * materializing the full joined text.
 * @param {string[]} lines
 * @param {number[]} lineStarts
 * @param {number} windowStart
 * @param {number} windowEnd
 * @returns {string}
 */
function extractWindow(lines, lineStarts, windowStart, windowEnd) {
  let out = ''
  const firstLine = charPositionToLineIndex(lineStarts, windowStart)
  for (let i = firstLine; i < lines.length; i++) {
    const line = lines[i]
    const lineStart = lineStarts[i]
    const lineEnd = lineStart + line.length
    if (lineStart >= windowEnd) {
      break
    }
    if (lineEnd > windowStart) {
      const from = Math.max(0, windowStart - lineStart)
      const to = Math.min(line.length, windowEnd - lineStart)
      out += line.slice(from, to)
    }
    const hasTrailingNewline = i < lines.length - 1
    if (hasTrailingNewline && lineEnd >= windowStart && lineEnd < windowEnd) {
      out += '\n'
    }
  }
  return out
}

module.exports = { buildSparseChangePreviews }
