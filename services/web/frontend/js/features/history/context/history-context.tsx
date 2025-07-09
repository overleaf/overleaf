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
import { renamePathnameKey } from '../utils/file-tree'
import { isFileRenamed } from '../utils/file-diff'
import { loadLabels } from '../utils/label'
import { autoSelectFile } from '../utils/auto-select-file'
import usePersistedState from '../../../shared/hooks/use-persisted-state'
import moment from 'moment'
import { cloneDeep } from 'lodash'
import {
  FetchUpdatesResponse,
  LoadedUpdate,
  Update,
} from '../services/types/update'
import { Selection } from '../services/types/selection'
import { useErrorBoundary } from 'react-error-boundary'
import { getUpdateForVersion } from '../utils/history-details'
import { getHueForUserId } from '@/shared/utils/colors'

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
    if (maxBatchSize > 0 && updates.length > maxBatchSize) {
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

const selectionInitialState: Selection = {
  updateRange: null,
  comparing: false,
  files: [],
  previouslySelectedPathname: null,
}

const updatesInfoInitialState: HistoryContextValue['updatesInfo'] = {
  updates: [],
  visibleUpdateCount: null,
  atEnd: false,
  freeHistoryLimitHit: false,
  nextBeforeTimestamp: undefined,
  loadingState: 'loadingInitial',
}

function useHistory() {
  const { view } = useLayoutContext()
  const user = useUserContext()
  const { projectId, project, features } = useProjectContext()
  const userId = user.id
  const projectOwnerId = project?.owner?._id
  const userHasFullFeature = Boolean(features.versioning || user.isAdmin)
  const currentUserIsOwner = projectOwnerId === userId

  const [selection, setSelection] = useState<Selection>(selectionInitialState)

  const [updatesInfo, setUpdatesInfo] = useState<
    HistoryContextValue['updatesInfo']
  >(updatesInfoInitialState)
  const [labels, setLabels] = useState<HistoryContextValue['labels']>(null)
  const [labelsOnly, setLabelsOnly] = usePersistedState(
    `history.userPrefs.showOnlyLabels.${projectId}`,
    false
  )

  const updatesAbortControllerRef = useRef<AbortController | null>(null)
  const { showBoundary } = useErrorBoundary()

  const fetchNextBatchOfUpdates = useCallback(() => {
    // If there is an in-flight request for updates, just let it complete, by
    // bailing out
    if (updatesAbortControllerRef.current) {
      return
    }

    const updatesLoadingState = updatesInfo.loadingState

    const loadUpdates = (updatesData: Update[]) => {
      const dateTimeNow = new Date()
      const timestamp24hoursAgo = dateTimeNow.setDate(dateTimeNow.getDate() - 1)
      let { updates, freeHistoryLimitHit, visibleUpdateCount } = updatesInfo
      let previousUpdate = updates[updates.length - 1]

      const loadedUpdates: LoadedUpdate[] = cloneDeep(updatesData)
      for (const [index, update] of loadedUpdates.entries()) {
        for (const user of update.meta.users) {
          if (user) {
            user.hue = getHueForUserId(user.id)
          }
        }
        if (
          !previousUpdate ||
          !moment(previousUpdate.meta.end_ts).isSame(update.meta.end_ts, 'day')
        ) {
          update.meta.first_in_day = true
        }

        previousUpdate = update

        // the free tier cutoff is 24 hours, so show one extra update
        //  after which will become the fade teaser above the paywall
        if (
          !userHasFullFeature &&
          visibleUpdateCount === null &&
          update.meta.end_ts < timestamp24hoursAgo
        ) {
          // Make sure that we show at least one entry fully (to allow labelling), and one extra for fading
          //  Since the index for the first free tier cutoff will be at 0 if all versions were updated the day before (all version in the past),
          //  we need to +2 instead of +1. this gives us one which is selected and one which is faded
          visibleUpdateCount = index > 0 ? index + 1 : 2
          freeHistoryLimitHit = true
        }
      }

      return {
        updates: updates.concat(loadedUpdates),
        visibleUpdateCount,
        freeHistoryLimitHit,
      }
    }

    if (
      updatesInfo.atEnd ||
      !(
        updatesLoadingState === 'loadingInitial' ||
        updatesLoadingState === 'ready'
      )
    ) {
      return
    }

    updatesAbortControllerRef.current = new AbortController()
    const signal = updatesAbortControllerRef.current.signal

    const updatesPromise = limitUpdates(
      fetchUpdates(projectId, updatesInfo.nextBeforeTimestamp, signal)
    )
    const labelsPromise = labels == null ? fetchLabels(projectId, signal) : null

    setUpdatesInfo({
      ...updatesInfo,
      loadingState:
        updatesLoadingState === 'ready' ? 'loadingUpdates' : 'loadingInitial',
    })

    Promise.all([updatesPromise, labelsPromise])
      .then(([{ updates: updatesData, nextBeforeTimestamp }, labels]) => {
        if (labels) {
          setLabels(loadLabels(labels, updatesData))
        }

        const { updates, visibleUpdateCount, freeHistoryLimitHit } =
          loadUpdates(updatesData)

        const atEnd =
          nextBeforeTimestamp == null || freeHistoryLimitHit || !updates.length

        setUpdatesInfo({
          updates,
          visibleUpdateCount,
          freeHistoryLimitHit,
          atEnd,
          nextBeforeTimestamp,
          loadingState: 'ready',
        })
      })
      .catch(showBoundary)
      .finally(() => {
        updatesAbortControllerRef.current = null
      })
  }, [updatesInfo, projectId, labels, showBoundary, userHasFullFeature])

  // Abort in-flight updates request on unmount
  useEffect(() => {
    return () => {
      if (updatesAbortControllerRef.current) {
        updatesAbortControllerRef.current.abort()
      }
    }
  }, [])

  // Initial load on first render
  const initialFetch = useRef(false)
  useEffect(() => {
    if (view === 'history' && !initialFetch.current) {
      initialFetch.current = true
      return fetchNextBatchOfUpdates()
    }
  }, [view, fetchNextBatchOfUpdates])

  useEffect(() => {
    // Reset some parts of the state
    if (view !== 'history') {
      initialFetch.current = false
      setSelection(prevSelection => ({
        ...selectionInitialState,
        // retain the previously selected pathname
        previouslySelectedPathname: prevSelection.previouslySelectedPathname,
      }))
      setUpdatesInfo(updatesInfoInitialState)
      setLabels(null)
    }
  }, [view])

  const resetSelection = useCallback(() => {
    setSelection(selectionInitialState)
  }, [])

  const { updateRange } = selection
  const { fromV, toV } = updateRange || {}
  const { updates } = updatesInfo

  const updateForToV =
    toV === undefined ? undefined : getUpdateForVersion(toV, updates)

  // Load files when the update selection changes
  const [loadingFileDiffs, setLoadingFileDiffs] = useState(false)

  useEffect(() => {
    if (fromV === undefined || toV === undefined) {
      return
    }

    let abortController: AbortController | null = new AbortController()
    setLoadingFileDiffs(true)

    diffFiles(projectId, fromV, toV, abortController.signal)
      .then(({ diff: files }) => {
        setSelection(previousSelection => {
          const selectedFile = autoSelectFile(
            files,
            toV,
            previousSelection.comparing,
            updateForToV,
            previousSelection.previouslySelectedPathname
          )
          const newFiles = files.map(file => {
            if (isFileRenamed(file) && file.newPathname) {
              return renamePathnameKey(file)
            }

            return file
          })
          return {
            ...previousSelection,
            files: newFiles,
            selectedFile,
            previouslySelectedPathname: selectedFile.pathname,
          }
        })
      })
      .catch(showBoundary)
      .finally(() => {
        setLoadingFileDiffs(false)
        abortController = null
      })

    return () => {
      if (abortController) {
        abortController.abort()
      }
    }
  }, [projectId, fromV, toV, updateForToV, showBoundary])

  useEffect(() => {
    // Set update range if there isn't one and updates have loaded
    if (updates.length && !updateRange) {
      setSelection(prevSelection => ({
        ...prevSelection,
        updateRange: {
          fromV: updates[0].fromV,
          toV: updates[0].toV,
          fromVTimestamp: updates[0].meta.end_ts,
          toVTimestamp: updates[0].meta.end_ts,
        },
        comparing: false,
        files: [],
      }))
    }
  }, [updateRange, updates])

  const value = useMemo<HistoryContextValue>(
    () => ({
      loadingFileDiffs,
      updatesInfo,
      setUpdatesInfo,
      labels,
      setLabels,
      labelsOnly,
      setLabelsOnly,
      userHasFullFeature,
      currentUserIsOwner,
      projectId,
      selection,
      setSelection,
      fetchNextBatchOfUpdates,
      resetSelection,
    }),
    [
      loadingFileDiffs,
      updatesInfo,
      setUpdatesInfo,
      labels,
      setLabels,
      labelsOnly,
      setLabelsOnly,
      userHasFullFeature,
      currentUserIsOwner,
      projectId,
      selection,
      setSelection,
      fetchNextBatchOfUpdates,
      resetSelection,
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
