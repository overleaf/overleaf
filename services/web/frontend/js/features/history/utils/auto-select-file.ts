import _ from 'lodash'
import type { Nullable } from '../../../../../types/utils'
import type { FileDiff } from '../services/types/file'
import type { FileOperation } from '../services/types/file-operation'
import type { LoadedUpdate, Version } from '../services/types/update'
import { fileFinalPathname } from './file-diff'

type FileWithOps = {
  pathname: FileDiff['pathname']
  operation: FileOperation
}

function getFilesWithOps(
  files: FileDiff[],
  toV: Version,
  comparing: boolean,
  updateForToV: LoadedUpdate | undefined
): FileWithOps[] {
  if (toV && !comparing) {
    const filesWithOps: FileWithOps[] = []

    if (updateForToV) {
      for (const pathname of updateForToV.pathnames) {
        filesWithOps.push({
          pathname,
          operation: 'edited',
        })
      }

      for (const op of updateForToV.project_ops) {
        let fileWithOps: Nullable<FileWithOps> = null

        if (op.add) {
          fileWithOps = {
            pathname: op.add.pathname,
            operation: 'added',
          }
        } else if (op.remove) {
          fileWithOps = {
            pathname: op.remove.pathname,
            operation: 'removed',
          }
        } else if (op.rename) {
          fileWithOps = {
            pathname: op.rename.newPathname,
            operation: 'renamed',
          }
        }

        if (fileWithOps !== null) {
          filesWithOps.push(fileWithOps)
        }
      }
    }

    return filesWithOps
  } else {
    const filesWithOps = _.reduce(
      files,
      (curFilesWithOps, file) => {
        if ('operation' in file) {
          curFilesWithOps.push({
            pathname: file.pathname,
            operation: file.operation,
          })
        }
        return curFilesWithOps
      },
      <FileWithOps[]>[]
    )

    return filesWithOps
  }
}

const orderedOpTypes: FileOperation[] = [
  'edited',
  'added',
  'renamed',
  'removed',
]

export function autoSelectFile(
  files: FileDiff[],
  toV: Version,
  comparing: boolean,
  updateForToV: LoadedUpdate | undefined
): FileDiff {
  let fileToSelect: Nullable<FileDiff> = null

  const filesWithOps = getFilesWithOps(files, toV, comparing, updateForToV)
  for (const opType of orderedOpTypes) {
    const fileWithMatchingOpType = _.find(filesWithOps, {
      operation: opType,
    })

    if (fileWithMatchingOpType != null) {
      fileToSelect =
        _.find(
          files,
          file => fileFinalPathname(file) === fileWithMatchingOpType.pathname
        ) ?? null

      break
    }
  }

  if (!fileToSelect) {
    const mainFile = _.find(files, function (file) {
      return /main\.tex$/.test(file.pathname)
    })

    if (mainFile) {
      fileToSelect = mainFile
    } else {
      const anyTeXFile = _.find(files, function (file) {
        return /\.tex$/.test(file.pathname)
      })

      if (anyTeXFile) {
        fileToSelect = anyTeXFile
      } else {
        fileToSelect = files[0]
      }
    }
  }

  return fileToSelect
}
