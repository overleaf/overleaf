import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { EditorType } from '@/features/ide-react/editor/types/editor-type'
import { putJSON } from '@/infrastructure/fetch-json'
import { debugConsole } from '@/utils/debugging'
import { useCallback, useEffect, useRef } from 'react'
import useEventListener from '@/shared/hooks/use-event-listener'
import useDomEventListener from '@/shared/hooks/use-dom-event-listener'
import { useIsNewEditorEnabled } from '@/features/ide-redesign/utils/new-editor-utils'
import {
  IdeLayout,
  IdeView,
  useLayoutContext,
} from '@/shared/context/layout-context'
import {
  RailTabKey,
  useRailContext,
} from '@/features/ide-redesign/contexts/rail-context'

function createEditingSessionHeartbeatData(
  editorType: EditorType,
  newEditor: boolean,
  view: IdeView | null,
  layout: IdeLayout,
  railOpen: boolean,
  railTab: RailTabKey,
  hasDetachedPdf: boolean
) {
  const newEditorSegmentation = newEditor ? { railOpen, railTab } : {}
  return {
    editorType,
    editorRedesign: newEditor,
    editorView: view,
    editorLayout: layout,
    hasDetachedPdf,
    ...newEditorSegmentation,
  }
}

function sendEditingSessionHeartbeat(
  projectId: string,
  segmentation: Record<string, unknown>
) {
  putJSON(`/editingSession/${projectId}`, {
    body: { segmentation },
  }).catch(debugConsole.error)
}

export function useEditingSessionHeartbeat() {
  const { projectId } = useIdeReactContext()
  const { getEditorType } = useEditorManagerContext()
  const newEditor = useIsNewEditorEnabled()
  const { view, pdfLayout: layout, detachIsLinked } = useLayoutContext()
  const { isOpen: railIsOpen, selectedTab: selectedRailTab } = useRailContext()

  // Keep track of how many heartbeats we've sent so that we can calculate how
  // long to wait until the next one
  const heartBeatsSentRef = useRef(0)

  const heartBeatSentRecentlyRef = useRef(false)

  const heartBeatResetTimerRef = useRef<number>()

  useEffect(() => {
    return () => {
      window.clearTimeout(heartBeatResetTimerRef.current)
    }
  }, [])

  const editingSessionHeartbeat = useCallback(() => {
    debugConsole.log('[Event] heartbeat trigger')

    const editorType = getEditorType()
    if (editorType === null) return

    // Heartbeat already sent recently
    if (heartBeatSentRecentlyRef.current) return

    heartBeatSentRecentlyRef.current = true

    const segmentation = createEditingSessionHeartbeatData(
      editorType,
      newEditor,
      view,
      layout,
      railIsOpen,
      selectedRailTab,
      detachIsLinked
    )

    debugConsole.log('[Event] send heartbeat request', segmentation)
    sendEditingSessionHeartbeat(projectId, segmentation)

    const heartbeatsSent = heartBeatsSentRef.current
    heartBeatsSentRef.current++

    // Send two first heartbeats at 0 and 30s then increase the backoff time
    // 1min per call until we reach 5 min
    const backoffSecs =
      heartbeatsSent <= 2
        ? 30
        : heartbeatsSent <= 6
          ? (heartbeatsSent - 2) * 60
          : 300

    heartBeatResetTimerRef.current = window.setTimeout(() => {
      heartBeatSentRecentlyRef.current = false
    }, backoffSecs * 1000)
  }, [
    getEditorType,
    projectId,
    newEditor,
    view,
    layout,
    railIsOpen,
    selectedRailTab,
    detachIsLinked,
  ])

  // Hook the heartbeat up to editor events
  useEventListener('cursor:editor:update', editingSessionHeartbeat)
  useEventListener('scroll:editor:update', editingSessionHeartbeat)
  useDomEventListener(document, 'click', editingSessionHeartbeat)
}
