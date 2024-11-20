import { memo } from 'react'
import InlineTags from './cells/inline-tags'
import OwnerCell from './cells/owner-cell'
import LastUpdatedCell from './cells/last-updated-cell'
import ActionsCell from './cells/actions-cell'
import ActionsDropdown from '../dropdown/actions-dropdown'
import { getOwnerName } from '../../util/project'
import { Project } from '../../../../../../types/project/dashboard/api'
import { ProjectCheckbox } from './project-checkbox'
import { ProjectListOwnerName } from '@/features/project-list/components/table/project-list-owner-name'

type ProjectListTableRowProps = {
  project: Project
  selected: boolean
}
function ProjectListTableRow({ project, selected }: ProjectListTableRowProps) {
  const ownerName = getOwnerName(project)

  return (
    <tr className={selected ? 'table-active' : undefined}>
      <td className="dash-cell-checkbox d-none d-md-table-cell">
        <ProjectCheckbox projectId={project.id} projectName={project.name} />
      </td>
      <td className="dash-cell-name">
        <a href={`/project/${project.id}`}>{project.name}</a>{' '}
        <InlineTags className="d-none d-md-inline" projectId={project.id} />
      </td>
      <td className="dash-cell-date-owner pb-0 d-md-none">
        <LastUpdatedCell project={project} />
        {ownerName ? <ProjectListOwnerName ownerName={ownerName} /> : null}
      </td>
      <td className="dash-cell-owner d-none d-md-table-cell">
        <OwnerCell project={project} />
      </td>
      <td className="dash-cell-date d-none d-md-table-cell">
        <LastUpdatedCell project={project} />
      </td>
      <td className="dash-cell-tag pt-0 d-md-none">
        <InlineTags projectId={project.id} />
      </td>
      <td className="dash-cell-actions">
        <div className="d-none d-md-block">
          <ActionsCell project={project} />
        </div>
        <div className="d-md-none">
          <ActionsDropdown project={project} />
        </div>
      </td>
    </tr>
  )
}
export default memo(ProjectListTableRow)
