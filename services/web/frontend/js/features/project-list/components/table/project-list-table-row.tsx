import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import InlineTags from './cells/inline-tags'
import OwnerCell from './cells/owner-cell'
import LastUpdatedCell from './cells/last-updated-cell'
import ActionsCell from './cells/actions-cell'
import ActionsDropdown from '../dropdown/actions-dropdown'
import { getOwnerName } from '../../util/project'
import { Project } from '../../../../../../types/project/dashboard/api'
import { ProjectCheckbox } from './project-checkbox'

type ProjectListTableRowProps = {
  project: Project
}
function ProjectListTableRow({ project }: ProjectListTableRowProps) {
  const { t } = useTranslation()
  const ownerName = getOwnerName(project)

  return (
    <tr>
      <td className="dash-cell-checkbox hidden-xs">
        <ProjectCheckbox projectId={project.id} />
        <label htmlFor={`select-project-${project.id}`} className="sr-only">
          {t('select_project', { project: project.name })}
        </label>
      </td>
      <td className="dash-cell-name">
        <a href={`/project/${project.id}`}>{project.name}</a>{' '}
        <InlineTags className="hidden-xs" projectId={project.id} />
      </td>
      <td className="dash-cell-date-owner visible-xs pb-0">
        <LastUpdatedCell project={project} />
        {ownerName ? <> — {t('owned_by_x', { x: ownerName })}</> : null}
      </td>
      <td className="dash-cell-owner hidden-xs">
        <OwnerCell project={project} />
      </td>
      <td className="dash-cell-date hidden-xs">
        <LastUpdatedCell project={project} />
      </td>
      <td className="dash-cell-tag visible-xs pt-0">
        <InlineTags projectId={project.id} />
      </td>
      <td className="dash-cell-actions">
        <div className="hidden-xs">
          <ActionsCell project={project} />
        </div>
        <div className="visible-xs">
          <ActionsDropdown project={project} />
        </div>
      </td>
    </tr>
  )
}
export default memo(ProjectListTableRow)
