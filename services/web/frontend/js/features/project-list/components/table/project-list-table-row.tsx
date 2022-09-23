import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import InlineTags from './cells/inline-tags'
import OwnerCell from './cells/owner-cell'
import LastUpdatedCell from './cells/last-updated-cell'
import ActionsCell from './cells/actions-cell'
import ActionsDropdown from '../dropdown/actions-dropdown'
import { useProjectListContext } from '../../context/project-list-context'
import { getOwnerName } from '../../util/project'
import { Project } from '../../../../../../types/project/dashboard/api'

type ProjectListTableRowProps = {
  project: Project
}
export default function ProjectListTableRow({
  project,
}: ProjectListTableRowProps) {
  const { t } = useTranslation()
  const ownerName = getOwnerName(project)
  const { selectedProjects, setSelectedProjects } = useProjectListContext()

  const handleCheckboxChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const checked = event.target.checked
      setSelectedProjects(selectedProjects => {
        let projects = [...selectedProjects]
        if (checked) {
          projects.push(project)
        } else {
          const projectId = event.target.getAttribute('data-project-id')
          projects = projects.filter(p => p.id !== projectId)
        }
        return projects
      })
    },
    [project, setSelectedProjects]
  )

  return (
    <tr>
      <td className="dash-cell-checkbox hidden-xs">
        <input
          type="checkbox"
          id={`select-project-${project.id}`}
          checked={selectedProjects.includes(project)}
          onChange={handleCheckboxChange}
          data-project-id={project.id}
        />
        <label
          htmlFor={`select-project-${project.id}`}
          aria-label={t('select_project', { project: project.name })}
          className="sr-only"
        />
      </td>
      <td className="dash-cell-name">
        <a href={`/project/${project.id}`}>{project.name}</a>{' '}
        <InlineTags className="hidden-xs" projectId={project.id} />
      </td>
      <td className="dash-cell-date-owner visible-xs pb-0">
        <LastUpdatedCell project={project} />{' '}
        {ownerName ? (
          <>
            — <span className="text-lowercase">{t('owned_by')}</span>{' '}
            {ownerName}
          </>
        ) : null}
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
