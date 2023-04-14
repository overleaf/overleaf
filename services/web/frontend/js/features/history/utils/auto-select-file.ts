import _ from 'lodash'
import type { Nullable } from '../../../../../types/utils'
import type { HistoryContextValue } from '../context/types/history-context-value'
import type { FileDiff } from '../services/types/file'
import type { DiffOperation } from '../services/types/diff-operation'
import type { Update } from '../services/types/update'

function getUpdateForVersion(
  version: Update['toV'],
  updates: HistoryContextValue['updates']
): Nullable<Update> {
  return updates.filter(update => update.toV === version)?.[0] ?? null
}

type FileWithOps = {
  pathname: FileDiff['pathname']
  operation: DiffOperation
}

function getFilesWithOps(
  files: FileDiff[],
  updateSelection: HistoryContextValue['updateSelection'],
  updates: HistoryContextValue['updates']
): FileWithOps[] {
  if (!updateSelection) {
    return []
  }
  if (updateSelection.update.toV && !updateSelection.comparing) {
    const filesWithOps: FileWithOps[] = []
    const currentUpdate = getUpdateForVersion(
      updateSelection.update.toV,
      updates
    )

    if (currentUpdate !== null) {
      for (const pathname of currentUpdate.pathnames) {
        filesWithOps.push({
          pathname,
          operation: 'edited',
        })
      }

      for (const op of currentUpdate.project_ops) {
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

const orderedOpTypes: DiffOperation[] = [
  'edited',
  'added',
  'renamed',
  'removed',
]

export function autoSelectFile(
  files: FileDiff[],
  updateSelection: HistoryContextValue['updateSelection'],
  updates: HistoryContextValue['updates']
) {
  let fileToSelect: Nullable<FileDiff> = null

  const filesWithOps = getFilesWithOps(files, updateSelection, updates)
  for (const opType of orderedOpTypes) {
    const fileWithMatchingOpType = _.find(filesWithOps, {
      operation: opType,
    })

    if (fileWithMatchingOpType != null) {
      fileToSelect =
        _.find(files, {
          pathname: fileWithMatchingOpType.pathname,
        }) ?? null

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

  return fileToSelect.pathname
}
