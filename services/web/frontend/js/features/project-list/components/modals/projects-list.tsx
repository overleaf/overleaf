import classnames from 'classnames'
import { Project } from '../../../../../../types/project/dashboard/api'

type ProjectsToDisplayProps = {
  projects: Project[]
  projectsToDisplay: Project[]
}

function ProjectsList({ projects, projectsToDisplay }: ProjectsToDisplayProps) {
  return (
    <ul>
      {projectsToDisplay.map(project => (
        <li
          key={`projects-action-list-${project.id}`}
          className={classnames({
            'list-style-check-green': !projects.some(
              ({ id }) => id === project.id
            ),
          })}
        >
          <b>{project.name}</b>
        </li>
      ))}
    </ul>
  )
}

export default ProjectsList
