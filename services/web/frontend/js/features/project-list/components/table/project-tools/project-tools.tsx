import { memo } from 'react'
import { ButtonGroup, ButtonToolbar } from 'react-bootstrap'
import { useProjectListContext } from '../../../context/project-list-context'
import ArchiveProjectsButton from './buttons/archive-projects-button'
import DownloadProjectsButton from './buttons/download-projects-button'
import ProjectToolsMoreDropdownButton from './buttons/project-tools-more-dropdown-button'
import TagsDropdown from './buttons/tags-dropdown'
import TrashProjectsButton from './buttons/trash-projects-button'
import UnarchiveProjectsButton from './buttons/unarchive-projects-button'
import UntrashProjectsButton from './buttons/untrash-projects-button'

function ProjectTools() {
  const { filter, selectedProjects } = useProjectListContext()
  return (
    <ButtonToolbar>
      <ButtonGroup>
        <DownloadProjectsButton />
        {filter !== 'archived' && <ArchiveProjectsButton />}
        {filter !== 'trashed' && <TrashProjectsButton />}
      </ButtonGroup>

      <ButtonGroup>
        {filter === 'trashed' && <UntrashProjectsButton />}
        {filter === 'archived' && <UnarchiveProjectsButton />}
      </ButtonGroup>

      {!['archived', 'trashed'].includes(filter) && <TagsDropdown />}

      {selectedProjects.length === 1 &&
        filter !== 'archived' &&
        filter !== 'trashed' && <ProjectToolsMoreDropdownButton />}
    </ButtonToolbar>
  )
}

export default memo(ProjectTools)
