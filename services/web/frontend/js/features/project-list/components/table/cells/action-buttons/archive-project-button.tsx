import { useTranslation } from 'react-i18next'
import { Project } from '../../../../../../../../types/project/dashboard/api'
import { memo, useCallback, useState } from 'react'
import Icon from '../../../../../../shared/components/icon'
import Tooltip from '../../../../../../shared/components/tooltip'
import ProjectsActionModal from '../../projects-action-modal'
import useIsMounted from '../../../../../../shared/hooks/use-is-mounted'
import { useProjectListContext } from '../../../../context/project-list-context'
import { archiveProject } from '../../../../util/api'

type ArchiveProjectButtonProps = {
  project: Project
}

function ArchiveProjectButton({ project }: ArchiveProjectButtonProps) {
  const { updateProjectViewData } = useProjectListContext()
  const { t } = useTranslation()
  const text = t('archive')
  const [showModal, setShowModal] = useState(false)
  const isMounted = useIsMounted()

  const handleOpenModal = useCallback(() => {
    setShowModal(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    if (isMounted.current) {
      setShowModal(false)
    }
  }, [isMounted])

  const handleArchiveProject = useCallback(async () => {
    await archiveProject(project.id)

    // update view
    project.archived = true
    updateProjectViewData(project)
  }, [project, updateProjectViewData])

  if (project.archived) return null

  return (
    <>
      <Tooltip
        key={`tooltip-archive-project-${project.id}`}
        id={`tooltip-archive-project-${project.id}`}
        description={text}
        overlayProps={{ placement: 'top', trigger: ['hover', 'focus'] }}
      >
        <button
          className="btn btn-link action-btn"
          aria-label={text}
          onClick={handleOpenModal}
        >
          <Icon type="inbox" />
        </button>
      </Tooltip>

      <ProjectsActionModal
        title={t('archive_projects')}
        action="archive"
        actionHandler={handleArchiveProject}
        bodyTop={<p>{t('about_to_archive_projects')}</p>}
        bodyBottom={
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
        }
        showModal={showModal}
        handleCloseModal={handleCloseModal}
        projects={[project]}
      />
    </>
  )
}

export default memo(ArchiveProjectButton)
