import { useTranslation } from 'react-i18next'
import { memo, useCallback } from 'react'
import { Project } from '../../../../../../../../types/project/dashboard/api'
import Icon from '../../../../../../shared/components/icon'
import Tooltip from '../../../../../../shared/components/tooltip'
import { useProjectListContext } from '../../../../context/project-list-context'
import { unarchiveProject } from '../../../../util/api'

type UnarchiveProjectButtonProps = {
  project: Project
  children: (
    text: string,
    handleUnarchiveProject: () => Promise<void>
  ) => React.ReactElement
}

function UnarchiveProjectButton({
  project,
  children,
}: UnarchiveProjectButtonProps) {
  const { t } = useTranslation()
  const text = t('unarchive')
  const { toggleSelectedProject, updateProjectViewData } =
    useProjectListContext()

  const handleUnarchiveProject = useCallback(async () => {
    await unarchiveProject(project.id)
    toggleSelectedProject(project.id, false)
    updateProjectViewData({ ...project, archived: false })
  }, [project, toggleSelectedProject, updateProjectViewData])

  if (!project.archived) return null

  return children(text, handleUnarchiveProject)
}

const UnarchiveProjectButtonTooltip = memo(
  function UnarchiveProjectButtonTooltip({
    project,
  }: Pick<UnarchiveProjectButtonProps, 'project'>) {
    return (
      <UnarchiveProjectButton project={project}>
        {(text, handleUnarchiveProject) => (
          <Tooltip
            key={`tooltip-unarchive-project-${project.id}`}
            id={`unarchive-project-${project.id}`}
            description={text}
            overlayProps={{ placement: 'top', trigger: ['hover', 'focus'] }}
          >
            <button
              className="btn btn-link action-btn"
              aria-label={text}
              onClick={handleUnarchiveProject}
            >
              <Icon type="reply" fw />
            </button>
          </Tooltip>
        )}
      </UnarchiveProjectButton>
    )
  }
)

export default memo(UnarchiveProjectButton)
export { UnarchiveProjectButtonTooltip }
