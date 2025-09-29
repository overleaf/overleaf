import {
  FormEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import { Project } from '../../../../../../types/project/dashboard/api'
import { renameProject } from '../../util/api'
import useAsync from '../../../../shared/hooks/use-async'
import { useProjectListContext } from '../../context/project-list-context'
import { getUserFacingMessage } from '../../../../infrastructure/fetch-json'
import { debugConsole } from '@/utils/debugging'
import { isSmallDevice } from '../../../../infrastructure/event-tracking'
import Notification from '@/shared/components/notification'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import OLForm from '@/shared/components/ol/ol-form'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import OLFormControl from '@/shared/components/ol/ol-form-control'

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

  useEffect(() => {
    setNewProjectName(project.name)
  }, [project.name])

  const handleSubmit = useCallback(
    (event: FormEvent) => {
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

  const handleOnChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNewProjectName(event.target.value)
  }

  return (
    <OLModal
      animation
      show={showModal}
      onHide={handleCloseModal}
      id="rename-project-modal"
      backdrop="static"
    >
      <OLModalHeader>
        <OLModalTitle>{t('rename_project')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        {isError && (
          <div className="notification-list">
            <Notification
              type="error"
              content={getUserFacingMessage(error) as string}
            />
          </div>
        )}
        <OLForm id="rename-project-form" onSubmit={handleSubmit}>
          <OLFormGroup controlId="rename-project-form-name">
            <OLFormLabel>{t('new_name')}</OLFormLabel>
            <OLFormControl
              type="text"
              required
              value={newProjectName}
              onChange={handleOnChange}
            />
          </OLFormGroup>
        </OLForm>
      </OLModalBody>
      <OLModalFooter>
        <OLButton variant="secondary" onClick={handleCloseModal}>
          {t('cancel')}
        </OLButton>
        <OLButton
          variant="primary"
          type="submit"
          form="rename-project-form"
          disabled={isLoading || !isValid}
        >
          {t('rename')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}

export default memo(RenameProjectModal)
