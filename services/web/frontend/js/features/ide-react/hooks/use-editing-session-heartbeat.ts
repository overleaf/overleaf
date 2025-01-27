import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { EditorType } from '@/features/ide-react/editor/types/editor-type'
import { putJSON } from '@/infrastructure/fetch-json'
import { debugConsole } from '@/utils/debugging'
import moment from 'moment'
import { useCallback, useState } from 'react'
import useEventListener from '@/shared/hooks/use-event-listener'
import useDomEventListener from '@/shared/hooks/use-dom-event-listener'

function createEditingSessionHeartbeatData(editorType: EditorType) {
  return {
    editorType,
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

  // Keep track of how many heartbeats we've sent so that we can calculate how
  // long wait until the next one
  const [heartbeatsSent, setHeartbeatsSent] = useState(0)
  const [nextHeartbeatAt, setNextHeartbeatAt] = useState(() => new Date())

  const editingSessionHeartbeat = useCallback(() => {
    debugConsole.log('[Event] heartbeat trigger')

    const editorType = getEditorType()
    if (editorType === null) return

    // If the next heartbeat is in the future, stop
    if (nextHeartbeatAt > new Date()) return

    const segmentation = createEditingSessionHeartbeatData(editorType)

    debugConsole.log('[Event] send heartbeat request', segmentation)
    sendEditingSessionHeartbeat(projectId, segmentation)

    setHeartbeatsSent(heartbeatsSent => heartbeatsSent + 1)

    // Send two first heartbeats at 0 and 30s then increase the backoff time
    // 1min per call until we reach 5 min
    const backoffSecs =
      heartbeatsSent <= 2
        ? 30
        : heartbeatsSent <= 6
          ? (heartbeatsSent - 2) * 60
          : 300

    setNextHeartbeatAt(moment().add(backoffSecs, 'seconds').toDate())
  }, [getEditorType, heartbeatsSent, nextHeartbeatAt, projectId])

  // Hook the heartbeat up to editor events
  useEventListener('cursor:editor:update', editingSessionHeartbeat)
  useEventListener('scroll:editor:update', editingSessionHeartbeat)
  useDomEventListener(document, 'click', editingSessionHeartbeat)
}
