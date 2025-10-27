/**
 * Converts a time string in seconds to an integer number of milliseconds.
 *
 * @param {string} timeStr - The time duration in seconds, represented as a string.
 * @returns {number} The equivalent time in milliseconds, rounded down to the nearest integer.
 */
function convertToMs(timeStr) {
  return Math.floor(parseFloat(timeStr, 10) * 1000)
}

const NOTEWORTHY_DEPENDENCIES_REGEXP =
  /\/(beamer\.cls|tikz\.sty|microtype\.sty|minted\.sty)$/

/* An array of metric parsers for `latexmk` time output (`-time` flag).
 * Each entry is a tuple containing a metric name and a function to parse that
 * metric from the `latexmk` log output.
 *
 * The parser functions generally take the log string as their first argument.
 * Some may take additional arguments, such as the already computed stats,
 * to derive new metrics.
 *
 * There are different formats of `latexmk` output depending on the version.
 * The parsers attempt to handle these variations gracefully.
 */
const LATEX_MK_METRICS_STDOUT = [
  // Extract individual latexmk rule times as an array of objects, each with 'rule'
  // and 'time_ms' properties
  [
    'latexmk-rule-times',
    s => {
      // Each line looks like:  'pdflatex ... options ...': time = 12.34
      // Take the command up to the first space as the rule name
      const matches = s.matchAll(/^'([^' ]+).*': time = (\d+\.\d+)/gm)
      return Array.from(matches, match => ({
        rule: match[1],
        time_ms: convertToMs(match[2]),
      }))
    },
  ],
  // Extract a comma-separated signature of rule names from the rule times above
  [
    'latexmk-rule-signature',
    (s, latexmkStats) => {
      const times = latexmkStats['latexmk-rule-times']
      if (!times) return null
      // Example output: 'pdflatex,bibtex,pdflatex,pdflatex'
      return times.map(t => t.rule).join(',')
    },
  ],
  // Total latexmk processing time, invoked processes time, and other time in ms
  [
    'latexmk-time',
    s => {
      const match = s.match(
        /^Processing time = (\d+\.\d+), of which invoked processes = (\d+\.\d+), other = (\d+\.\d+)/m
      )
      if (match) {
        return {
          total: convertToMs(match[1]),
          invoked: convertToMs(match[2]),
          other: convertToMs(match[3]),
        }
      }
      // Older format
      const fallbackMatch = s.match(
        /^Accumulated processing time = (\d+\.\d+)/m
      )
      if (fallbackMatch) {
        return { total: convertToMs(fallbackMatch[1]) }
      }
      return null
    },
  ],
  // Total elapsed clock time in ms for latexmk
  [
    'latexmk-clock-time',
    s => {
      const match = s.match(/^Elapsed clock time = (\d+\.\d+)/m)
      if (match) {
        return convertToMs(match[1])
      }
      // not present in older versions
      return null
    },
  ],
  // Number of rules run by latexmk
  [
    'latexmk-rules-run',
    (s, latexmkStats) => {
      const match = s.match(/^Number of rules run = (\d+)/m)
      if (match) {
        return parseInt(match[1], 10)
      }
      // Fallback: count number of entries in rule times if available
      if (latexmkStats['latexmk-rule-times']) {
        return latexmkStats['latexmk-rule-times'].length
      }
      return null
    },
  ],
]

const LATEX_MK_METRICS_STDERR = [
  [
    'latexmk-img-times',
    s => {
      const pngCategoriesByFile = new Map()
      const pngCopyMatches = s.matchAll(/^PNG copy: (.*)$/gm)
      for (const match of pngCopyMatches) {
        const filename = match[1]
        pngCategoriesByFile.set(filename, 'fast-copy')
      }

      const pngCopySkipMatches = s.matchAll(
        /^PNG copy skipped \((alpha|gamma|palette|interlaced)\): (.*)$/gm
      )
      for (const match of pngCopySkipMatches) {
        const category = match[1]
        const filename = match[2]
        pngCategoriesByFile.set(filename, category)
      }

      const timingMatches = s.matchAll(
        /^Image written \((PNG|JPG|JBIG2|PDF), (\d+) ms\): (.*)$/gm
      )
      const timingsByType = new Map()
      for (const match of timingMatches) {
        let type = match[1]
        const timeMs = parseInt(match[2], 10)
        const filename = match[3]

        if (type === 'PNG') {
          const pngCategory = pngCategoriesByFile.get(filename)
          if (pngCategory != null) {
            type = `PNG-${pngCategory}`
          }
        }

        const accumulatedTime = timingsByType.get(type) ?? 0
        timingsByType.set(type, accumulatedTime + timeMs)
      }
      return Array.from(timingsByType.entries()).map(([type, timeMs]) => ({
        type,
        time_ms: timeMs,
      }))
    },
  ],
]

/**
 * Parses latexmk stdout for metrics and adds them to the stats object.
 * It iterates through a predefined list of metric matchers (LATEX_MK_METRICS),
 * applies them to the stdout, and adds any successful matches to the
 * `stats.latexmk` object.
 *
 * @param {{stdout?: string, stderr?: string}} output - The output from the latexmk process.
 * @param {{latexmk: object}} stats - The statistics object to update. This object is mutated.
 */
function addLatexMkMetrics(output, stats) {
  for (const [stat, matcher] of LATEX_MK_METRICS_STDOUT) {
    const match = matcher(output?.stdout || '', stats.latexmk)
    if (match) {
      stats.latexmk[stat] = match
    }
  }
  for (const [stat, matcher] of LATEX_MK_METRICS_STDERR) {
    const match = matcher(output?.stderr || '', stats.latexmk)
    if (match) {
      stats.latexmk[stat] = match
    }
  }
}

/**
 * Adds a non-enumerable `latexmk` property to the stats object.
 *
 * This property is used to store statistics from the latexmk compilation
 * process. It is made non-enumerable to prevent it from being serialized by
 * `JSON.stringify()`, which means it is not sent in the compile response
 * to web where it would added to the analytics events.
 *
 * @param {object} stats - The compile stats object to be modified.
 */
function enableLatexMkMetrics(stats) {
  Object.defineProperty(stats, 'latexmk', {
    value: {},
    enumerable: false,
  })
}

/**
 * Parses the content of a latexmk .fdb file to extract and record metrics
 * about the files used during compilation.
 *
 * It categorizes files into 'system' (paths starting with '/') and 'user'
 * files. For each category, it aggregates the count and total size of files
 * grouped by their extension. The results are added to the provided stats
 * object under `stats.latexmk['fdb-file-types']`.
 *
 * Each file is counted only once, even if it appears multiple times in the
 * .fdb content. Files without a valid extension are counted as 'other'.
 *
 * @param {string | null | undefined} fdbContent - The content of the .fdb_latexmk file.
 * @param {object} stats - The statistics object to be populated. The metrics will be added to `stats.latexmk`.
 * @returns {void}
 */
function addLatexFdbMetrics(fdbContent, stats) {
  if (!fdbContent) {
    return
  }
  const { systemFileTypes, userFileTypes, dependencies } =
    parseFdbContent(fdbContent)

  if (
    Object.keys(systemFileTypes).length > 0 ||
    Object.keys(userFileTypes).length > 0
  ) {
    const userSummary = summarizeFileTypes(userFileTypes)
    const systemSummary = summarizeFileTypes(systemFileTypes)

    stats.latexmk['fdb-file-types'] = {
      total: {
        systemFileCount: systemSummary.total.count,
        systemFileSize: systemSummary.total.size,
        imageFileCount: userSummary.image.count,
        imageFileSize: userSummary.image.size,
        textFileCount: userSummary.text.count,
        textFileSize: userSummary.text.size,
        fontFileCount: userSummary.font.count,
        fontFileSize: userSummary.font.size,
        otherFileCount: userSummary.other.count,
        otherFileSize: userSummary.other.size,
      },
      system: convertToArray(systemFileTypes),
      user: convertToArray(userFileTypes),
    }
  }

  if (dependencies.length > 0) {
    stats.latexmk['fdb-dependencies'] = dependencies
  }
}

function parseFdbContent(fdbContent) {
  const systemFileTypes = {}
  const userFileTypes = {}
  const seenFiles = new Set()
  const dependencies = new Set()
  // Extract the file path and size from lines like:
  //  FILENAME TIMESTAMP SIZE CHECKSUM ...
  //  "main.tex" 1760016467 6147 9da336eb1132ecb1d61cd1f5a70cfa62 ""
  // The timestamp can be an integer or a float
  const lineRegex = /^\s*"([^"]+)"\s+\d+(?:\.\d*)?\s+(\d+)/gm

  for (const match of fdbContent.matchAll(lineRegex)) {
    // strip leading /compile/ from paths
    const filePath = match[1].replace(/^\/compile\//, '')
    if (seenFiles.has(filePath)) {
      continue
    }
    const fileSize = parseInt(match[2], 10)
    const isSystemFile = filePath.startsWith('/')
    const extMatch = filePath.match(/\.([a-z]{1,4})$/i)
    const ext = extMatch ? extMatch[1].toLowerCase() : 'other'
    const fileTypes = isSystemFile ? systemFileTypes : userFileTypes
    if (!fileTypes[ext]) {
      fileTypes[ext] = { count: 0, size: 0 }
    }
    fileTypes[ext].count++
    fileTypes[ext].size += fileSize

    const depMatch = filePath.match(NOTEWORTHY_DEPENDENCIES_REGEXP)
    if (depMatch) {
      dependencies.add(depMatch[1])
    }

    seenFiles.add(filePath)
  }
  return {
    systemFileTypes,
    userFileTypes,
    dependencies: Array.from(dependencies),
  }
}

function getFileTypeCategory(ext) {
  switch (ext) {
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'tif':
    case 'tiff':
    case 'bmp':
    case 'gif':
    case 'svg':
    case 'eps':
      return 'image'
    case 'tex':
    case 'sty':
    case 'cls':
    case 'bib':
      return 'text'
    case 'ttf':
    case 'otf':
    case 'pfb':
      return 'font'
    default:
      return 'other'
  }
}

function summarizeFileTypes(fileTypes) {
  const summary = {
    image: { count: 0, size: 0 },
    text: { count: 0, size: 0 },
    font: { count: 0, size: 0 },
    other: { count: 0, size: 0 },
    total: { count: 0, size: 0 },
  }

  for (const [ext, info] of Object.entries(fileTypes)) {
    const category = getFileTypeCategory(ext)
    summary[category].count += info.count
    summary[category].size += info.size
    summary.total.count += info.count
    summary.total.size += info.size
  }

  return summary
}

function convertToArray(object) {
  return Object.entries(object)
    .map(([ext, value]) => ({
      ext,
      count: value.count,
      size: value.size,
    }))
    .sort((a, b) => b.size - a.size) // sort by size descending
}

module.exports = { enableLatexMkMetrics, addLatexMkMetrics, addLatexFdbMetrics }
