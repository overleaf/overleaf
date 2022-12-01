import { memo, useEffect, useRef, useState } from 'react'
import { Alert, Modal } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { Project } from '../../../../../../types/project/dashboard/api'
import AccessibleModal from '../../../../shared/components/accessible-modal'
import { getUserFacingMessage } from '../../../../infrastructure/fetch-json'
import useIsMounted from '../../../../shared/hooks/use-is-mounted'
import * as eventTracking from '../../../../infrastructure/event-tracking'

type ProjectsActionModalProps = {
  title?: string
  action: 'archive' | 'trash' | 'delete' | 'leave'
  actionHandler: (project: Project) => Promise<void>
  handleCloseModal: () => void
  bodyTop?: React.ReactNode
  bodyBottom?: React.ReactNode
  projects: Array<Project>
  showModal: boolean
}

function ProjectsActionModal({
  title,
  action,
  actionHandler,
  handleCloseModal,
  bodyTop,
  bodyBottom,
  showModal,
  projects,
}: ProjectsActionModalProps) {
  const { t } = useTranslation()
  const [errors, setErrors] = useState<Array<any>>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [projectsToDisplay, setProjectsToDisplay] = useState<Project[]>([])
  const projectsRef = useRef<Project[]>([])
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
      eventTracking.send(
        'project-list-page-interaction',
        'project action',
        action
      )

      if (projectsRef.current.length > 0) {
        // maintain the original list in the display of the modal,
        // even after some project actions have completed
        setProjectsToDisplay(projectsRef.current)
      } else {
        projectsRef.current = projects
        setProjectsToDisplay(projects)
      }
    } else {
      projectsRef.current = []
    }
  }, [action, projects, projectsRef, showModal])

  const projectIdsRemainingToProcess = projects.map(p => p.id)

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
      <Modal.Body>
        {bodyTop}
        <ul>
          {projectsToDisplay.map(project => (
            <li
              key={`projects-action-list-${project.id}`}
              className={
                projectIdsRemainingToProcess.includes(project.id)
                  ? ''
                  : 'list-style-check-green'
              }
            >
              <b>{project.name}</b>
            </li>
          ))}
        </ul>

        {bodyBottom}
      </Modal.Body>
      <Modal.Footer>
        {!isProcessing &&
          errors.length > 0 &&
          errors.map((e, i) => (
            <Alert
              bsStyle="danger"
              key={`action-error-${i}`}
              className="text-center"
              aria-live="polite"
            >
              <b>{e.projectName}</b>
              <br />
              {getUserFacingMessage(e.error)}
            </Alert>
          ))}
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

export default memo(ProjectsActionModal)
