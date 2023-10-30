import { useTranslation } from 'react-i18next'
import { formatDate, fromNowDate } from '../../../../../utils/dates'
import { Project } from '../../../../../../../types/project/dashboard/api'
import Tooltip from '../../../../../shared/components/tooltip'
import { getUserName } from '../../../util/user'

type LastUpdatedCellProps = {
  project: Project
}

export default function LastUpdatedCell({ project }: LastUpdatedCellProps) {
  const { t } = useTranslation()

  const displayText = project.lastUpdatedBy
    ? t('last_updated_date_by_x', {
        lastUpdatedDate: fromNowDate(project.lastUpdated),
        person: getUserName(project.lastUpdatedBy),
      })
    : fromNowDate(project.lastUpdated)

  const tooltipText = formatDate(project.lastUpdated)
  return (
    <Tooltip
      key={`tooltip-last-updated-${project.id}`}
      id={`tooltip-last-updated-${project.id}`}
      description={tooltipText}
      overlayProps={{ placement: 'top', trigger: ['hover', 'focus'] }}
    >
      {/* OverlayTrigger won't fire unless icon is wrapped in a span */}
      <span>{displayText}</span>
    </Tooltip>
  )
}
