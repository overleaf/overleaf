import { memo, useEffect, useState } from 'react'
import { Alert, Modal } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { Project } from '../../../../../../types/project/dashboard/api'
import AccessibleModal from '../../../../shared/components/accessible-modal'
import { getUserFacingMessage } from '../../../../infrastructure/fetch-json'
import useIsMounted from '../../../../shared/hooks/use-is-mounted'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import { isSmallDevice } from '../../../../infrastructure/event-tracking'
import getMeta from '@/utils/meta'
import Notification from '@/shared/components/notification'

type ProjectsActionModalProps = {
  title?: string
  action: 'archive' | 'trash' | 'delete' | 'leave' | 'leaveOrDelete'
  actionHandler: (project: Project) => Promise<void>
  handleCloseModal: () => void
  projects: Array<Project>
  showModal: boolean
  children?: React.ReactNode
}

function ProjectsActionModal({
  title,
  action,
  actionHandler,
  handleCloseModal,
  showModal,
  projects,
  children,
}: ProjectsActionModalProps) {
  const { t } = useTranslation()
  const [errors, setErrors] = useState<Array<any>>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const isMounted = useIsMounted()

  async function handleActionForProjects(projects: Array<Project>) {
    const errored = []
    setIsProcessing(true)
    setErrors([])

    for (const project of projects) {
      try {
        await actionHandler(project)
      } catch (e) {
        errored.push({ projectName: project.name, error: e })
      }
    }

    if (isMounted.current) {
      setIsProcessing(false)
    }

    if (errored.length === 0) {
      handleCloseModal()
    } else {
      setErrors(errored)
    }
  }

  useEffect(() => {
    if (showModal) {
      eventTracking.sendMB('project-list-page-interaction', {
        action,
        isSmallDevice,
      })
    }
  }, [action, showModal])

  return (
    <AccessibleModal
      animation
      show={showModal}
      onHide={handleCloseModal}
      id="action-project-modal"
      backdrop="static"
    >
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{children}</Modal.Body>
      <Modal.Footer>
        {!isProcessing &&
          errors.length > 0 &&
          errors.map((e, i) => <ErrorNotification error={e} key={i} />)}
        <button className="btn btn-secondary" onClick={handleCloseModal}>
          {t('cancel')}
        </button>
        <button
          className="btn btn-danger"
          onClick={() => handleActionForProjects(projects)}
          disabled={isProcessing}
        >
          {t('confirm')}
        </button>
      </Modal.Footer>
    </AccessibleModal>
  )
}

type ErrorNotificationProps = {
  error: any
}

function ErrorNotification({ error }: ErrorNotificationProps) {
  const newNotificationStyle = getMeta(
    'ol-newNotificationStyle',
    false
  ) as boolean

  if (newNotificationStyle) {
    return (
      // `notification-list` sets the margin-bottom correctly also when used individually in each notification.
      // Once the legacy alerts are cleaned up we should move the styled div up to the notification list container.
      <div className="notification-list">
        <Notification
          type="error"
          title={error.projectName}
          content={getUserFacingMessage(error.error) as string}
        />
      </div>
    )
  } else {
    return (
      <Alert bsStyle="danger" className="text-center" aria-live="polite">
        <b>{error.projectName}</b>
        <br />
        {getUserFacingMessage(error.error)}
      </Alert>
    )
  }
}

export default memo(ProjectsActionModal)
