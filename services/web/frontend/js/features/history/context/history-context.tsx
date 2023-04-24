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
import { autoSelectFile } from '../utils/auto-select-file'
import ColorManager from '../../../ide/colors/ColorManager'
import moment from 'moment'
import * as eventTracking from '../../../infrastructure/event-tracking'
import { cloneDeep } from 'lodash'
import {
  FetchUpdatesResponse,
  LoadedUpdate,
  Update,
} from '../services/types/update'
import { Nullable } from '../../../../../types/utils'
import { Selection } from '../services/types/selection'

// Allow testing of infinite scrolling by providing query string parameters to
// limit the number of updates returned in a batch and apply a delay
function limitUpdates(
  promise: Promise<FetchUpdatesResponse>
): Promise<FetchUpdatesResponse> {
  const queryParams = new URLSearchParams(window.location.search)
  const maxBatchSizeParam = queryParams.get('history-max-updates')
  const delayParam = queryParams.get('history-updates-delay')
  if (delayParam === null && maxBatchSizeParam === null) {
    return promise
  }
  return promise.then(response => {
    let { updates, nextBeforeTimestamp } = response
    const maxBatchSize = maxBatchSizeParam ? parseInt(maxBatchSizeParam, 10) : 0
    const delay = delayParam ? parseInt(delayParam, 10) : 0
    if (maxBatchSize > 0 && updates) {
      updates = updates.slice(0, maxBatchSize)
      nextBeforeTimestamp = updates[updates.length - 1].fromV
    }
    const limitedResponse = { updates, nextBeforeTimestamp }
    if (delay > 0) {
      return new Promise(resolve => {
        window.setTimeout(() => resolve(limitedResponse), delay)
      })
    } else {
      return limitedResponse
    }
  })
}

function useHistory() {
  const { view } = useLayoutContext()
  const user = useUserContext()
  const project = useProjectContext()
  const userId = user.id
  const projectId = project._id
  const projectOwnerId = project.owner?._id

  const [selection, setSelection] = useState<Selection>({
    updateRange: null,
    comparing: false,
    files: [],
    pathname: null,
  })

  const [updatesInfo, setUpdatesInfo] = useState<
    HistoryContextValue['updatesInfo']
  >({
    updates: [],
    atEnd: false,
    freeHistoryLimitHit: false,
    nextBeforeTimestamp: undefined,
  })
  const [labels, setLabels] = useState<HistoryContextValue['labels']>(null)
  const [loadingState, setLoadingState] =
    useState<HistoryContextValue['loadingState']>('loadingInitial')
  const [error, setError] = useState(null)
  // eslint-disable-next-line no-unused-vars
  const [userHasFullFeature, setUserHasFullFeature] =
    useState<HistoryContextValue['userHasFullFeature']>(undefined)

  const fetchNextBatchOfUpdates = useCallback(() => {
    const loadUpdates = (updatesData: Update[]) => {
      const dateTimeNow = new Date()
      const timestamp24hoursAgo = dateTimeNow.setDate(dateTimeNow.getDate() - 1)
      let { updates, freeHistoryLimitHit } = updatesInfo
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
          freeHistoryLimitHit = true
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

      return { updates: updates.concat(loadedUpdates), freeHistoryLimitHit }
    }

    if (updatesInfo.atEnd || loadingState === 'loadingUpdates') return

    const updatesPromise = limitUpdates(
      fetchUpdates(projectId, updatesInfo.nextBeforeTimestamp)
    )
    const labelsPromise = labels == null ? fetchLabels(projectId) : null

    setLoadingState(
      loadingState === 'ready' ? 'loadingUpdates' : 'loadingInitial'
    )
    Promise.all([updatesPromise, labelsPromise])
      .then(([{ updates: updatesData, nextBeforeTimestamp }, labels]) => {
        const lastUpdateToV = updatesData.length ? updatesData[0].toV : null

        if (labels) {
          setLabels(loadLabels(labels, lastUpdateToV))
        }

        const { updates, freeHistoryLimitHit } = loadUpdates(updatesData)

        const atEnd =
          nextBeforeTimestamp == null || freeHistoryLimitHit || !updates.length

        setUpdatesInfo({
          updates,
          freeHistoryLimitHit,
          atEnd,
          nextBeforeTimestamp,
        })
      })
      .catch(error => {
        setError(error)
        setUpdatesInfo({ ...updatesInfo, atEnd: true })
      })
      .finally(() => {
        setLoadingState('ready')
      })
  }, [
    loadingState,
    labels,
    projectId,
    projectOwnerId,
    userId,
    userHasFullFeature,
    updatesInfo,
  ])

  // Initial load when the History tab is active
  const initialFetch = useRef(false)
  useEffect(() => {
    if (view === 'history' && !initialFetch.current) {
      fetchNextBatchOfUpdates()
      initialFetch.current = true
    }
  }, [view, fetchNextBatchOfUpdates])

  const { updateRange, comparing } = selection
  const { updates } = updatesInfo

  // Load files when the update selection changes
  useEffect(() => {
    if (!updateRange) {
      return
    }
    const { fromV, toV } = updateRange

    diffFiles(projectId, fromV, toV).then(({ diff: files }) => {
      const pathname = autoSelectFile(
        files,
        updateRange.toV,
        comparing,
        updates
      )
      const newFiles = files.map(file => {
        if (isFileRenamed(file) && file.newPathname) {
          return renamePathnameKey(file)
        }

        return file
      })
      setSelection({ updateRange, comparing, files: newFiles, pathname })
    })
  }, [updateRange, projectId, updates, comparing])

  useEffect(() => {
    // Set update range if there isn't one and updates have loaded
    if (updates.length && !updateRange) {
      setSelection({
        updateRange: {
          fromV: updates[0].fromV,
          toV: updates[0].toV,
          fromVTimestamp: updates[0].meta.end_ts,
          toVTimestamp: updates[0].meta.end_ts,
        },
        comparing: false,
        files: [],
        pathname: null,
      })
    }
  }, [updateRange, updates])

  const value = useMemo<HistoryContextValue>(
    () => ({
      error,
      loadingState,
      updatesInfo,
      setUpdatesInfo,
      labels,
      setLabels,
      userHasFullFeature,
      projectId,
      selection,
      setSelection,
      fetchNextBatchOfUpdates,
    }),
    [
      error,
      loadingState,
      updatesInfo,
      setUpdatesInfo,
      labels,
      setLabels,
      userHasFullFeature,
      projectId,
      selection,
      setSelection,
      fetchNextBatchOfUpdates,
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
