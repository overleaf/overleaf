import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from 'react-bootstrap'
import Icon from '../../../../shared/components/icon'
import Tooltip from '../../../../shared/components/tooltip'
import Badge from '../../../../shared/components/badge'
import AccessibleModal from '../../../../shared/components/accessible-modal'
import ModalError from './modal-error'
import useAbortController from '../../../../shared/hooks/use-abort-controller'
import useAsync from '../../../../shared/hooks/use-async'
import useAddOrRemoveLabels from '../../hooks/use-add-or-remove-labels'
import { useHistoryContext } from '../../context/history-context'
import { deleteLabel } from '../../services/api'
import { isPseudoLabel } from '../../utils/label'
import { formatDate } from '../../../../utils/dates'
import { LoadedLabel } from '../../services/types/label'

type TagProps = {
  label: LoadedLabel
  currentUserId: string
}

function Tag({ label, currentUserId, ...props }: TagProps) {
  const { t } = useTranslation()
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const { projectId } = useHistoryContext()
  const { signal } = useAbortController()
  const { removeUpdateLabel } = useAddOrRemoveLabels()
  const { isLoading, isSuccess, isError, error, reset, runAsync } = useAsync()
  const isPseudoCurrentStateLabel = isPseudoLabel(label)
  const isOwnedByCurrentUser = !isPseudoCurrentStateLabel
    ? label.user_id === currentUserId
    : null

  const showConfirmationModal = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteModal(true)
  }

  const handleModalExited = () => {
    if (!isSuccess) return

    if (!isPseudoCurrentStateLabel) {
      removeUpdateLabel(label)
    }

    reset()
  }

  const localDeleteHandler = () => {
    runAsync(deleteLabel(projectId, label.id, signal))
      .then(() => setShowDeleteModal(false))
      .catch(console.error)
  }

  const responseError = error as unknown as {
    response: Response
    data?: {
      message?: string
    }
  }

  return (
    <>
      <Badge
        prepend={<Icon type="tag" fw />}
        onClose={showConfirmationModal}
        closeButton={Boolean(
          isOwnedByCurrentUser && !isPseudoCurrentStateLabel
        )}
        closeBtnProps={{ 'aria-label': t('delete') }}
        className="history-version-badge"
        data-testid="history-version-badge"
        {...props}
      >
        {isPseudoCurrentStateLabel
          ? t('history_label_project_current_state')
          : label.comment}
      </Badge>
      {!isPseudoCurrentStateLabel && (
        <AccessibleModal
          show={showDeleteModal}
          onExited={handleModalExited}
          onHide={() => setShowDeleteModal(false)}
          id="delete-history-label"
        >
          <Modal.Header>
            <Modal.Title>{t('history_delete_label')}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {isError && <ModalError error={responseError} />}
            <p>
              {t('history_are_you_sure_delete_label')}&nbsp;
              <strong>"{label.comment}"</strong>?
            </p>
          </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={isLoading}
              onClick={() => setShowDeleteModal(false)}
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={isLoading}
              onClick={localDeleteHandler}
            >
              {isLoading
                ? t('history_deleting_label')
                : t('history_delete_label')}
            </button>
          </Modal.Footer>
        </AccessibleModal>
      )}
    </>
  )
}

type LabelBadgesProps = {
  showTooltip: boolean
  currentUserId: string
  label: LoadedLabel
}

function TagTooltip({ label, currentUserId, showTooltip }: LabelBadgesProps) {
  const { t } = useTranslation()
  const { labels: allLabels } = useHistoryContext()

  const isPseudoCurrentStateLabel = isPseudoLabel(label)
  const currentLabelData = allLabels?.find(({ id }) => id === label.id)
  const labelOwnerName =
    currentLabelData && !isPseudoLabel(currentLabelData)
      ? currentLabelData.user_display_name
      : t('anonymous')

  return showTooltip && !isPseudoCurrentStateLabel ? (
    <Tooltip
      description={
        <div className="history-version-label-tooltip">
          <div className="history-version-label-tooltip-row">
            <b className="history-version-label-tooltip-row-comment">
              <Icon type="tag" fw />
              {label.comment}
            </b>
          </div>
          <div className="history-version-label-tooltip-row">
            {t('history_label_created_by')} {labelOwnerName}
          </div>
          <div className="history-version-label-tooltip-row">
            <time>{formatDate(label.created_at)}</time>
          </div>
        </div>
      }
      id={label.id}
      overlayProps={{ placement: 'left' }}
    >
      <Tag label={label} currentUserId={currentUserId} />
    </Tooltip>
  ) : (
    <Tag label={label} currentUserId={currentUserId} />
  )
}

export default TagTooltip
