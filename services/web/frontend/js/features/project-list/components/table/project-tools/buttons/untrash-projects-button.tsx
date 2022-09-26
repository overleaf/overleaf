import { memo, useCallback } from 'react'
import { Button } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { useProjectListContext } from '../../../../context/project-list-context'
import { untrashProject } from '../../../../util/api'

function UntrashProjectsButton() {
  const { selectedProjects, updateProjectViewData } = useProjectListContext()
  const { t } = useTranslation()

  const handleUntrashProjects = useCallback(async () => {
    for (const [, project] of Object.entries(selectedProjects)) {
      await untrashProject(project.id)
      // update view
      project.trashed = false
      project.selected = false
      updateProjectViewData(project)
    }
  }, [selectedProjects, updateProjectViewData])

  return <Button onClick={handleUntrashProjects}>{t('untrash')}</Button>
}

export default memo(UntrashProjectsButton)
