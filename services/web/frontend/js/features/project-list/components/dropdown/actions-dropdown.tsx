import { useTranslation } from 'react-i18next'
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from '@/shared/components/dropdown/dropdown-menu'
import CopyProjectButton from '../table/cells/action-buttons/copy-project-button'
import DownloadProjectButton from '../table/cells/action-buttons/download-project-button'
import ArchiveProjectButton from '../table/cells/action-buttons/archive-project-button'
import TrashProjectButton from '../table/cells/action-buttons/trash-project-button'
import UnarchiveProjectButton from '../table/cells/action-buttons/unarchive-project-button'
import UntrashProjectButton from '../table/cells/action-buttons/untrash-project-button'
import LeaveProjectButton from '../table/cells/action-buttons/leave-project-button'
import DeleteProjectButton from '../table/cells/action-buttons/delete-project-button'
import { Project } from '../../../../../../types/project/dashboard/api'
import CompileAndDownloadProjectPDFButton from '../table/cells/action-buttons/compile-and-download-project-pdf-button'
import RenameProjectButton from '../table/cells/action-buttons/rename-project-button'
import MaterialIcon from '@/shared/components/material-icon'
import OLSpinner from '@/shared/components/ol/ol-spinner'

type ActionDropdownProps = {
  project: Project
}

function ActionsDropdown({ project }: ActionDropdownProps) {
  const { t } = useTranslation()

  return (
    <Dropdown align="end">
      <DropdownToggle
        id={`project-actions-dropdown-toggle-btn-${project.id}`}
        bsPrefix="dropdown-table-button-toggle"
      >
        <MaterialIcon type="more_vert" accessibilityLabel={t('actions')} />
      </DropdownToggle>
      <DropdownMenu flip={false}>
        <RenameProjectButton project={project}>
          {(text, handleOpenModal) => (
            <li role="none">
              <DropdownItem
                as="button"
                tabIndex={-1}
                onClick={handleOpenModal}
                leadingIcon="edit"
              >
                {text}
              </DropdownItem>
            </li>
          )}
        </RenameProjectButton>
        <CopyProjectButton project={project}>
          {(text, handleOpenModal) => (
            <li role="none">
              <DropdownItem
                as="button"
                tabIndex={-1}
                onClick={handleOpenModal}
                leadingIcon="file_copy"
              >
                {text}
              </DropdownItem>
            </li>
          )}
        </CopyProjectButton>
        <DownloadProjectButton project={project}>
          {(text, downloadProject) => (
            <li role="none">
              <DropdownItem
                as="button"
                tabIndex={-1}
                onClick={downloadProject}
                leadingIcon="download"
              >
                {text}
              </DropdownItem>
            </li>
          )}
        </DownloadProjectButton>
        <CompileAndDownloadProjectPDFButton project={project}>
          {(text, pendingCompile, downloadProject) => (
            <li role="none">
              <DropdownItem
                as="button"
                tabIndex={-1}
                onClick={e => {
                  e.stopPropagation()
                  downloadProject()
                }}
                leadingIcon={
                  pendingCompile ? (
                    <OLSpinner
                      size="sm"
                      className="dropdown-item-leading-icon spinner"
                    />
                  ) : (
                    'picture_as_pdf'
                  )
                }
              >
                {text}
              </DropdownItem>
            </li>
          )}
        </CompileAndDownloadProjectPDFButton>
        <ArchiveProjectButton project={project}>
          {(text, handleOpenModal) => (
            <li role="none">
              <DropdownItem
                as="button"
                tabIndex={-1}
                onClick={handleOpenModal}
                leadingIcon="inbox"
              >
                {text}
              </DropdownItem>
            </li>
          )}
        </ArchiveProjectButton>
        <TrashProjectButton project={project}>
          {(text, handleOpenModal) => (
            <li role="none">
              <DropdownItem
                as="button"
                tabIndex={-1}
                onClick={handleOpenModal}
                leadingIcon="delete"
              >
                {text}
              </DropdownItem>
            </li>
          )}
        </TrashProjectButton>
        <UnarchiveProjectButton project={project}>
          {(text, unarchiveProject) => (
            <li role="none">
              <DropdownItem
                as="button"
                tabIndex={-1}
                onClick={unarchiveProject}
                leadingIcon="restore_page"
              >
                {text}
              </DropdownItem>
            </li>
          )}
        </UnarchiveProjectButton>
        <UntrashProjectButton project={project}>
          {(text, untrashProject) => (
            <li role="none">
              <DropdownItem
                as="button"
                tabIndex={-1}
                onClick={untrashProject}
                leadingIcon="restore_page"
              >
                {text}
              </DropdownItem>
            </li>
          )}
        </UntrashProjectButton>
        <LeaveProjectButton project={project}>
          {text => (
            <li role="none">
              <DropdownItem as="button" tabIndex={-1} leadingIcon="logout">
                {text}
              </DropdownItem>
            </li>
          )}
        </LeaveProjectButton>
        <DeleteProjectButton project={project}>
          {text => (
            <li role="none">
              <DropdownItem as="button" tabIndex={-1} leadingIcon="block">
                {text}
              </DropdownItem>
            </li>
          )}
        </DeleteProjectButton>
      </DropdownMenu>
    </Dropdown>
  )
}

export default ActionsDropdown
