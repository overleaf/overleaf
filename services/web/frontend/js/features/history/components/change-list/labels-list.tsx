import { useTranslation } from 'react-i18next'
import { Fragment } from 'react'
import TagTooltip from './tag-tooltip'
import UserNameWithColoredBadge from './user-name-with-colored-badge'
import { useHistoryContext } from '../../context/history-context'
import { useUserContext } from '../../../../shared/context/user-context'
import { isPseudoLabel } from '../../utils/label'
import { formatTime } from '../../../utils/format-date'
import { groupBy, orderBy } from 'lodash'
import { LoadedLabel } from '../../services/types/label'

function LabelsList() {
  const { t } = useTranslation()
  const { labels } = useHistoryContext()
  const { id: currentUserId } = useUserContext()

  let versionWithLabels: { version: number; labels: LoadedLabel[] }[] = []
  if (labels) {
    const groupedLabelsHash = groupBy(labels, 'version')
    versionWithLabels = Object.keys(groupedLabelsHash).map(key => ({
      version: parseInt(key, 10),
      labels: groupedLabelsHash[key],
    }))
    versionWithLabels = orderBy(versionWithLabels, ['version'], ['desc'])
  }

  return (
    <>
      {versionWithLabels.map(({ version, labels }) => (
        <div
          key={version}
          className="history-version-details"
          data-testid="history-version-details"
        >
          {labels.map(label => (
            <Fragment key={label.id}>
              <TagTooltip
                showTooltip={false}
                currentUserId={currentUserId}
                label={label}
              />
              <time className="history-version-metadata-time">
                {formatTime(label.created_at, 'Do MMMM, h:mm a')}
              </time>
              {!isPseudoLabel(label) && (
                <div className="history-version-saved-by">
                  <span className="history-version-saved-by-label">
                    {t('saved_by')}
                  </span>
                  <UserNameWithColoredBadge
                    user={{
                      id: label.user_id,
                      displayName: label.user_display_name,
                    }}
                    currentUserId={currentUserId}
                  />
                </div>
              )}
            </Fragment>
          ))}
        </div>
      ))}
    </>
  )
}

export default LabelsList
