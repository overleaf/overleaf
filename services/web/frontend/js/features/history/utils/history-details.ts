import ColorManager from '../../../ide/colors/ColorManager'
import { Nullable } from '../../../../../types/utils'
import { User } from '../services/types/shared'
import { LoadedUpdate, ProjectOp, Version } from '../services/types/update'
import { Selection } from '../services/types/selection'

export const getUserColor = (user?: Nullable<{ id: string }>) => {
  const hue = ColorManager.getHueForUserId(user?.id) || 100

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

export function isVersionSelected(
  selection: Selection,
  version: Version
): boolean
// eslint-disable-next-line no-redeclare
export function isVersionSelected(
  selection: Selection,
  fromV: Version,
  toV: Version
): boolean
// eslint-disable-next-line no-redeclare
export function isVersionSelected(
  selection: Selection,
  ...args: [Version] | [Version, Version]
): boolean {
  if (selection.updateRange) {
    let [fromV, toV] = args
    toV = toV ?? fromV

    if (selection.comparing) {
      // compare mode
      return (
        fromV >= selection.updateRange.fromV && toV <= selection.updateRange.toV
      )
    } else {
      // single version mode
      return toV === selection.updateRange.toV
    }
  }
  return false
}

export const getUpdateForVersion = (version: number, updates: LoadedUpdate[]) =>
  updates.find(update => update.toV === version)

export const updateRangeForUpdate = (update: LoadedUpdate) => {
  const { fromV, toV, meta } = update
  const fromVTimestamp = meta.end_ts

  return {
    fromV,
    toV,
    fromVTimestamp,
    toVTimestamp: fromVTimestamp,
  }
}
