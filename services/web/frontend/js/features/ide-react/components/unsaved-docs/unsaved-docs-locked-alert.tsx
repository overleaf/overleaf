import { FC, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Notification from '@/shared/components/notification'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'

export const UnsavedDocsLockedAlert: FC = () => {
  const { t } = useTranslation()
  const { openDocs } = useEditorManagerContext()
  const { reportError } = useIdeReactContext()

  useEffect(() => {
    const { pendingOpsLength, inflightOpsLength } = openDocs.getUnsavedOpsSize()
    reportError('connection-lost-with-unsaved-changes', {
      pendingOpsLength,
      inflightOpsLength,
    })
  }, [reportError, openDocs])

  return (
    <div className="notification-list">
      <Notification
        type="warning"
        content={
          <>
            <strong>{t('connection_lost_with_unsaved_changes')}</strong>{' '}
            {t('dont_reload_or_close_this_tab')} {t('your_changes_will_save')}
          </>
        }
      />
    </div>
  )
}
