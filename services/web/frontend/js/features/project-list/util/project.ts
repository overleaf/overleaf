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
