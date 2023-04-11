import ColorManager from '../../../ide/colors/ColorManager'
import { Nullable } from '../../../../../types/utils'
import { User } from '../services/types/shared'
import { ProjectOp } from '../services/types/update'

export const getUserColor = (
  user?: Nullable<{ id: string; _id?: never } | { id?: never; _id: string }>
) => {
  const curUserId = user?.id || user?._id
  const hue = ColorManager.getHueForUserId(curUserId) || 100

  return `hsl(${hue}, 70%, 50%)`
}

export const formatUserName = (user: User) => {
  let name = [user.first_name, user.last_name]
    .filter(n => n != null)
    .join(' ')
    .trim()
  if (name === '') {
    name = user.email.split('@')[0]
  }
  if (name == null || name === '') {
    return '?'
  }
  return name
}

export const getProjectOpDoc = (projectOp: ProjectOp) => {
  if (projectOp.rename) {
    return `${projectOp.rename.pathname} → ${projectOp.rename.newPathname}`
  }
  if (projectOp.add) {
    return `${projectOp.add.pathname}`
  }
  if (projectOp.remove) {
    return `${projectOp.remove.pathname}`
  }
  return ''
}
