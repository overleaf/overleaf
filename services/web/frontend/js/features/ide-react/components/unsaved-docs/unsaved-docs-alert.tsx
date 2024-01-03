import { FC, useMemo } from 'react'
import { useFileTreePathContext } from '@/features/file-tree/contexts/file-tree-path'
import { Alert } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'

export const UnsavedDocsAlert: FC<{ unsavedDocs: Map<string, number> }> = ({
  unsavedDocs,
}) => (
  <>
    {[...unsavedDocs.entries()].map(
      ([docId, seconds]) =>
        seconds > 8 && (
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
  const { t } = useTranslation()

  const doc = useMemo(() => {
    const path = pathInFolder(docId)
    return path ? findEntityByPath(path) : null
  }, [docId, findEntityByPath, pathInFolder])

  if (!doc) {
    return null
  }

  return (
    <Alert bsStyle="warning" bsSize="small">
      {t('saving_notification_with_seconds', {
        docname: doc.entity.name,
        seconds,
      })}
    </Alert>
  )
}
