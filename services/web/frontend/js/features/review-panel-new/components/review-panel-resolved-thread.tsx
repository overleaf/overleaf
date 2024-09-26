import React, { FC } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { ThreadId } from '../../../../../types/review-panel/review-panel'
import { useThreadsActionsContext } from '../context/threads-context'
import { Button } from 'react-bootstrap'
import MaterialIcon from '@/shared/components/material-icon'
import { ExpandableContent } from './review-panel-expandable-content'
import { ReviewPanelCommentContent } from './review-panel-comment-content'
import { Change, CommentOperation } from '../../../../../types/change'
import Tooltip from '@/shared/components/tooltip'

export const ReviewPanelResolvedThread: FC<{
  id: string
  comment: Change<CommentOperation>
  docName: string
}> = ({ id, comment, docName }) => {
  const { t } = useTranslation()
  const { reopenThread, deleteThread } = useThreadsActionsContext()

  return (
    <div className="review-panel-resolved-comment" key={id}>
      <div className="review-panel-resolved-comment-header">
        <div>
          <Trans
            i18nKey="from_filename"
            components={[
              // eslint-disable-next-line react/jsx-key
              <span className="review-panel-resolved-comment-filename" />,
            ]}
            values={{ filename: docName }}
            shouldUnescape
            tOptions={{ interpolation: { escapeValue: true } }}
          />
        </div>
        <div className="review-panel-resolved-comment-buttons">
          <Tooltip
            id="reopen-thread"
            overlayProps={{ placement: 'bottom' }}
            description={t('reopen')}
          >
            <Button onClick={() => reopenThread(id as ThreadId)}>
              <MaterialIcon type="refresh" accessibilityLabel={t('reopen')} />
            </Button>
          </Tooltip>

          <Tooltip
            id="delete-thread"
            overlayProps={{ placement: 'bottom' }}
            description={t('delete')}
          >
            <Button onClick={() => deleteThread(id as ThreadId)}>
              <MaterialIcon type="delete" accessibilityLabel={t('delete')} />
            </Button>
          </Tooltip>
        </div>
      </div>
      <div className="review-panel-resolved-comment-quoted-text">
        <div className="review-panel-resolved-comment-quoted-text-label">
          {t('quoted_text')}
        </div>
        <ExpandableContent className="review-panel-resolved-comment-quoted-text-quote">
          {comment?.op.c}
        </ExpandableContent>
      </div>

      <ReviewPanelCommentContent comment={comment} isResolved />
    </div>
  )
}
