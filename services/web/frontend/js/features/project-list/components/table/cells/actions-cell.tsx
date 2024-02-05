import { Project } from '../../../../../../../types/project/dashboard/api'
import { CopyProjectButtonTooltip } from './action-buttons/copy-project-button'
import { ArchiveProjectButtonTooltip } from './action-buttons/archive-project-button'
import { TrashProjectButtonTooltip } from './action-buttons/trash-project-button'
import { UnarchiveProjectButtonTooltip } from './action-buttons/unarchive-project-button'
import { UntrashProjectButtonTooltip } from './action-buttons/untrash-project-button'
import { DownloadProjectButtonTooltip } from './action-buttons/download-project-button'
import { LeaveProjectButtonTooltip } from './action-buttons/leave-project-button'
import { DeleteProjectButtonTooltip } from './action-buttons/delete-project-button'
import { CompileAndDownloadProjectPDFButtonTooltip } from './action-buttons/compile-and-download-project-pdf-button'

type ActionsCellProps = {
  project: Project
}

export default function ActionsCell({ project }: ActionsCellProps) {
  return (
    <>
      <CopyProjectButtonTooltip project={project} />
      <DownloadProjectButtonTooltip project={project} />
      <CompileAndDownloadProjectPDFButtonTooltip project={project} />
      <ArchiveProjectButtonTooltip project={project} />
      <TrashProjectButtonTooltip project={project} />
      <UnarchiveProjectButtonTooltip project={project} />
      <UntrashProjectButtonTooltip project={project} />
      <LeaveProjectButtonTooltip project={project} />
      <DeleteProjectButtonTooltip project={project} />
    </>
  )
}
