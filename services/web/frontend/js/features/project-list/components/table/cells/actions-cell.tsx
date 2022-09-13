import { Project } from '../../../../../../../types/project/dashboard/api'
import CopyProjectButton from './action-buttons/copy-project-button'
import ArchiveProjectButton from './action-buttons/archive-project-button'
import TrashProjectButton from './action-buttons/trash-project-button'
import UnarchiveProjectButton from './action-buttons/unarchive-project-button'
import UntrashProjectButton from './action-buttons/untrash-project-button'
import DownloadProjectButton from './action-buttons/download-project-button'
import LeaveProjectButton from './action-buttons/leave-project-buttton'
import DeleteProjectButton from './action-buttons/delete-project-button'

type ActionsCellProps = {
  project: Project
}
export default function ActionsCell({ project }: ActionsCellProps) {
  return (
    <>
      <CopyProjectButton project={project} />
      <DownloadProjectButton project={project} />
      <ArchiveProjectButton project={project} />
      <TrashProjectButton project={project} />
      <UnarchiveProjectButton project={project} />
      <UntrashProjectButton project={project} />
      <LeaveProjectButton project={project} />
      <DeleteProjectButton project={project} />
    </>
  )
}
