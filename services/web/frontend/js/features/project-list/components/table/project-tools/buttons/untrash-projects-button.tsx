import { memo } from 'react'
import { Button } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { useProjectListContext } from '../../../../context/project-list-context'
import { untrashProject } from '../../../../util/api'

function UntrashProjectsButton() {
  const { selectedProjects, updateProjectViewData } = useProjectListContext()
  const { t } = useTranslation()

  const handleUntrashProjects = async () => {
    for (const project of selectedProjects) {
      await untrashProject(project.id)
      updateProjectViewData({ ...project, trashed: false, selected: false })
    }
  }

  return (
    <Button
      bsStyle={null}
      className="btn-secondary"
      onClick={handleUntrashProjects}
    >
      {t('untrash')}
    </Button>
  )
}

export default memo(UntrashProjectsButton)
