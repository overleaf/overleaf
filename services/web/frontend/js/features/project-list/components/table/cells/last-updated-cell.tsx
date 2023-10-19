import { Trans } from 'react-i18next'
import { formatDate, fromNowDate } from '../../../../../utils/dates'
import { Project } from '../../../../../../../types/project/dashboard/api'
import Tooltip from '../../../../../shared/components/tooltip'
import { getUserName } from '../../../util/user'

type LastUpdatedCellProps = {
  project: Project
}

export default function LastUpdatedCell({ project }: LastUpdatedCellProps) {
  const displayText = project.lastUpdatedBy ? (
    <Trans
      i18nKey="last_updated_date_by_x"
      values={{
        lastUpdatedDate: fromNowDate(project.lastUpdated),
        person: getUserName(project.lastUpdatedBy),
      }}
      // eslint-disable-next-line react/jsx-boolean-value
      shouldUnescape={true}
      tOptions={{ interpolation: { escapeValue: true } }}
    />
  ) : (
    fromNowDate(project.lastUpdated)
  )

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
