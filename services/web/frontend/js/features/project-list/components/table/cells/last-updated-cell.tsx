import { formatDate, fromNowDate } from '../../../../../utils/dates'
import { Project } from '../../../../../../../types/project/dashboard/api'
import { LastUpdatedBy } from '@/features/project-list/components/table/cells/last-updated-by'
import OLTooltip from '@/shared/components/ol/ol-tooltip'

type LastUpdatedCellProps = {
  project: Project
}

export default function LastUpdatedCell({ project }: LastUpdatedCellProps) {
  const lastUpdatedDate = fromNowDate(project.lastUpdated)

  const tooltipText = formatDate(project.lastUpdated)
  return (
    <OLTooltip
      key={`tooltip-last-updated-${project.id}`}
      id={`tooltip-last-updated-${project.id}`}
      description={tooltipText}
      overlayProps={{ placement: 'top', trigger: ['hover', 'focus'] }}
    >
      {project.lastUpdatedBy ? (
        <span translate="no">
          <LastUpdatedBy
            lastUpdatedBy={project.lastUpdatedBy}
            lastUpdatedDate={lastUpdatedDate}
          />
        </span>
      ) : (
        <span>{lastUpdatedDate}</span>
      )}
    </OLTooltip>
  )
}
