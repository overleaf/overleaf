import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  ControlLabel,
  FormControl,
  FormGroup,
  Modal,
} from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import AccessibleModal from '../../../../shared/components/accessible-modal'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import { Project } from '../../../../../../types/project/dashboard/api'
import { renameProject } from '../../util/api'
import useAsync from '../../../../shared/hooks/use-async'
import { useProjectListContext } from '../../context/project-list-context'
import { getUserFacingMessage } from '../../../../infrastructure/fetch-json'
import { debugConsole } from '@/utils/debugging'
import { isSmallDevice } from '../../../../infrastructure/event-tracking'
import Notification from '@/shared/components/notification'
import getMeta from '@/utils/meta'

type RenameProjectModalProps = {
  handleCloseModal: () => void
  project: Project
  showModal: boolean
}

function RenameProjectModal({
  handleCloseModal,
  showModal,
  project,
}: RenameProjectModalProps) {
  const { t } = useTranslation()
  const [newProjectName, setNewProjectName] = useState(project.name)
  const { error, isError, isLoading, runAsync } = useAsync()
  const { toggleSelectedProject, updateProjectViewData } =
    useProjectListContext()
  const newNotificationStyle = getMeta(
    'ol-newNotificationStyle',
    false
  ) as boolean

  useEffect(() => {
    if (showModal) {
      eventTracking.sendMB('project-list-page-interaction', {
        action: 'rename',
        projectId: project.id,
        isSmallDevice,
      })
    }
  }, [showModal, project.id])

  const isValid = useMemo(
    () => newProjectName !== project.name && newProjectName.trim().length > 0,
    [newProjectName, project]
  )

  const handleSubmit = useCallback(
    event => {
      event.preventDefault()

      if (!isValid) return

      runAsync(renameProject(project.id, newProjectName))
        .then(() => {
          toggleSelectedProject(project.id, false)
          updateProjectViewData({
            ...project,
            name: newProjectName,
          })
          handleCloseModal()
        })
        .catch(debugConsole.error)
    },
    [
      handleCloseModal,
      isValid,
      newProjectName,
      project,
      runAsync,
      toggleSelectedProject,
      updateProjectViewData,
    ]
  )

  const handleOnChange = (
    event: React.ChangeEvent<HTMLFormElement & FormControl>
  ) => {
    setNewProjectName(event.target.value)
  }

  return (
    <AccessibleModal
      animation
      show={showModal}
      onHide={handleCloseModal}
      id="rename-project-modal"
      backdrop="static"
    >
      <Modal.Header closeButton>
        <Modal.Title>{t('rename_project')}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {isError &&
          (newNotificationStyle ? (
            <div className="notification-list">
              <Notification
                type="error"
                content={getUserFacingMessage(error) as string}
              />
            </div>
          ) : (
            <Alert bsStyle="danger" className="text-center" aria-live="polite">
              {getUserFacingMessage(error)}
            </Alert>
          ))}
        <form id="rename-project-form" onSubmit={handleSubmit}>
          <FormGroup>
            <ControlLabel htmlFor="rename-project-form-name">
              {t('new_name')}
            </ControlLabel>

            <FormControl
              id="rename-project-form-name"
              type="text"
              placeholder={t('project_name')}
              required
              value={newProjectName}
              onChange={handleOnChange}
            />
          </FormGroup>
        </form>
      </Modal.Body>
      <Modal.Footer>
        <Button
          bsStyle={null}
          className="btn-secondary"
          onClick={handleCloseModal}
        >
          {t('cancel')}
        </Button>
        <Button
          form="rename-project-form"
          bsStyle="primary"
          disabled={isLoading || !isValid}
          type="submit"
        >
          {t('rename')}
        </Button>
      </Modal.Footer>
    </AccessibleModal>
  )
}

export default memo(RenameProjectModal)
