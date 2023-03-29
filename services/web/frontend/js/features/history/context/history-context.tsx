import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { useIdeContext } from '../../../shared/context/ide-context'
import { useLayoutContext } from '../../../shared/context/layout-context'
import useAsync from '../../../shared/hooks/use-async'
import { HistoryContextValue } from './types/history-context-value'
import { Update, UpdateSelection } from '../services/types/update'
import { FileSelection } from '../services/types/file'
import { diffFiles, fetchUpdates } from '../services/api'
import { renamePathnameKey, isFileRenamed } from '../utils/file-tree'

function useHistory() {
  const { view } = useLayoutContext()
  const ide = useIdeContext()
  const projectId = ide.project_id
  const [updateSelection, setUpdateSelection] =
    useState<UpdateSelection | null>(null)
  const [fileSelection, setFileSelection] = useState<FileSelection | null>(null)
  /* eslint-disable no-unused-vars */
  const [viewMode, setViewMode] = useState<HistoryContextValue['viewMode']>('')
  const [nextBeforeTimestamp, setNextBeforeTimestamp] =
    useState<HistoryContextValue['nextBeforeTimestamp']>(null)
  const [atEnd, setAtEnd] = useState<HistoryContextValue['atEnd']>(false)
  const [userHasFullFeature, setUserHasFullFeature] =
    useState<HistoryContextValue['userHasFullFeature']>(undefined)
  const [freeHistoryLimitHit, setFreeHistoryLimitHit] =
    useState<HistoryContextValue['freeHistoryLimitHit']>(false)
  const [labels, setLabels] = useState<HistoryContextValue['labels']>(null)
  const [selection, setSelection] = useState<HistoryContextValue['selection']>({
    docs: {},
    pathname: null,
    range: {
      fromV: null,
      toV: null,
    },
    hoveredRange: {
      fromV: null,
      toV: null,
    },
    diff: null,
    files: [],
    file: null,
  })
  /* eslint-enable no-unused-vars */

  const { isLoading, isError, error, data, runAsync } =
    useAsync<{ updates: Update[] }>()
  const updates = useMemo(() => data?.updates ?? [], [data?.updates])
  const loadingFileTree = true

  // Initial load when the History tab is active
  useEffect(() => {
    if (view === 'history') {
      runAsync(fetchUpdates(projectId)).catch(console.error)
    }
  }, [view, projectId, runAsync])

  // Load files when the update selection changes
  useEffect(() => {
    if (!updateSelection) {
      return
    }
    const { fromV, toV } = updateSelection.update

    diffFiles(projectId, fromV, toV).then(({ diff: files }) => {
      // TODO Infer default file sensibly
      const pathname = null
      const newFiles = files.map(file => {
        if (isFileRenamed(file) && file.newPathname) {
          return renamePathnameKey(file)
        }

        return file
      })
      setFileSelection({ files: newFiles, pathname })
    })
  }, [updateSelection, projectId])

  // Set update selection if there isn't one
  useEffect(() => {
    if (updates.length && !updateSelection) {
      setUpdateSelection({ update: updates[0], comparing: false })
    }
  }, [setUpdateSelection, updateSelection, updates])

  const value = useMemo<HistoryContextValue>(
    () => ({
      atEnd,
      error,
      isError,
      isLoading,
      freeHistoryLimitHit,
      labels,
      loadingFileTree,
      nextBeforeTimestamp,
      selection,
      updates,
      userHasFullFeature,
      viewMode,
      projectId,
      fileSelection,
      setFileSelection,
      updateSelection,
      setUpdateSelection,
    }),
    [
      atEnd,
      error,
      isError,
      isLoading,
      freeHistoryLimitHit,
      labels,
      loadingFileTree,
      nextBeforeTimestamp,
      selection,
      updates,
      userHasFullFeature,
      viewMode,
      projectId,
      fileSelection,
      setFileSelection,
      updateSelection,
      setUpdateSelection,
    ]
  )

  return { value }
}

export const HistoryContext = createContext<HistoryContextValue | undefined>(
  undefined
)

type HistoryProviderProps = {
  children?: React.ReactNode
}

export function HistoryProvider({ ...props }: HistoryProviderProps) {
  const { value } = useHistory()

  return <HistoryContext.Provider value={value} {...props} />
}

export function useHistoryContext() {
  const context = useContext(HistoryContext)
  if (!context) {
    throw new Error('HistoryContext is only available inside HistoryProvider')
  }
  return context
}
