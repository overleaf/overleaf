import { Project } from '../../../../../../../types/project/dashboard/api'
import { CopyProjectButtonTooltip } from './action-buttons/copy-project-button'
import { UnarchiveProjectButtonTooltip } from './action-buttons/unarchive-project-button'
import { UntrashProjectButtonTooltip } from './action-buttons/untrash-project-button'
import { DownloadProjectButtonTooltip } from './action-buttons/download-project-button'
import { LeaveProjectButtonTooltip } from './action-buttons/leave-project-button'
import { DeleteProjectButtonTooltip } from './action-buttons/delete-project-button'
import { CompileAndDownloadProjectPDFButtonTooltip } from './action-buttons/compile-and-download-project-pdf-button'
import ActionsDropdown from '../../dropdown/actions-dropdown'
import { ShareProjectButtonTooltip } from '../../sharing/share-project-modal-button'

type ActionsCellProps = {
  project: Project
}

export default function ActionsCell({ project }: ActionsCellProps) {
  if (project.archived || project.trashed) {
    return (
      <>
        <DownloadProjectButtonTooltip project={project} />
        <UnarchiveProjectButtonTooltip project={project} />
        <UntrashProjectButtonTooltip project={project} />
        <LeaveProjectButtonTooltip project={project} />
        <DeleteProjectButtonTooltip project={project} />
      </>
    )
  }

  return (
    <>
      <ShareProjectButtonTooltip project={project} />
      <CopyProjectButtonTooltip project={project} />
      <DownloadProjectButtonTooltip project={project} />
      <CompileAndDownloadProjectPDFButtonTooltip project={project} />
      <div className="d-inline-block">
        <ActionsDropdown project={project} compact />
      </div>
    </>
  )
}
