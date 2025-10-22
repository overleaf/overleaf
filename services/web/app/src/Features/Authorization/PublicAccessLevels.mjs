// @ts-check

/**
 * Note:
 * It used to be that `project.publicAccessLevel` could be set to `private`,
 * `readOnly` or `readAndWrite`, the latter of which made the project publicly
 * accessible.
 *
 * This system was replaced with "link sharing", therafter the valid values are
 * `private` or `tokenBased`. While it is no longer possible to set
 * `publicAccessLevel` to the legacy values, there are projects in the system
 * that already have those values set.
 */

/** @type {import('./types').PublicAccessLevelsType} */
export default {
  READ_ONLY: 'readOnly', // LEGACY
  READ_AND_WRITE: 'readAndWrite', // LEGACY
  PRIVATE: 'private',
  TOKEN_BASED: 'tokenBased',
}
