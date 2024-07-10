import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Dropdown as BS3Dropdown } from 'react-bootstrap'
import { Spinner } from 'react-bootstrap-5'
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import MenuItemButton from './menu-item-button'
import Icon from '../../../../shared/components/icon'
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
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

type ActionButtonProps = {
  project: Project
  onClick: <T extends React.MouseEvent>(e?: T, fn?: (e?: T) => void) => void
}

function CopyProjectButtonMenuItem({ project, onClick }: ActionButtonProps) {
  return (
    <CopyProjectButton project={project}>
      {(text, handleOpenModal) => (
        <MenuItemButton
          onClick={e => handleOpenModal(e, onClick)}
          className="projects-action-menu-item"
        >
          <Icon type="files-o" className="menu-item-button-icon" />{' '}
          <span className="menu-item-button-text">{text}</span>
        </MenuItemButton>
      )}
    </CopyProjectButton>
  )
}

function CompileAndDownloadProjectPDFButtonMenuItem({
  project,
  onClick,
}: ActionButtonProps) {
  return (
    <CompileAndDownloadProjectPDFButton project={project}>
      {(text, pendingCompile, downloadProject) => (
        <MenuItemButton
          onClick={e => downloadProject(e, onClick)}
          className="projects-action-menu-item"
        >
          {pendingCompile ? (
            <Icon type="spinner" spin className="menu-item-button-icon" />
          ) : (
            <Icon type="file-pdf-o" className="menu-item-button-icon" />
          )}{' '}
          <span className="menu-item-button-text">{text}</span>
        </MenuItemButton>
      )}
    </CompileAndDownloadProjectPDFButton>
  )
}

function DownloadProjectButtonMenuItem({
  project,
  onClick,
}: ActionButtonProps) {
  const handleClick = (downloadProject: () => void) => {
    downloadProject()
    onClick()
  }

  return (
    <DownloadProjectButton project={project}>
      {(text, downloadProject) => (
        <MenuItemButton
          onClick={() => handleClick(downloadProject)}
          className="projects-action-menu-item"
        >
          <Icon type="cloud-download" className="menu-item-button-icon" />{' '}
          <span className="menu-item-button-text">{text}</span>
        </MenuItemButton>
      )}
    </DownloadProjectButton>
  )
}

function ArchiveProjectButtonMenuItem({ project, onClick }: ActionButtonProps) {
  const handleClick = (handleOpenModal: () => void) => {
    handleOpenModal()
    onClick()
  }

  return (
    <ArchiveProjectButton project={project}>
      {(text, handleOpenModal) => (
        <MenuItemButton
          onClick={() => handleClick(handleOpenModal)}
          className="projects-action-menu-item"
        >
          <Icon type="inbox" className="menu-item-button-icon" />{' '}
          <span className="menu-item-button-text">{text}</span>
        </MenuItemButton>
      )}
    </ArchiveProjectButton>
  )
}

function TrashProjectButtonMenuItem({ project, onClick }: ActionButtonProps) {
  const handleClick = (handleOpenModal: () => void) => {
    handleOpenModal()
    onClick()
  }

  return (
    <TrashProjectButton project={project}>
      {(text, handleOpenModal) => (
        <MenuItemButton
          onClick={() => handleClick(handleOpenModal)}
          className="projects-action-menu-item"
        >
          <Icon type="trash" className="menu-item-button-icon" />{' '}
          <span className="menu-item-button-text">{text}</span>
        </MenuItemButton>
      )}
    </TrashProjectButton>
  )
}

function UnarchiveProjectButtonMenuItem({
  project,
  onClick,
}: ActionButtonProps) {
  const handleClick = (unarchiveProject: () => Promise<void>) => {
    unarchiveProject()
    onClick()
  }

  return (
    <UnarchiveProjectButton project={project}>
      {(text, unarchiveProject) => (
        <MenuItemButton
          onClick={() => handleClick(unarchiveProject)}
          className="projects-action-menu-item"
        >
          <Icon type="reply" className="menu-item-button-icon" />{' '}
          <span className="menu-item-button-text">{text}</span>
        </MenuItemButton>
      )}
    </UnarchiveProjectButton>
  )
}

function UntrashProjectButtonMenuItem({ project, onClick }: ActionButtonProps) {
  const handleClick = (untrashProject: () => Promise<void>) => {
    untrashProject()
    onClick()
  }

  return (
    <UntrashProjectButton project={project}>
      {(text, untrashProject) => (
        <MenuItemButton
          onClick={() => handleClick(untrashProject)}
          className="projects-action-menu-item"
        >
          <Icon type="reply" className="menu-item-button-icon" />{' '}
          <span className="menu-item-button-text">{text}</span>
        </MenuItemButton>
      )}
    </UntrashProjectButton>
  )
}

function LeaveProjectButtonMenuItem({ project, onClick }: ActionButtonProps) {
  return (
    <LeaveProjectButton project={project}>
      {text => (
        <MenuItemButton onClick={onClick} className="projects-action-menu-item">
          <Icon type="sign-out" className="menu-item-button-icon" />{' '}
          <span className="menu-item-button-text">{text}</span>
        </MenuItemButton>
      )}
    </LeaveProjectButton>
  )
}

function DeleteProjectButtonMenuItem({ project, onClick }: ActionButtonProps) {
  return (
    <DeleteProjectButton project={project}>
      {text => (
        <MenuItemButton onClick={onClick} className="projects-action-menu-item">
          <Icon type="ban" className="menu-item-button-icon" />{' '}
          <span className="menu-item-button-text">{text}</span>
        </MenuItemButton>
      )}
    </DeleteProjectButton>
  )
}

function RenameProjectButtonMenuItem({ project, onClick }: ActionButtonProps) {
  const handleClick = (handleOpenModal: () => void) => {
    handleOpenModal()
    onClick()
  }
  return (
    <RenameProjectButton project={project}>
      {(text, handleOpenModal) => (
        <MenuItemButton
          onClick={() => handleClick(handleOpenModal)}
          className="projects-action-menu-item"
        >
          <Icon type="pencil" className="menu-item-button-icon" />{' '}
          <span className="menu-item-button-text">{text}</span>
        </MenuItemButton>
      )}
    </RenameProjectButton>
  )
}

type ActionDropdownProps = {
  project: Project
}

export function BS3ActionsDropdown({ project }: ActionDropdownProps) {
  const [isOpened, setIsOpened] = useState(false)

  const handleClose = useCallback(() => {
    setIsOpened(false)
  }, [setIsOpened])

  return (
    <BS3Dropdown
      id={`project-actions-dropdown-${project.id}`}
      pullRight
      open={isOpened}
      onToggle={open => setIsOpened(open)}
    >
      <BS3Dropdown.Toggle noCaret className="btn-transparent">
        <Icon type="ellipsis-h" fw />
      </BS3Dropdown.Toggle>
      <BS3Dropdown.Menu className="projects-dropdown-menu text-left">
        <RenameProjectButtonMenuItem project={project} onClick={handleClose} />
        <CopyProjectButtonMenuItem project={project} onClick={handleClose} />
        <DownloadProjectButtonMenuItem
          project={project}
          onClick={handleClose}
        />
        <CompileAndDownloadProjectPDFButtonMenuItem
          project={project}
          onClick={handleClose}
        />
        <ArchiveProjectButtonMenuItem project={project} onClick={handleClose} />
        <TrashProjectButtonMenuItem project={project} onClick={handleClose} />
        <UnarchiveProjectButtonMenuItem
          project={project}
          onClick={handleClose}
        />
        <UntrashProjectButtonMenuItem project={project} onClick={handleClose} />
        <LeaveProjectButtonMenuItem project={project} onClick={handleClose} />
        <DeleteProjectButtonMenuItem project={project} onClick={handleClose} />
      </BS3Dropdown.Menu>
    </BS3Dropdown>
  )
}

function BS5ActionsDropdown({ project }: ActionDropdownProps) {
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
                leadingIcon="cloud_download"
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
                    <Spinner
                      animation="border"
                      aria-hidden="true"
                      as="span"
                      className="dropdown-item-leading-icon spinner"
                      size="sm"
                      role="status"
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

function ActionsDropdown({ project }: ActionDropdownProps) {
  return (
    <BootstrapVersionSwitcher
      bs3={<BS3ActionsDropdown project={project} />}
      bs5={<BS5ActionsDropdown project={project} />}
    />
  )
}

export default ActionsDropdown
