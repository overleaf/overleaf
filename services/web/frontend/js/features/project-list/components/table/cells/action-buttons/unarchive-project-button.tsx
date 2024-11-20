import { useTranslation } from 'react-i18next'
import { memo, useCallback } from 'react'
import { Project } from '../../../../../../../../types/project/dashboard/api'
import { useProjectListContext } from '../../../../context/project-list-context'
import { unarchiveProject } from '../../../../util/api'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import OLIconButton from '@/features/ui/components/ol/ol-icon-button'

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
          <OLTooltip
            key={`tooltip-unarchive-project-${project.id}`}
            id={`unarchive-project-${project.id}`}
            description={text}
            overlayProps={{ placement: 'top', trigger: ['hover', 'focus'] }}
          >
            <span>
              <OLIconButton
                onClick={handleUnarchiveProject}
                variant="link"
                accessibilityLabel={text}
                className="action-btn"
                icon="restore_page"
              />
            </span>
          </OLTooltip>
        )}
      </UnarchiveProjectButton>
    )
  }
)

export default memo(UnarchiveProjectButton)
export { UnarchiveProjectButtonTooltip }
