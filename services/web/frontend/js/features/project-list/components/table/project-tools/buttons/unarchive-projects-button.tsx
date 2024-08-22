import { memo } from 'react'
import OLButton from '@/features/ui/components/ol/ol-button'
import { useTranslation } from 'react-i18next'
import { useProjectListContext } from '../../../../context/project-list-context'
import { unarchiveProject } from '../../../../util/api'

function UnarchiveProjectsButton() {
  const { selectedProjects, toggleSelectedProject, updateProjectViewData } =
    useProjectListContext()
  const { t } = useTranslation()

  const handleUnarchiveProjects = async () => {
    for (const project of selectedProjects) {
      await unarchiveProject(project.id)
      toggleSelectedProject(project.id, false)
      updateProjectViewData({ ...project, archived: false })
    }
  }

  return (
    <OLButton variant="secondary" onClick={handleUnarchiveProjects}>
      {t('untrash')}
    </OLButton>
  )
}

export default memo(UnarchiveProjectsButton)
