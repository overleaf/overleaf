import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from '../../../../shared/components/icon'
import Tooltip from '../../../../shared/components/tooltip'
import { useHistoryContext } from '../../context/history-context'
import { isPseudoLabel } from '../../utils/label'
import { formatDate } from '../../../../utils/dates'
import { orderBy } from 'lodash'
import { Label, PseudoCurrentStateLabel } from '../../services/types/update'

type LabelBadgesProps = {
  showTooltip: boolean
  currentUserId: string
  labels: Array<Label | PseudoCurrentStateLabel>
}

function LabelBadges({ labels, currentUserId, showTooltip }: LabelBadgesProps) {
  const { t } = useTranslation()
  const { labels: allLabels } = useHistoryContext()
  const orderedLabels = orderBy(labels, ['created_at'], ['desc'])

  const handleDelete = (e: React.MouseEvent, label: Label) => {
    e.stopPropagation()
  }

  return (
    <>
      {orderedLabels.map(label => {
        const isPseudoCurrentStateLabel = isPseudoLabel(label)
        const isOwnedByCurrentUser = !isPseudoCurrentStateLabel
          ? label.user_id === currentUserId
          : null
        const currentLabelData = allLabels?.find(({ id }) => id === label.id)
        const labelOwnerName =
          currentLabelData && !isPseudoLabel(currentLabelData)
            ? currentLabelData.user_display_name
            : t('anonymous')

        const badgeContent = (
          <span className="history-version-badge">
            <Icon type="tag" fw />
            <span className="history-version-badge-comment">
              {isPseudoCurrentStateLabel
                ? t('history_label_project_current_state')
                : label.comment}
            </span>
            {isOwnedByCurrentUser && !isPseudoCurrentStateLabel && (
              <button
                type="button"
                className="history-version-label-delete-btn"
                onClick={e => handleDelete(e, label)}
                aria-label={t('delete')}
              >
                <span aria-hidden="true">&times;</span>
              </button>
            )}
          </span>
        )

        return (
          <Fragment key={label.id}>
            {showTooltip && !isPseudoCurrentStateLabel ? (
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
                {badgeContent}
              </Tooltip>
            ) : (
              badgeContent
            )}
          </Fragment>
        )
      })}
    </>
  )
}

export default LabelBadges
