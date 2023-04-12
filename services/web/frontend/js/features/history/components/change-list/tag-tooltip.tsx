import { useTranslation } from 'react-i18next'
import Icon from '../../../../shared/components/icon'
import Tooltip from '../../../../shared/components/tooltip'
import Badge from '../../../../shared/components/badge'
import { useHistoryContext } from '../../context/history-context'
import { isPseudoLabel } from '../../utils/label'
import { formatDate } from '../../../../utils/dates'
import { LoadedLabel } from '../../services/types/label'

type TagProps = {
  label: LoadedLabel
  currentUserId: string
}

function Tag({ label, currentUserId, ...props }: TagProps) {
  const { t } = useTranslation()
  const isPseudoCurrentStateLabel = isPseudoLabel(label)
  const isOwnedByCurrentUser = !isPseudoCurrentStateLabel
    ? label.user_id === currentUserId
    : null

  const handleDelete = (e: React.MouseEvent, label: LoadedLabel) => {
    e.stopPropagation()
  }

  return (
    <Badge
      prepend={<Icon type="tag" fw />}
      onClose={e => handleDelete(e, label)}
      showCloseButton={Boolean(
        isOwnedByCurrentUser && !isPseudoCurrentStateLabel
      )}
      closeBtnProps={{ 'aria-label': t('delete') }}
      className="history-version-badge"
      {...props}
    >
      {isPseudoCurrentStateLabel
        ? t('history_label_project_current_state')
        : label.comment}
    </Badge>
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
      key={label.id}
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
