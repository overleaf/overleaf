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
import { useCodeMirrorViewContext } from '../../codemirror-editor'
import Modal, { useBulkActionsModal } from '../entries/bulk-actions-entry/modal'
import getMeta from '../../../../../utils/meta'
import useScopeValue from '../../../../../shared/hooks/use-scope-value'

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
  const [addNewComment] =
    useScopeValue<(e: React.MouseEvent<HTMLButtonElement>) => void>(
      'addNewComment'
    )
  const view = useCodeMirrorViewContext()

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
    addNewComment(e)
    setTimeout(() => {
      // Re-render the comment box in order to add autofocus every time
      handleSetSubview('cur_file')
      setIsAddingComment(false)
      setIsAddingComment(true)
    }, 0)
  }

  return ReactDOM.createPortal(
    <>
      <div className="rp-in-editor-widgets react-rp-in-editor-widgets">
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

export default EditorWidgets
