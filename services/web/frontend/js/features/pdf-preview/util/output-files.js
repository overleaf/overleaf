import getMeta from '../../../utils/meta'
import HumanReadableLogs from '../../../ide/human-readable-logs/HumanReadableLogs'
import BibLogParser from '../../../ide/log-parser/bib-log-parser'
import { v4 as uuid } from 'uuid'

const searchParams = new URLSearchParams(window.location.search)

export const handleOutputFiles = async (outputFiles, projectId, data) => {
  const result = {}

  const pdfDownloadDomain = data.pdfDownloadDomain ?? ''

  const outputFile = outputFiles.get('output.pdf')

  if (outputFile) {
    // build the URL for viewing the PDF in the preview UI
    const params = new URLSearchParams({
      compileGroup: data.compileGroup,
    })

    if (data.clsiServerId) {
      params.set('clsiserverid', data.clsiServerId)
    }

    if (searchParams.get('verify_chunks') === 'true') {
      // Instruct the serviceWorker to verify composed ranges.
      params.set('verify_chunks', 'true')
    }

    if (getMeta('ol-enablePdfCaching')) {
      // Tag traffic that uses the pdf caching logic.
      params.set('enable_pdf_caching', 'true')
    }

    result.pdfUrl = `${pdfDownloadDomain}${outputFile.url}?${params}`

    // build the URL for downloading the PDF
    params.set('popupDownload', 'true') // save PDF download as file

    result.pdfDownloadUrl = `/download/project/${projectId}/build/${outputFile.build}/output/output.pdf?${params}`
  }

  return result
}

export const handleLogFiles = async (outputFiles, data, signal) => {
  const pdfDownloadDomain = data.pdfDownloadDomain ?? ''

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
          entry.key = uuid()
        }
        result.logEntries[key].push(...newEntries[key])
      }
    }
  }

  const logFile = outputFiles.get('output.log')

  if (logFile) {
    try {
      const response = await fetch(`${pdfDownloadDomain}${logFile.url}`, {
        signal,
      })

      result.log = await response.text()

      const { errors, warnings, typesetting } = HumanReadableLogs.parse(
        result.log,
        {
          ignoreDuplicates: true,
        }
      )

      accumulateResults({ errors, warnings, typesetting })
    } catch (e) {
      console.warn(e) // ignore failure to fetch/parse the log file, but log a warning
    }
  }

  const blgFile = outputFiles.get('output.blg')

  if (blgFile) {
    try {
      const response = await fetch(`${pdfDownloadDomain}${blgFile.url}`, {
        signal,
      })

      const log = await response.text()

      try {
        const { errors, warnings } = new BibLogParser(log, {
          maxErrors: 100,
        }).parse()
        accumulateResults({ errors, warnings }, 'BibTeX:')
      } catch (e) {
        // BibLog parsing errors are ignored
      }
    } catch (e) {
      console.warn(e) // ignore failure to fetch/parse the log file, but log a warning
    }
  }

  result.logEntries.all = [
    ...result.logEntries.errors,
    ...result.logEntries.warnings,
    ...result.logEntries.typesetting,
  ]

  return result
}

export function buildLogEntryAnnotations(entries, fileTreeManager) {
  const rootDocDirname = fileTreeManager.getRootDocDirname()

  const logEntryAnnotations = {}

  for (const entry of entries) {
    if (entry.file) {
      entry.file = normalizeFilePath(entry.file, rootDocDirname)

      const entity = fileTreeManager.findEntityByPath(entry.file)

      if (entity) {
        if (!(entity.id in logEntryAnnotations)) {
          logEntryAnnotations[entity.id] = []
        }

        logEntryAnnotations[entity.id].push({
          row: entry.line - 1,
          type: entry.level === 'error' ? 'error' : 'warning',
          text: entry.message,
          source: 'compile',
        })
      }
    }
  }

  return logEntryAnnotations
}

function normalizeFilePath(path, rootDocDirname) {
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
