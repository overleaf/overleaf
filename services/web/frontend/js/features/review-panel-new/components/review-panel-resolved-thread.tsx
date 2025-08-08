import React, { FC, useCallback, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { ThreadId } from '../../../../../types/review-panel/review-panel'
import { useThreadsActionsContext } from '../context/threads-context'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import MaterialIcon from '@/shared/components/material-icon'
import { ExpandableContent } from './review-panel-expandable-content'
import { ReviewPanelCommentContent } from './review-panel-comment-content'
import { Change, CommentOperation } from '../../../../../types/change'
import classNames from 'classnames'
import { debugConsole } from '@/utils/debugging'
import { useModalsContext } from '@/features/ide-react/context/modals-context'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { useUserContext } from '@/shared/context/user-context'

export const ReviewPanelResolvedThread: FC<{
  id: ThreadId
  comment: Change<CommentOperation>
  docName: string
}> = ({ id, comment, docName }) => {
  const { t } = useTranslation()
  const { reopenThread, deleteThread } = useThreadsActionsContext()
  const [processing, setProcessing] = useState(false)
  const { showGenericMessageModal } = useModalsContext()
  const permissions = usePermissionsContext()
  const user = useUserContext()
  const isCommentAuthor = user.id === comment.metadata?.user_id
  const canDelete =
    permissions.resolveAllComments ||
    (permissions.resolveOwnComments && isCommentAuthor)
  const canReopen = permissions.comment

  const handleReopenThread = useCallback(async () => {
    setProcessing(true)
    try {
      await reopenThread(id)
    } catch (err) {
      debugConsole.error(err)
      showGenericMessageModal(
        t('reopen_comment_error_title'),
        t('reopen_comment_error_message')
      )
    } finally {
      setProcessing(false)
    }
  }, [id, reopenThread, showGenericMessageModal, t])

  const handleDeleteThread = useCallback(async () => {
    setProcessing(true)
    try {
      await deleteThread(id)
    } catch (err) {
      debugConsole.error(err)
      showGenericMessageModal(
        t('delete_comment_error_title'),
        t('delete_comment_error_message')
      )
    } finally {
      setProcessing(false)
    }
  }, [id, deleteThread, showGenericMessageModal, t])

  return (
    <div
      className={classNames('review-panel-resolved-comment', {
        'review-panel-resolved-disabled': processing,
      })}
      key={id}
    >
      <div className="review-panel-resolved-comment-header">
        <div>
          <Trans
            i18nKey="from_filename"
            components={[
              // eslint-disable-next-line react/jsx-key
              <span
                className="review-panel-resolved-comment-filename"
                translate="no"
              />,
            ]}
            values={{ filename: docName }}
            shouldUnescape
            tOptions={{ interpolation: { escapeValue: true } }}
          />
        </div>
        <div className="review-panel-resolved-comment-buttons">
          {canReopen && (
            <OLTooltip
              id="reopen-thread"
              overlayProps={{ placement: 'bottom' }}
              description={t('reopen')}
            >
              <button
                type="button"
                className="btn"
                onClick={handleReopenThread}
              >
                <MaterialIcon type="refresh" accessibilityLabel={t('reopen')} />
              </button>
            </OLTooltip>
          )}
          {canDelete && (
            <OLTooltip
              id="delete-thread"
              overlayProps={{ placement: 'bottom' }}
              description={t('delete')}
            >
              <button
                type="button"
                className="btn"
                onClick={handleDeleteThread}
              >
                <MaterialIcon type="delete" accessibilityLabel={t('delete')} />
              </button>
            </OLTooltip>
          )}
        </div>
      </div>
      <div className="review-panel-resolved-comment-quoted-text">
        <div className="review-panel-resolved-comment-quoted-text-label">
          {t('quoted_text')}
        </div>
        <ExpandableContent
          className="review-panel-resolved-comment-quoted-text-quote"
          content={comment?.op.c}
          checkNewLines
          translate="no"
        />
      </div>

      <ReviewPanelCommentContent comment={comment} isResolved />
    </div>
  )
}
