// @ts-check

/** @type {import('./types').PrivilegeLevelsType} */
const PrivilegeLevels = {
  NONE: false,
  READ_ONLY: 'readOnly',
  READ_AND_WRITE: 'readAndWrite',
  REVIEW: 'review',
  OWNER: 'owner',
}

export default PrivilegeLevels
