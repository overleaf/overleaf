import { memo, useEffect, useState } from 'react'
import { Alert, Modal } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { Project } from '../../../../../../types/project/dashboard/api'
import AccessibleModal from '../../../../shared/components/accessible-modal'
import { getUserFacingMessage } from '../../../../infrastructure/fetch-json'
import useIsMounted from '../../../../shared/hooks/use-is-mounted'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import Icon from '../../../../shared/components/icon'

type ProjectsActionModalProps = {
  action: 'archive' | 'trash' | 'delete' | 'leave'
  actionHandler: (project: Project) => Promise<void>
  handleCloseModal: () => void
  projects: Array<Project>
  showModal: boolean
}

function ProjectsActionModal({
  action,
  actionHandler,
  handleCloseModal,
  showModal,
  projects,
}: ProjectsActionModalProps) {
  let bodyTop, bodyBottom, title
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
      eventTracking.send(
        'project-list-page-interaction',
        'project action',
        action
      )
    }
  }, [action, showModal])

  if (action === 'archive') {
    title = t('archive_projects')
    bodyTop = <p>{t('about_to_archive_projects')}</p>
    bodyBottom = (
      <p>
        {t('archiving_projects_wont_affect_collaborators')}{' '}
        <a
          href="https://www.overleaf.com/blog/new-feature-using-archive-and-trash-to-keep-your-projects-organized"
          target="_blank"
          rel="noreferrer"
        >
          {t('find_out_more_nt')}
        </a>
      </p>
    )
  } else if (action === 'leave') {
    title = t('leave_projects')
    bodyTop = <p>{t('about_to_leave_projects')}</p>
    bodyBottom = (
      <div className="project-action-alert alert alert-warning">
        <Icon type="exclamation-triangle" fw />{' '}
        {t('this_action_cannot_be_undone')}
      </div>
    )
  } else if (action === 'trash') {
    title = t('trash_projects')
    bodyTop = <p>{t('about_to_trash_projects')}</p>
    bodyBottom = (
      <p>
        {t('trashing_projects_wont_affect_collaborators')}{' '}
        <a
          href="https://www.overleaf.com/blog/new-feature-using-archive-and-trash-to-keep-your-projects-organized"
          target="_blank"
          rel="noreferrer"
        >
          {t('find_out_more_nt')}
        </a>
      </p>
    )
  } else if (action === 'delete') {
    title = t('delete_projects')
    bodyTop = <p>{t('about_to_delete_projects')}</p>
    bodyBottom = (
      <div className="project-action-alert alert alert-warning">
        <Icon type="exclamation-triangle" fw />{' '}
        {t('this_action_cannot_be_undone')}
      </div>
    )
  }

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
          {projects.map(project => (
            <li key={`projects-action-list-${project.id}`}>
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
        <button className="btn btn-default" onClick={handleCloseModal}>
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
