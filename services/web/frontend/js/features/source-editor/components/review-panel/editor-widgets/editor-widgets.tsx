import ReactDOM from 'react-dom'
import { useTranslation } from 'react-i18next'
import ToggleWidget from './toggle-widget'
import BulkActions from '../entries/bulk-actions-entry/bulk-actions'
import AddCommentButton from '../add-comment-button'
import Icon from '../../../../../shared/components/icon'
import {
  useReviewPanelUpdaterFnsContext,
  useReviewPanelValueContext,
} from '../../../context/review-panel/review-panel-context'
import { useIdeContext } from '@/shared/context/ide-context'
import { useCodeMirrorViewContext } from '../../codemirror-editor'
import Modal, { useBulkActionsModal } from '../entries/bulk-actions-entry/modal'
import getMeta from '../../../../../utils/meta'
import useScopeValue from '../../../../../shared/hooks/use-scope-value'
import useScopeEventListener from '@/shared/hooks/use-scope-event-listener'
import { memo, useCallback } from 'react'
import { useLayoutContext } from '@/shared/context/layout-context'
import classnames from 'classnames'

function EditorWidgets() {
  const { t } = useTranslation()
  const {
    show,
    setShow,
    isAccept,
    handleShowBulkAcceptDialog,
    handleShowBulkRejectDialog,
    handleConfirmDialog,
  } = useBulkActionsModal()
  const { setIsAddingComment, handleSetSubview } =
    useReviewPanelUpdaterFnsContext()
  const { isReactIde } = useIdeContext()
  const { toggleReviewPanel } = useReviewPanelUpdaterFnsContext()
  const [addNewComment] =
    useScopeValue<(e: React.MouseEvent<HTMLButtonElement>) => void>(
      'addNewComment'
    )
  const view = useCodeMirrorViewContext()
  const { reviewPanelOpen } = useLayoutContext()

  const {
    entries,
    openDocId,
    nVisibleSelectedChanges: nChanges,
    wantTrackChanges,
    permissions,
  } = useReviewPanelValueContext()

  const hasTrackChangesFeature = getMeta('ol-hasTrackChangesFeature')

  const currentDocEntries =
    openDocId && openDocId in entries ? entries[openDocId] : undefined

  const handleAddNewCommentClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isReactIde) {
      e.preventDefault()
      setIsAddingComment(true)
      toggleReviewPanel()
      return
    }

    addNewComment(e)
    setTimeout(() => {
      // Re-render the comment box in order to add autofocus every time
      handleSetSubview('cur_file')
      setIsAddingComment(false)
      setIsAddingComment(true)
    }, 0)
  }

  useScopeEventListener(
    'comment:start_adding',
    useCallback(() => {
      setIsAddingComment(true)
    }, [setIsAddingComment])
  )

  return ReactDOM.createPortal(
    <>
      <div
        className={classnames(
          'rp-in-editor-widgets',
          'react-rp-in-editor-widgets',
          { hidden: reviewPanelOpen }
        )}
      >
        <div className="rp-in-editor-widgets-inner">
          {wantTrackChanges && <ToggleWidget />}
          {nChanges > 1 && (
            <>
              <BulkActions.Button onClick={handleShowBulkAcceptDialog}>
                <Icon type="check" /> {t('accept_all')} ({nChanges})
              </BulkActions.Button>
              <BulkActions.Button onClick={handleShowBulkRejectDialog}>
                <Icon type="times" /> {t('reject_all')} ({nChanges})
              </BulkActions.Button>
            </>
          )}
          {hasTrackChangesFeature &&
            permissions.comment &&
            currentDocEntries?.['add-comment'] && (
              <AddCommentButton onClick={handleAddNewCommentClick}>
                <Icon type="comment" /> {t('add_comment')}
              </AddCommentButton>
            )}
        </div>
      </div>
      <Modal
        show={show}
        setShow={setShow}
        isAccept={isAccept}
        nChanges={nChanges}
        onConfirm={handleConfirmDialog}
      />
    </>,
    view.scrollDOM
  )
}

export default memo(EditorWidgets)
