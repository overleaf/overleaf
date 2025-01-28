import { User } from '../services/types/shared'
import { LoadedUpdate, ProjectOp, Version } from '../services/types/update'
import { Selection } from '../services/types/selection'

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

export type ItemSelectionState =
  | 'upperSelected'
  | 'lowerSelected'
  | 'withinSelected'
  | 'aboveSelected'
  | 'belowSelected'
  | 'selected'
  | null

export function isVersionSelected(
  selection: Selection,
  version: Version
): ItemSelectionState
// eslint-disable-next-line no-redeclare
export function isVersionSelected(
  selection: Selection,
  fromV: Version,
  toV: Version
): ItemSelectionState
// eslint-disable-next-line no-redeclare
export function isVersionSelected(
  selection: Selection,
  ...args: [Version] | [Version, Version]
): ItemSelectionState {
  if (selection.updateRange) {
    let [fromV, toV] = args
    toV = toV ?? fromV
    if (selection.comparing) {
      if (
        fromV > selection.updateRange.fromV &&
        toV < selection.updateRange.toV
      ) {
        return 'withinSelected'
      }

      // Condition for selectedEdge when the comparing versions are from labels list
      if (fromV === toV) {
        if (fromV === selection.updateRange.toV) {
          return 'upperSelected'
        }
        if (toV === selection.updateRange.fromV) {
          return 'lowerSelected'
        }
      }

      // Comparing mode above selected condition
      if (fromV >= selection.updateRange.toV) {
        return 'aboveSelected'
      }
      // Comparing mode below selected condition
      if (toV <= selection.updateRange.fromV) {
        return 'belowSelected'
      }

      if (toV === selection.updateRange.toV) {
        return 'upperSelected'
      }
      if (fromV === selection.updateRange.fromV) {
        return 'lowerSelected'
      }
    } else if (toV === selection.updateRange.toV) {
      // single version mode
      return 'selected'
    } else if (fromV >= selection.updateRange.toV) {
      // Non-Comparing mode above selected condition
      return 'aboveSelected'
    } else if (toV <= selection.updateRange.fromV) {
      // Non-Comparing mode below selected condition
      return 'belowSelected'
    }
  }

  return null
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
