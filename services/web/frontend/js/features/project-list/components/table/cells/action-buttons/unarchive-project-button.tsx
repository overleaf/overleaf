import { useTranslation } from 'react-i18next'
import { memo, useCallback } from 'react'
import { Project } from '../../../../../../../../types/project/dashboard/api'
import Icon from '../../../../../../shared/components/icon'
import Tooltip from '../../../../../../shared/components/tooltip'
import { useProjectListContext } from '../../../../context/project-list-context'
import { unarchiveProject } from '../../../../util/api'

type UnarchiveProjectButtonProps = {
  project: Project
}

function UnarchiveProjectButton({ project }: UnarchiveProjectButtonProps) {
  const { t } = useTranslation()
  const text = t('unarchive')
  const { updateProjectViewData } = useProjectListContext()

  const handleUnarchiveProject = useCallback(async () => {
    await unarchiveProject(project.id)

    // update view
    project.archived = false
    updateProjectViewData(project)
  }, [project, updateProjectViewData])

  if (!project.archived) return null

  return (
    <Tooltip
      key={`tooltip-unarchive-project-${project.id}`}
      id={`tooltip-unarchive-project-${project.id}`}
      description={text}
      overlayProps={{ placement: 'top', trigger: ['hover', 'focus'] }}
    >
      <button
        className="btn btn-link action-btn"
        aria-label={text}
        onClick={handleUnarchiveProject}
      >
        <Icon type="reply" />
      </button>
    </Tooltip>
  )
}

export default memo(UnarchiveProjectButton)
