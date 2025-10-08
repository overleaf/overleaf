/**
 * Converts a time string in seconds to an integer number of milliseconds.
 *
 * @param {string} timeStr - The time duration in seconds, represented as a string.
 * @returns {number} The equivalent time in milliseconds, rounded down to the nearest integer.
 */
function convertToMs(timeStr) {
  return Math.floor(parseFloat(timeStr, 10) * 1000)
}

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
const LATEX_MK_METRICS = [
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

function addLatexMkMetrics(output, stats) {
  for (const [stat, matcher] of LATEX_MK_METRICS) {
    const match = matcher(output?.stdout || '', stats.latexmk)
    if (match) {
      stats.latexmk[stat] = match
    }
  }
}

module.exports = { addLatexMkMetrics }
