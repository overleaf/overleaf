import { useState, useCallback } from 'react'
import { Dropdown } from 'react-bootstrap'
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

type ActionButtonProps = {
  project: Project
  onClick: () => void // eslint-disable-line react/no-unused-prop-types
}

function CopyProjectButtonMenuItem({ project, onClick }: ActionButtonProps) {
  return (
    <CopyProjectButton project={project}>
      {text => (
        <MenuItemButton onClick={onClick} className="projects-action-menu-item">
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
          onClick={() => downloadProject(onClick)}
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

type ActionDropdownProps = {
  project: Project
}

function ActionsDropdown({ project }: ActionDropdownProps) {
  const [isOpened, setIsOpened] = useState(false)

  const handleClose = useCallback(() => {
    setIsOpened(false)
  }, [setIsOpened])

  return (
    <Dropdown
      id={`project-actions-dropdown-${project.id}`}
      pullRight
      open={isOpened}
      onToggle={open => setIsOpened(open)}
    >
      <Dropdown.Toggle noCaret className="btn-transparent">
        <Icon type="ellipsis-h" fw />
      </Dropdown.Toggle>
      <Dropdown.Menu className="projects-dropdown-menu text-left">
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
      </Dropdown.Menu>
    </Dropdown>
  )
}

export default ActionsDropdown
