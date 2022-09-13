import { useTranslation } from 'react-i18next'
import { memo, useCallback } from 'react'
import { Project } from '../../../../../../../../types/project/dashboard/api'
import Icon from '../../../../../../shared/components/icon'
import Tooltip from '../../../../../../shared/components/tooltip'
import { useProjectListContext } from '../../../../context/project-list-context'
import { untrashProject } from '../../../../util/api'

type UntrashProjectButtonProps = {
  project: Project
}

function UntrashProjectButton({ project }: UntrashProjectButtonProps) {
  const { t } = useTranslation()
  const text = t('untrash')
  const { updateProjectViewData } = useProjectListContext()

  const handleUntrashProject = useCallback(async () => {
    await untrashProject(project.id)
    // update view
    project.trashed = false
    updateProjectViewData(project)
  }, [project, updateProjectViewData])

  if (!project.trashed) return null

  return (
    <Tooltip
      key={`tooltip-untrash-project-${project.id}`}
      id={`tooltip-untrash-project-${project.id}`}
      description={text}
      overlayProps={{ placement: 'top', trigger: ['hover', 'focus'] }}
    >
      <button
        className="btn btn-link action-btn"
        aria-label={text}
        onClick={handleUntrashProject}
      >
        <Icon type="reply" />
      </button>
    </Tooltip>
  )
}

export default memo(UntrashProjectButton)
