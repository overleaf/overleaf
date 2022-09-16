import { useTranslation } from 'react-i18next'
import { Project } from '../../../../../../types/project/dashboard/api'
import InlineTags from './cells/inline-tags'
import OwnerCell from './cells/owner-cell'
import LastUpdatedCell from './cells/last-updated-cell'
import ActionsCell from './cells/actions-cell'
import { useProjectListContext } from '../../context/project-list-context'
import { useCallback } from 'react'

type ProjectListTableRowProps = {
  project: Project
}
export default function ProjectListTableRow({
  project,
}: ProjectListTableRowProps) {
  const { t } = useTranslation()
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
      <td className="dash-cell-checkbox">
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
        <InlineTags projectId={project.id} />
      </td>
      <td className="dash-cell-owner">
        <OwnerCell project={project} />
      </td>
      <td className="dash-cell-date">
        <LastUpdatedCell project={project} />
      </td>
      <td className="dash-cell-actions">
        <ActionsCell project={project} />
      </td>
    </tr>
  )
}
