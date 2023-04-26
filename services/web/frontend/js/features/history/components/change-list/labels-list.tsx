import { useTranslation } from 'react-i18next'
import HistoryVersionDetails from './history-version-details'
import TagTooltip from './tag-tooltip'
import UserNameWithColoredBadge from './user-name-with-colored-badge'
import LabelDropdown from './dropdown/label-dropdown'
import { useHistoryContext } from '../../context/history-context'
import { useUserContext } from '../../../../shared/context/user-context'
import { isUpdateSelected } from '../../utils/history-details'
import { isPseudoLabel } from '../../utils/label'
import { formatTime } from '../../../utils/format-date'
import { groupBy, orderBy } from 'lodash'
import { LoadedLabel } from '../../services/types/label'

function LabelsList() {
  const { t } = useTranslation()
  const { updatesInfo, labels, projectId, selection } = useHistoryContext()
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
      {versionWithLabels.map(({ version, labels }) => {
        const selected = isUpdateSelected({
          fromV: version,
          toV: version,
          selection,
        })

        const update = updatesInfo.updates.find(update => {
          return update.labels.some(label => label.version === version)
        })

        if (!update) return null

        return (
          <HistoryVersionDetails
            key={version}
            fromV={version}
            toV={version}
            fromVTimestamp={update.meta.end_ts}
            toVTimestamp={update.meta.end_ts}
            selected={selected}
          >
            <div className="history-version-main-details">
              {labels.map(label => (
                <div key={label.id} className="history-version-label">
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
                </div>
              ))}
            </div>
            <LabelDropdown
              id={version.toString()}
              projectId={projectId}
              version={version}
              updateMetaEndTimestamp={update.meta.end_ts}
              isComparing={selection.comparing}
              isSelected={selected}
            />
          </HistoryVersionDetails>
        )
      })}
    </>
  )
}

export default LabelsList
