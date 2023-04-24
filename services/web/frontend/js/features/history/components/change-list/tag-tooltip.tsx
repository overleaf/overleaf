import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Modal } from 'react-bootstrap'
import { useHistoryContext } from '../../context/history-context'
import Icon from '../../../../shared/components/icon'
import Tooltip from '../../../../shared/components/tooltip'
import Badge from '../../../../shared/components/badge'
import AccessibleModal from '../../../../shared/components/accessible-modal'
import useAsync from '../../../../shared/hooks/use-async'
import { deleteJSON } from '../../../../infrastructure/fetch-json'
import { isLabel, isPseudoLabel, loadLabels } from '../../utils/label'
import { formatDate } from '../../../../utils/dates'
import { LoadedLabel } from '../../services/types/label'

type TagProps = {
  label: LoadedLabel
  currentUserId: string
}

function Tag({ label, currentUserId, ...props }: TagProps) {
  const { t } = useTranslation()
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const { projectId, updatesInfo, setUpdatesInfo, labels, setLabels } =
    useHistoryContext()
  const { isLoading, isSuccess, isError, error, runAsync } = useAsync()
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

    const tempUpdates = [...updatesInfo.updates]
    for (const [i, update] of tempUpdates.entries()) {
      if (update.toV === label.version) {
        tempUpdates[i] = {
          ...update,
          labels: update.labels.filter(({ id }) => id !== label.id),
        }
        break
      }
    }

    setUpdatesInfo({ ...updatesInfo, updates: tempUpdates })

    if (labels) {
      const nonPseudoLabels = labels.filter(isLabel)
      const filteredLabels = nonPseudoLabels.filter(({ id }) => id !== label.id)
      setLabels(loadLabels(filteredLabels, tempUpdates[0].toV))
    }

    setShowDeleteModal(false)

    // TODO _handleHistoryUIStateChange
  }

  const localDeleteHandler = () => {
    runAsync(deleteJSON(`/project/${projectId}/labels/${label.id}`))
      .then(() => {
        setShowDeleteModal(false)
      })
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
            {isError ? (
              responseError.response.status === 400 &&
              responseError?.data?.message ? (
                <Alert bsStyle="danger">{responseError.data.message}</Alert>
              ) : (
                <Alert bsStyle="danger">
                  {t('generic_something_went_wrong')}
                </Alert>
              )
            ) : null}
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
            <b>
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
