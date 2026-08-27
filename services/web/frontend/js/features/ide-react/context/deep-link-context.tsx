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
import { ThreadId } from '../../../../../types/review-panel/review-panel'
import { showCommentNotFoundToast } from '@/features/ide-react/components/deep-link-toasts'

const DEEP_LINK_PARAMS = ['doc', 'comment', 'change', 'open'] as const

// the `open` param names either an editor panel or a settings tab, so it
// resolves into one of two fields and the other stays null
type DeepLinkPanel = 'review-panel'
type DeepLinkSettings = 'project-notifications'

type DeepLinkParams = {
  docId: string | null
  threadId: ThreadId | null
  changeId: string | null
  panel: DeepLinkPanel | null
  settings: DeepLinkSettings | null
}

type DeepLinkContextValue = {
  deepLinkedDocId: string | null
  deepLinkedThreadId: ThreadId | null
  deepLinkedChangeId: string | null
  deepLinkedPanel: DeepLinkPanel | null
  deepLinkedSettings: DeepLinkSettings | null
  clearDeepLinkedThread: () => void
  clearDeepLinkedChange: () => void
  reportDeepLinkedThreadNotFound: () => void
}

const DeepLinkContext = createContext<DeepLinkContextValue | undefined>(
  undefined
)

function readPanel(value: string | null): DeepLinkPanel | null {
  if (value === 'review-panel') {
    return value
  }

  return null
}

function readSettings(value: string | null): DeepLinkSettings | null {
  if (value === 'project-notifications') {
    return value
  }

  return null
}

function readDeepLinkParams(): DeepLinkParams {
  const params = new URLSearchParams(window.location.search)
  const open = params.get('open')

  return {
    docId: params.get('doc'),
    threadId: params.get('comment') as ThreadId | null,
    changeId: params.get('change'),
    panel: readPanel(open),
    settings: readSettings(open),
  }
}

function stripDeepLinkParams() {
  const url = new URL(window.location.href)
  let changed = false

  for (const param of DEEP_LINK_PARAMS) {
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param)
      changed = true
    }
  }

  if (changed) {
    window.history.replaceState(window.history.state, '', url.toString())
  }
}

export const DeepLinkProvider: FC<React.PropsWithChildren> = ({ children }) => {
  const paramsRef = useRef<DeepLinkParams | null>(null)
  if (paramsRef.current === null) {
    paramsRef.current = readDeepLinkParams()
  }

  const { docId, panel, settings } = paramsRef.current
  const [threadId, setThreadId] = useState(paramsRef.current.threadId)
  const [changeId, setChangeId] = useState(paramsRef.current.changeId)

  useEffect(() => {
    stripDeepLinkParams()
  }, [])

  const clearDeepLinkedThread = useCallback(() => setThreadId(null), [])
  const clearDeepLinkedChange = useCallback(() => setChangeId(null), [])

  // several places give up on the comment at different points, so keep the
  // toast and the clear together in one call rather than pairing them by hand
  const reportDeepLinkedThreadNotFound = useCallback(() => {
    showCommentNotFoundToast()
    setThreadId(null)
  }, [])

  const value = useMemo(
    () => ({
      deepLinkedDocId: docId,
      deepLinkedThreadId: threadId,
      deepLinkedChangeId: changeId,
      deepLinkedPanel: panel,
      deepLinkedSettings: settings,
      clearDeepLinkedThread,
      clearDeepLinkedChange,
      reportDeepLinkedThreadNotFound,
    }),
    [
      docId,
      threadId,
      changeId,
      panel,
      settings,
      clearDeepLinkedThread,
      clearDeepLinkedChange,
      reportDeepLinkedThreadNotFound,
    ]
  )

  return (
    <DeepLinkContext.Provider value={value}>
      {children}
    </DeepLinkContext.Provider>
  )
}

export function useDeepLinkContext(): DeepLinkContextValue {
  const context = useContext(DeepLinkContext)

  if (!context) {
    throw new Error(
      'useDeepLinkContext is only available inside DeepLinkProvider'
    )
  }

  return context
}
