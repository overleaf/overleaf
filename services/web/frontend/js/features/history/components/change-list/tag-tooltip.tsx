import { forwardRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import OLModal, {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import ModalError from './modal-error'
import useAbortController from '../../../../shared/hooks/use-abort-controller'
import useAsync from '../../../../shared/hooks/use-async'
import useAddOrRemoveLabels from '../../hooks/use-add-or-remove-labels'
import { useHistoryContext } from '../../context/history-context'
import { deleteLabel } from '../../services/api'
import { isPseudoLabel } from '../../utils/label'
import { LoadedLabel } from '../../services/types/label'
import { debugConsole } from '@/utils/debugging'
import { FormatTimeBasedOnYear } from '@/shared/components/format-time-based-on-year'
import { useEditorContext } from '@/shared/context/editor-context'
import OLTag from '@/features/ui/components/ol/ol-tag'
import OLButton from '@/features/ui/components/ol/ol-button'
import OLTagIcon from '@/features/ui/components/ol/icons/ol-tag-icon'

type TagProps = {
  label: LoadedLabel
  currentUserId: string
}

const ChangeTag = forwardRef<HTMLElement, TagProps>(
  ({ label, currentUserId, ...props }: TagProps, ref) => {
    const { isProjectOwner } = useEditorContext()

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
        .catch(debugConsole.error)
    }

    const responseError = error as unknown as {
      response: Response
      data?: {
        message?: string
      }
    }

    const showCloseButton = Boolean(
      (isOwnedByCurrentUser || isProjectOwner) && !isPseudoCurrentStateLabel
    )

    return (
      <>
        <OLTag
          ref={ref}
          prepend={<OLTagIcon />}
          closeBtnProps={
            showCloseButton
              ? { 'aria-label': t('delete'), onClick: showConfirmationModal }
              : undefined
          }
          className="history-version-badge"
          data-testid="history-version-badge"
          {...props}
        >
          {isPseudoCurrentStateLabel
            ? t('history_label_project_current_state')
            : label.comment}
        </OLTag>
        {!isPseudoCurrentStateLabel && (
          <OLModal
            show={showDeleteModal}
            onExited={handleModalExited}
            onHide={() => setShowDeleteModal(false)}
            id="delete-history-label"
          >
            <OLModalHeader>
              <OLModalTitle>{t('history_delete_label')}</OLModalTitle>
            </OLModalHeader>
            <OLModalBody>
              {isError && <ModalError error={responseError} />}
              <p>
                {t('history_are_you_sure_delete_label')}&nbsp;
                <strong>"{label.comment}"</strong>?
              </p>
            </OLModalBody>
            <OLModalFooter>
              <OLButton
                variant="secondary"
                disabled={isLoading}
                onClick={() => setShowDeleteModal(false)}
              >
                {t('cancel')}
              </OLButton>
              <OLButton
                variant="danger"
                disabled={isLoading}
                isLoading={isLoading}
                onClick={localDeleteHandler}
                bs3Props={{
                  loading: isLoading
                    ? t('history_deleting_label')
                    : t('history_delete_label'),
                }}
              >
                {t('history_delete_label')}
              </OLButton>
            </OLModalFooter>
          </OLModal>
        )}
      </>
    )
  }
)

ChangeTag.displayName = 'ChangeTag'

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

  return !isPseudoCurrentStateLabel ? (
    <OLTooltip
      description={
        <div className="history-version-label-tooltip">
          <div className="history-version-label-tooltip-row">
            <b className="history-version-label-tooltip-row-comment">
              <OLTagIcon />
              &nbsp;
              {label.comment}
            </b>
          </div>
          <div className="history-version-label-tooltip-row">
            {t('history_label_created_by')} {labelOwnerName}
          </div>
          <div className="history-version-label-tooltip-row">
            <time>
              <FormatTimeBasedOnYear date={label.created_at} />
            </time>
          </div>
        </div>
      }
      id={label.id}
      overlayProps={{ placement: 'left' }}
      hidden={!showTooltip}
    >
      <ChangeTag label={label} currentUserId={currentUserId} />
    </OLTooltip>
  ) : (
    <ChangeTag label={label} currentUserId={currentUserId} />
  )
}

export default TagTooltip
