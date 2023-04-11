import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useMemo,
  useRef,
} from 'react'
import { useLayoutContext } from '../../../shared/context/layout-context'
import { useUserContext } from '../../../shared/context/user-context'
import { useProjectContext } from '../../../shared/context/project-context'
import { HistoryContextValue } from './types/history-context-value'
import { diffFiles, fetchLabels, fetchUpdates } from '../services/api'
import { renamePathnameKey, isFileRenamed } from '../utils/file-tree'
import { loadLabels } from '../utils/label'
import ColorManager from '../../../ide/colors/ColorManager'
import moment from 'moment'
import * as eventTracking from '../../../infrastructure/event-tracking'
import { cloneDeep } from 'lodash'
import { LoadedUpdate, Update, UpdateSelection } from '../services/types/update'
import { FileSelection } from '../services/types/file'
import { Nullable } from '../../../../../types/utils'

function useHistory() {
  const { view } = useLayoutContext()
  const user = useUserContext()
  const project = useProjectContext()
  const userId = user.id
  const projectId = project._id
  const projectOwnerId = project.owner?._id
  const [updateSelection, setUpdateSelection] =
    useState<UpdateSelection | null>(null)
  const [fileSelection, setFileSelection] = useState<FileSelection | null>(null)
  const [updates, setUpdates] = useState<LoadedUpdate[]>([])
  const [loadingFileTree, setLoadingFileTree] =
    useState<HistoryContextValue['loadingFileTree']>(true)
  const [nextBeforeTimestamp, setNextBeforeTimestamp] =
    useState<HistoryContextValue['nextBeforeTimestamp']>()
  const [atEnd, setAtEnd] = useState<HistoryContextValue['atEnd']>(false)
  const [freeHistoryLimitHit, setFreeHistoryLimitHit] =
    useState<HistoryContextValue['freeHistoryLimitHit']>(false)
  const [labels, setLabels] = useState<HistoryContextValue['labels']>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  /* eslint-disable no-unused-vars */
  const [viewMode, setViewMode] = useState<HistoryContextValue['viewMode']>('')
  const [userHasFullFeature, setUserHasFullFeature] =
    useState<HistoryContextValue['userHasFullFeature']>(undefined)
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

  const fetchNextBatchOfUpdates = useCallback(() => {
    const loadUpdates = (updatesData: Update[]) => {
      const dateTimeNow = new Date()
      const timestamp24hoursAgo = dateTimeNow.setDate(dateTimeNow.getDate() - 1)
      let previousUpdate = updates[updates.length - 1]
      let cutOffIndex: Nullable<number> = null

      let loadedUpdates: LoadedUpdate[] = cloneDeep(updatesData)
      for (const [index, update] of loadedUpdates.entries()) {
        for (const user of update.meta.users) {
          if (user) {
            user.hue = ColorManager.getHueForUserId(user.id)
          }
        }
        if (
          !previousUpdate ||
          !moment(previousUpdate.meta.end_ts).isSame(update.meta.end_ts, 'day')
        ) {
          update.meta.first_in_day = true
        }

        previousUpdate = update

        if (userHasFullFeature && update.meta.end_ts < timestamp24hoursAgo) {
          cutOffIndex = index || 1 // Make sure that we show at least one entry (to allow labelling).
          setFreeHistoryLimitHit(true)
          if (projectOwnerId === userId) {
            eventTracking.send(
              'subscription-funnel',
              'editor-click-feature',
              'history'
            )
            eventTracking.sendMB('paywall-prompt', {
              'paywall-type': 'history',
            })
          }
          break
        }
      }

      if (!userHasFullFeature && cutOffIndex != null) {
        loadedUpdates = loadedUpdates.slice(0, cutOffIndex)
      }

      setUpdates(updates.concat(loadedUpdates))

      // TODO first load
    }

    if (atEnd) return

    const updatesPromise = fetchUpdates(projectId, nextBeforeTimestamp)
    const labelsPromise = labels == null ? fetchLabels(projectId) : null

    setIsLoading(true)
    Promise.all([updatesPromise, labelsPromise])
      .then(([{ updates: updatesData, nextBeforeTimestamp }, labels]) => {
        const lastUpdateToV = updatesData.length ? updatesData[0].toV : null

        if (labels) {
          setLabels(loadLabels(labels, lastUpdateToV))
        }

        loadUpdates(updatesData)
        setNextBeforeTimestamp(nextBeforeTimestamp)
        if (
          nextBeforeTimestamp == null ||
          freeHistoryLimitHit ||
          !updates.length
        ) {
          setAtEnd(true)
        }
        if (!updates.length) {
          setLoadingFileTree(false)
        }
      })
      .catch(error => {
        setError(error)
        setAtEnd(true)
        setLoadingFileTree(false)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [
    atEnd,
    freeHistoryLimitHit,
    labels,
    nextBeforeTimestamp,
    projectId,
    projectOwnerId,
    userId,
    userHasFullFeature,
    updates,
  ])

  // Initial load when the History tab is active
  const initialFetch = useRef(false)
  useEffect(() => {
    if (view === 'history' && !initialFetch.current) {
      fetchNextBatchOfUpdates()
      initialFetch.current = true
    }
  }, [view, fetchNextBatchOfUpdates])

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
