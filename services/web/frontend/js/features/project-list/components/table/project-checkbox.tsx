import { memo, useCallback } from 'react'
import { useProjectListContext } from '@/features/project-list/context/project-list-context'

export const ProjectCheckbox = memo<{ projectId: string }>(({ projectId }) => {
  const { selectedProjectIds, toggleSelectedProject } = useProjectListContext()

  const handleCheckboxChange = useCallback(
    event => {
      toggleSelectedProject(projectId, event.target.checked)
    },
    [projectId, toggleSelectedProject]
  )

  return (
    <input
      type="checkbox"
      id={`select-project-${projectId}`}
      autoComplete="off"
      checked={selectedProjectIds.has(projectId)}
      onChange={handleCheckboxChange}
      data-project-id={projectId}
    />
  )
})

ProjectCheckbox.displayName = 'ProjectCheckbox'
