import { Filter, useProjectListContext } from '../context/project-list-context'
import { ActivePage } from '../util/navigation-state'

type ProjectsMenuFilterType = {
  children: (isActive: boolean) => React.ReactElement
  filter: Filter
  activePage: ActivePage
}

function ProjectsFilterMenu({
  children,
  filter,
  activePage,
}: ProjectsMenuFilterType) {
  const { filter: activeFilter, selectedTagId } = useProjectListContext()
  const isActive =
    selectedTagId === undefined &&
    filter === activeFilter &&
    activePage === 'projects'

  return children(isActive)
}

export default ProjectsFilterMenu
