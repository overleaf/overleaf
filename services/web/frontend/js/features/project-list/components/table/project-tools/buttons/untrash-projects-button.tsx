import { memo } from 'react'
import OLButton from '@/shared/components/ol/ol-button'
import { useTranslation } from 'react-i18next'
import { useProjectListContext } from '../../../../context/project-list-context'
import { untrashProject } from '../../../../util/api'

function UntrashProjectsButton() {
  const { selectedProjects, toggleSelectedProject, updateProjectViewData } =
    useProjectListContext()
  const { t } = useTranslation()

  const handleUntrashProjects = async () => {
    for (const project of selectedProjects) {
      await untrashProject(project.id)
      toggleSelectedProject(project.id, false)
      updateProjectViewData({ ...project, trashed: false })
    }
  }

  return (
    <OLButton variant="secondary" onClick={handleUntrashProjects}>
      {t('untrash')}
    </OLButton>
  )
}

export default memo(UntrashProjectsButton)
