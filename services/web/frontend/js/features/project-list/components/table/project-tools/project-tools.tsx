import { memo } from 'react'
import { useProjectListContext } from '../../../context/project-list-context'
import ArchiveProjectsButton from './buttons/archive-projects-button'
import DownloadProjectsButton from './buttons/download-projects-button'
import TrashProjectsButton from './buttons/trash-projects-button'

function ProjectTools() {
  const { filter } = useProjectListContext()
  return (
    <div className="btn-toolbar" role="toolbar">
      <div className="btn-group">
        <DownloadProjectsButton />
        {filter !== 'archived' && <ArchiveProjectsButton />}
        {filter !== 'trashed' && <TrashProjectsButton />}
      </div>
    </div>
  )
}

export default memo(ProjectTools)
