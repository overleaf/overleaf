import { getUserName } from './user'
import { Project } from '../../../../../types/project/dashboard/api'
import { useTranslation } from 'react-i18next'

export function getOwnerName(project: Project) {
  const { t } = useTranslation()

  if (project.accessLevel === 'owner') {
    return t('you')
  }

  if (project.owner != null) {
    return getUserName(project.owner)
  }

  return ''
}

export function isDeletableProject(project: Project) {
  return project.accessLevel === 'owner' && project.trashed
}

export function isLeavableProject(project: Project) {
  return project.accessLevel !== 'owner' && project.trashed
}

export function isArchivedOrTrashed(project: Project) {
  return project.archived || project.trashed
}
