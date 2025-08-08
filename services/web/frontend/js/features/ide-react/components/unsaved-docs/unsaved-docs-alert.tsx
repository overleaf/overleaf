import { FC, useEffect, useMemo, useRef } from 'react'
import { useFileTreePathContext } from '@/features/file-tree/contexts/file-tree-path'
import { useTranslation } from 'react-i18next'
import OLNotification from '@/shared/components/ol/ol-notification'
import { sendMB } from '@/infrastructure/event-tracking'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'

const MAX_UNSAVED_ALERT_SECONDS = 15

export const UnsavedDocsAlert: FC<{ unsavedDocs: Map<string, number> }> = ({
  unsavedDocs,
}) => (
  <>
    {[...unsavedDocs.entries()].map(
      ([docId, seconds]) =>
        seconds >= MAX_UNSAVED_ALERT_SECONDS && (
          <UnsavedDocAlert key={docId} docId={docId} seconds={seconds} />
        )
    )}
  </>
)

const UnsavedDocAlert: FC<{ docId: string; seconds: number }> = ({
  docId,
  seconds,
}) => {
  const { pathInFolder, findEntityByPath } = useFileTreePathContext()
  const { socket } = useConnectionContext()
  const { t } = useTranslation()

  const recordedRef = useRef(false)

  useEffect(() => {
    if (!recordedRef.current) {
      recordedRef.current = true
      sendMB('unsaved-doc-alert-shown', {
        docId,
        transport: socket.socket.transport?.name,
      })
    }
  }, [docId, socket])

  const doc = useMemo(() => {
    const path = pathInFolder(docId)
    return path ? findEntityByPath(path) : null
  }, [docId, findEntityByPath, pathInFolder])

  if (!doc) {
    return null
  }

  return (
    <OLNotification
      type="warning"
      content={t('saving_notification_with_seconds', {
        docname: doc.entity.name,
        seconds,
      })}
    />
  )
}
