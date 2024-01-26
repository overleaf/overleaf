import { useTranslation } from 'react-i18next'
import { memo, useCallback } from 'react'
import { Project } from '../../../../../../../../types/project/dashboard/api'
import Icon from '../../../../../../shared/components/icon'
import Tooltip from '../../../../../../shared/components/tooltip'
import { useProjectListContext } from '../../../../context/project-list-context'
import { untrashProject } from '../../../../util/api'

type UntrashProjectButtonProps = {
  project: Project
  children: (
    text: string,
    untrashProject: () => Promise<void>
  ) => React.ReactElement
}

function UntrashProjectButton({
  project,
  children,
}: UntrashProjectButtonProps) {
  const { t } = useTranslation()
  const text = t('untrash')
  const { toggleSelectedProject, updateProjectViewData } =
    useProjectListContext()

  const handleUntrashProject = useCallback(async () => {
    await untrashProject(project.id)
    toggleSelectedProject(project.id, false)
    updateProjectViewData({ ...project, trashed: false })
  }, [project, toggleSelectedProject, updateProjectViewData])

  if (!project.trashed) return null

  return children(text, handleUntrashProject)
}

const UntrashProjectButtonTooltip = memo(function UntrashProjectButtonTooltip({
  project,
}: Pick<UntrashProjectButtonProps, 'project'>) {
  return (
    <UntrashProjectButton project={project}>
      {(text, handleUntrashProject) => (
        <Tooltip
          key={`tooltip-untrash-project-${project.id}`}
          id={`untrash-project-${project.id}`}
          description={text}
          overlayProps={{ placement: 'top', trigger: ['hover', 'focus'] }}
        >
          <button
            className="btn btn-link action-btn"
            aria-label={text}
            onClick={handleUntrashProject}
          >
            <Icon type="reply" fw />
          </button>
        </Tooltip>
      )}
    </UntrashProjectButton>
  )
})

export default memo(UntrashProjectButton)
export { UntrashProjectButtonTooltip }
