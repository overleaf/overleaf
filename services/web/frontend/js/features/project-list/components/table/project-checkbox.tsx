import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useProjectListContext } from '@/features/project-list/context/project-list-context'
import OLFormCheckbox from '@/features/ui/components/ol/ol-form-checkbox'

export const ProjectCheckbox = memo<{ projectId: string; projectName: string }>(
  ({ projectId, projectName }) => {
    const { t } = useTranslation()
    const { selectedProjectIds, toggleSelectedProject } =
      useProjectListContext()

    const handleCheckboxChange = useCallback(
      event => {
        toggleSelectedProject(projectId, event.target.checked)
      },
      [projectId, toggleSelectedProject]
    )

    return (
      <OLFormCheckbox
        autoComplete="off"
        onChange={handleCheckboxChange}
        checked={selectedProjectIds.has(projectId)}
        aria-label={t('select_project', { project: projectName })}
        data-project-id={projectId}
      />
    )
  }
)

ProjectCheckbox.displayName = 'ProjectCheckbox'
