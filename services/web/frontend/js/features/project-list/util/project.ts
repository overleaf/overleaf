import { getUserName } from './user'
import { Project } from '../../../../../types/project/dashboard/api'

export function getOwnerName(project: Project) {
  if (project.accessLevel === 'owner') {
    return 'You'
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
