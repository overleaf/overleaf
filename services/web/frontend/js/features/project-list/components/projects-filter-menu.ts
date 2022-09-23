import { Filter, useProjectListContext } from '../context/project-list-context'

type ProjectsMenuFilterType = {
  children: (isActive: boolean) => React.ReactElement
  filter: Filter
}

function ProjectsFilterMenu({ children, filter }: ProjectsMenuFilterType) {
  const { filter: activeFilter, selectedTagId } = useProjectListContext()
  const isActive = selectedTagId === undefined && filter === activeFilter

  return children(isActive)
}

export default ProjectsFilterMenu
