// @ts-check

import Errors from '../Errors/Errors.js'

/** @type {typeof import('./types').PrivilegeLevelsType} */
const PrivilegeLevels = {
  NONE: false,
  READ_ONLY: 'readOnly',
  READ_AND_WRITE: 'readAndWrite',
  REVIEW: 'review',
  OWNER: 'owner',
}

/** @type {import('./types').PrivilegeLevel[]} */
export const OrderedPrivilegeLevels = [
  PrivilegeLevels.NONE,
  PrivilegeLevels.READ_ONLY,
  PrivilegeLevels.REVIEW,
  PrivilegeLevels.READ_AND_WRITE,
  PrivilegeLevels.OWNER,
]

/** @type {typeof import('./types').isPrivilegeUpgrade} */
export function isPrivilegeUpgrade(currentLevel, newLevel) {
  if (
    !OrderedPrivilegeLevels.includes(currentLevel) ||
    !OrderedPrivilegeLevels.includes(newLevel)
  ) {
    throw new Errors.InvalidError('Invalid privilege level specified')
  }
  return (
    OrderedPrivilegeLevels.indexOf(newLevel) >
    OrderedPrivilegeLevels.indexOf(currentLevel)
  )
}

export default PrivilegeLevels
