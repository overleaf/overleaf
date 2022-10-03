import { memo } from 'react'
import { ButtonGroup, ButtonToolbar } from 'react-bootstrap'
import { useProjectListContext } from '../../../context/project-list-context'
import ArchiveProjectsButton from './buttons/archive-projects-button'
import DownloadProjectsButton from './buttons/download-projects-button'
import TrashProjectsButton from './buttons/trash-projects-button'
import UnarchiveProjectsButton from './buttons/unarchive-projects-button'
import UntrashProjectsButton from './buttons/untrash-projects-button'

function ProjectTools() {
  const { filter } = useProjectListContext()
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
    </ButtonToolbar>
  )
}

export default memo(ProjectTools)
