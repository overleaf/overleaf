import HumanReadableLogs from '../../../ide/human-readable-logs/HumanReadableLogs'
import BibLogParser from '../../../ide/log-parser/bib-log-parser'
import { enablePdfCaching } from './pdf-caching-flags'
import { debugConsole } from '@/utils/debugging'
import { dirname, findEntityByPath } from '@/features/file-tree/util/path'
import '@/utils/readable-stream-async-iterator-polyfill'

// Warnings that may disappear after a second LaTeX pass
const TRANSIENT_WARNING_REGEX = /^(Reference|Citation).+undefined on input line/

const MAX_LOG_SIZE = 1024 * 1024 // 1MB
const MAX_BIB_LOG_SIZE_PER_FILE = MAX_LOG_SIZE

export function handleOutputFiles(outputFiles, projectId, data) {
  const outputFile = outputFiles.get('output.pdf')
  if (!outputFile) return null

  // build the URL for viewing the PDF in the preview UI
  const params = new URLSearchParams({
    compileGroup: data.compileGroup,
  })

  if (data.clsiServerId) {
    params.set('clsiserverid', data.clsiServerId)
  }

  if (enablePdfCaching) {
    // Tag traffic that uses the pdf caching logic.
    params.set('enable_pdf_caching', 'true')
  }

  outputFile.pdfUrl = `${buildURL(
    outputFile,
    data.pdfDownloadDomain
  )}?${params}`

  // build the URL for downloading the PDF
  params.set('popupDownload', 'true') // save PDF download as file

  outputFile.pdfDownloadUrl = `/download/project/${projectId}/build/${outputFile.build}/output/output.pdf?${params}`

  return outputFile
}

let nextEntryId = 1

function generateEntryKey() {
  return 'compile-log-entry-' + nextEntryId++
}

export const handleLogFiles = async (outputFiles, data, signal) => {
  const result = {
    log: null,
    logEntries: {
      errors: [],
      warnings: [],
      typesetting: [],
    },
  }

  function accumulateResults(newEntries, type) {
    for (const key in result.logEntries) {
      if (newEntries[key]) {
        for (const entry of newEntries[key]) {
          if (type) {
            entry.type = newEntries.type
          }
          if (entry.file) {
            entry.file = normalizeFilePath(entry.file)
          }
          entry.key = generateEntryKey()
        }
        result.logEntries[key].push(...newEntries[key])
      }
    }
  }

  const logFile = outputFiles.get('output.log')

  if (logFile) {
    result.log = await fetchFileWithSizeLimit(
      buildURL(logFile, data.pdfDownloadDomain),
      signal,
      MAX_LOG_SIZE
    )
    try {
      let { errors, warnings, typesetting } = HumanReadableLogs.parse(
        result.log,
        {
          ignoreDuplicates: true,
        }
      )

      if (data.status === 'stopped-on-first-error') {
        // Hide warnings that could disappear after a second pass
        warnings = warnings.filter(warning => !isTransientWarning(warning))
      }

      accumulateResults({ errors, warnings, typesetting })
    } catch (e) {
      debugConsole.warn(e) // ignore failure to parse the log file, but log a warning
    }
  }

  const blgFiles = []

  for (const [filename, file] of outputFiles) {
    if (filename.endsWith('.blg')) {
      blgFiles.push(file)
    }
  }
  for (const blgFile of blgFiles) {
    const log = await fetchFileWithSizeLimit(
      buildURL(blgFile, data.pdfDownloadDomain),
      signal,
      MAX_BIB_LOG_SIZE_PER_FILE
    )
    try {
      const { errors, warnings } = new BibLogParser(log, {
        maxErrors: 100,
      }).parse()
      accumulateResults({ errors, warnings }, 'BibTeX:')
    } catch (e) {
      // BibLog parsing errors are ignored
    }
  }

  result.logEntries.all = [
    ...result.logEntries.errors,
    ...result.logEntries.warnings,
    ...result.logEntries.typesetting,
  ]

  return result
}

export function buildLogEntryAnnotations(entries, fileTreeData, rootDocId) {
  const rootDocDirname = dirname(fileTreeData, rootDocId)

  const logEntryAnnotations = {}
  const seenLine = {}

  for (const entry of entries) {
    if (entry.file) {
      entry.file = normalizeFilePath(entry.file, rootDocDirname)

      const entity = findEntityByPath(fileTreeData, entry.file)?.entity

      if (entity) {
        if (!(entity._id in logEntryAnnotations)) {
          logEntryAnnotations[entity._id] = []
        }

        const annotation = {
          id: entry.key,
          entryIndex: logEntryAnnotations[entity._id].length, // used for maintaining the order of items on the same line
          row: entry.line - 1,
          type: entry.level === 'error' ? 'error' : 'warning',
          text: entry.message,
          source: 'compile', // NOTE: this is used in Ace for filtering the annotations
          ruleId: entry.ruleId,
          command: entry.command,
        }

        // set firstOnLine for the first non-typesetting annotation on a line
        if (entry.level !== 'typesetting') {
          if (!seenLine[entry.line]) {
            annotation.firstOnLine = true
            seenLine[entry.line] = true
          }
        }

        logEntryAnnotations[entity._id].push(annotation)
      }
    }
  }

  return logEntryAnnotations
}

export const buildRuleCounts = (entries = []) => {
  const counts = {}
  for (const entry of entries) {
    const key = `${entry.level}_${entry.ruleId}`
    counts[key] = counts[key] ? counts[key] + 1 : 1
  }
  return counts
}

export const buildRuleDeltas = (ruleCounts, previousRuleCounts) => {
  const counts = {}

  // keys that are defined in the current log entries
  for (const [key, value] of Object.entries(ruleCounts)) {
    const previousValue = previousRuleCounts[key] ?? 0
    counts[`delta_${key}`] = value - previousValue
  }

  // keys that are no longer defined in the current log entries
  for (const [key, value] of Object.entries(previousRuleCounts)) {
    if (!(key in ruleCounts)) {
      counts[key] = 0
      counts[`delta_${key}`] = -value
    }
  }

  return counts
}

function buildURL(file, pdfDownloadDomain) {
  if (file.build && pdfDownloadDomain) {
    // Downloads from the compiles domain must include a build id.
    // The build id is used implicitly for access control.
    return `${pdfDownloadDomain}${file.url}`
  }
  // Go through web instead, which uses mongo for checking project access.
  return `${window.origin}${file.url}`
}

function normalizeFilePath(path, rootDocDirname) {
  path = path.replace(/\/\//g, '/')
  path = path.replace(
    /^.*\/compiles\/[0-9a-f]{24}(-[0-9a-f]{24})?\/(\.\/)?/,
    ''
  )

  path = path.replace(/^\/compile\//, '')

  if (rootDocDirname) {
    path = path.replace(/^\.\//, rootDocDirname + '/')
  }

  return path
}

function isTransientWarning(warning) {
  return TRANSIENT_WARNING_REGEX.test(warning.message)
}

async function fetchFileWithSizeLimit(url, signal, maxSize) {
  let result = ''
  try {
    const abortController = new AbortController()
    // abort fetching the log file if the main signal is aborted
    signal.addEventListener('abort', () => {
      abortController.abort()
    })

    const response = await fetch(url, {
      signal: abortController.signal,
    })

    if (!response.ok) {
      throw new Error('Failed to fetch log file')
    }

    const reader = response.body.pipeThrough(new TextDecoderStream())
    for await (const chunk of reader) {
      result += chunk
      if (result.length > maxSize) {
        abortController.abort()
      }
    }
  } catch (e) {
    debugConsole.warn(e) // ignore failure to fetch the log file, but log a warning
  }
  return result
}
