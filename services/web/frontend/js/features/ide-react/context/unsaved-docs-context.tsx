import {
  createContext,
  FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { PermissionsLevel } from '@/features/ide-react/types/permissions'
import useEventListener from '@/shared/hooks/use-event-listener'
import getMeta from '@/utils/meta'
import { useFeatureFlag } from '@/shared/context/split-test-context'

const STALL_AFTER_SECONDS = 10 // treat saving as stalled after this time

type UnsavedDocsContextValue = {
  unsavedDocs: Map<string, number>
  isSavingStalled: boolean
  isLocked: boolean
}

export const UnsavedDocsContext = createContext<
  UnsavedDocsContextValue | undefined
>(undefined)

export const UnsavedDocsProvider: FC<React.PropsWithChildren> = ({
  children,
}) => {
  const { openDocs, debugTimers } = useEditorManagerContext()
  const { permissionsLevel, setPermissionsLevel } = useIdeReactContext()
  const [isLocked, setIsLocked] = useState(false)
  const [unsavedDocs, setUnsavedDocs] = useState(new Map<string, number>())
  const isPremiumUser = Boolean(getMeta('ol-user')?.features?.offlineMode)
  const intermittentConnectionImprovementsEnabled = useFeatureFlag(
    'intermittent-connection-improvements'
  )
  // lock the editor after this time if unsaved
  const MAX_UNSAVED_SECONDS_FREE = intermittentConnectionImprovementsEnabled
    ? 120
    : 30
  const MAX_UNSAVED_SECONDS_PREMIUM = intermittentConnectionImprovementsEnabled
    ? 600
    : 30

  const maxUnsavedSecondsLimit = isPremiumUser
    ? MAX_UNSAVED_SECONDS_PREMIUM
    : MAX_UNSAVED_SECONDS_FREE
  // always contains the latest value
  const previousUnsavedDocsRef = useRef(unsavedDocs)

  // always contains the latest value
  const permissionsLevelRef = useRef(permissionsLevel)
  useEffect(() => {
    permissionsLevelRef.current = permissionsLevel
  }, [permissionsLevel])

  // warn if the window is being closed with unsaved changes
  useEventListener(
    'beforeunload',
    useCallback(
      (event: BeforeUnloadEvent) => {
        if (openDocs.hasUnsavedChanges()) {
          // https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event
          event.preventDefault()
        }
      },
      [openDocs]
    )
  )

  // keep track of which docs are currently unsaved, and how long they've been unsaved for
  // NOTE: openDocs should never change, so it's safe to use as a dependency here
  useEffect(() => {
    const interval = window.setInterval(() => {
      debugTimers.current.CheckUnsavedDocs = Date.now()
      const unsavedDocs = new Map()

      const docs = openDocs.unsavedDocs()

      for (const doc of docs) {
        const oldestOpCreatedAt =
          doc.getInflightOpCreatedAt() ?? doc.getPendingOpCreatedAt()
        if (oldestOpCreatedAt) {
          const unsavedSeconds = Math.floor(
            (performance.now() - oldestOpCreatedAt) / 1000
          )
          unsavedDocs.set(doc.doc_id, unsavedSeconds)
        }
      }

      // avoid setting the unsavedDocs state to a new empty Map every second
      if (unsavedDocs.size > 0 || previousUnsavedDocsRef.current.size > 0) {
        previousUnsavedDocsRef.current = unsavedDocs
        setUnsavedDocs(unsavedDocs)
      }
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [openDocs, debugTimers])

  const maxUnsavedSeconds = Math.max(0, ...unsavedDocs.values())
  const isSavingStalled = maxUnsavedSeconds > STALL_AFTER_SECONDS

  // lock the editor if at least one doc has been unsaved for too long
  useEffect(() => {
    setIsLocked(maxUnsavedSeconds > maxUnsavedSecondsLimit)
  }, [maxUnsavedSeconds, maxUnsavedSecondsLimit])

  // display a modal and set the permissions level to readOnly if docs have been unsaved for too long
  const originalPermissionsLevelRef = useRef<PermissionsLevel | null>(null)
  useEffect(() => {
    if (isLocked) {
      originalPermissionsLevelRef.current = permissionsLevelRef.current
      // TODO: what if the real permissions level changes in the meantime?
      // TODO: perhaps the "locked" state should be stored in the editor context instead?
      setPermissionsLevel('readOnly')
    } else {
      if (originalPermissionsLevelRef.current) {
        setPermissionsLevel(originalPermissionsLevelRef.current)
      }
    }
  }, [isLocked, setPermissionsLevel])

  // remove the modal (and unlock the page) if the connection has been re-established and all the docs have been saved
  useEffect(() => {
    if (unsavedDocs.size === 0 && permissionsLevelRef.current === 'readOnly') {
      setIsLocked(false)
    }
  }, [unsavedDocs])

  const value = useMemo(
    () => ({ unsavedDocs, isSavingStalled, isLocked }),
    [unsavedDocs, isSavingStalled, isLocked]
  )

  return (
    <UnsavedDocsContext.Provider value={value}>
      {children}
    </UnsavedDocsContext.Provider>
  )
}

export function useUnsavedDocsContext(): UnsavedDocsContextValue {
  const context = useContext(UnsavedDocsContext)

  if (!context) {
    throw new Error(
      'useUnsavedDocsContext is only available inside UnsavedDocsProvider'
    )
  }

  return context
}
