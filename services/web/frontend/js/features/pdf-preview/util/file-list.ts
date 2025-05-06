import {
  CompileOutputFile,
  CompileResponseData,
} from '../../../../../types/compile'
import { PdfFileDataList } from '@/features/pdf-preview/util/types'

const topFileTypes = ['bbl', 'gls', 'ind']
// NOTE: Updating this list requires a corresponding change in
// * services/clsi/app/js/OutputFileArchiveManager.js
const ignoreFiles = ['output.fls', 'output.fdb_latexmk']

export function buildFileList(
  outputFiles: Map<string, CompileOutputFile>,
  {
    clsiServerId,
    clsiCacheShard,
    compileGroup,
    outputFilesArchive,
    fromCache = false,
  }: CompileResponseData
): PdfFileDataList {
  const files: PdfFileDataList = { top: [], other: [] }

  if (outputFiles) {
    const params = new URLSearchParams()

    if (fromCache) {
      params.set('clsiserverid', clsiCacheShard || 'cache')
    } else if (clsiServerId) {
      params.set('clsiserverid', clsiServerId)
    }
    if (compileGroup) {
      params.set('compileGroup', compileGroup)
    }

    const queryString = params.toString()

    const allFiles = []

    // filter out ignored files and set some properties
    for (const file of outputFiles.values()) {
      if (!ignoreFiles.includes(file.path)) {
        file.main = file.path.startsWith('output.')

        if (queryString.length) {
          file.url += `?${queryString}`
        }

        allFiles.push(file)
      }
    }

    // sort main files first, then alphabetical
    allFiles.sort((a, b) => {
      if (a.main && !b.main) {
        return -1
      }

      if (b.main && !a.main) {
        return 1
      }

      return a.path.localeCompare(b.path, undefined, { numeric: true })
    })

    // group files into "top" and "other"
    for (const file of allFiles) {
      if (topFileTypes.includes(file.type)) {
        files.top.push(file)
      } else if (!(file.type === 'pdf' && file.main === true)) {
        files.other.push(file)
      }
    }

    const archivableFiles = [...files.top, ...files.other]

    if (outputFilesArchive && archivableFiles.length > 0) {
      archivableFiles.forEach(file => params.append('files', file.path))

      files.archive = {
        ...outputFilesArchive,
        fileCount: archivableFiles.length,
        url: `${outputFilesArchive.url}?${params.toString()}`,
      }
    }
  }

  return files
}
