// @ts-check
'use strict'

/**
 * Which storage a project's file tree lives in.
 *
 * A project migrates onto history-as-source-of-truth once, and there is no way
 * back: above the gate, web's mongo rootFolder/docs/fileRefs are no longer
 * authoritative and history-v1 holds the tree. Exactly one thing decides which
 * storage is authoritative, and this is it.
 *
 * It lives here because every service that has to make that decision -- web
 * backend and editor, real-time, third-party-datastore, github-sync -- already
 * depends on this library, and because a copy per service is five things that
 * have to agree: one of them drifting misroutes a whole service's writes into
 * the store nothing reads any more, silently and with no way back.
 *
 * Deliberately a leaf: it imports nothing. A test that mocks a sibling of a
 * module holding this constant must not be able to leave it undefined, because
 * `undefined >= 11` is false and a silently disabled gate reads as "below the
 * gate" for every project. Reference the constant, never the number.
 */

/** The stage at or above which history holds the project's file tree. */
const HISTORY_FILE_TREE_STAGE = 11

/**
 * Whether history holds the file tree of a project at this migration stage.
 *
 * A project that has never migrated has no stage at all, which is below the
 * gate. Anything else that is not a number is corrupt rather than low, and
 * answering "below the gate" for it would route the project's writes into mongo
 * for good, so it is refused instead.
 *
 * @param {unknown} otMigrationStage as stored on `overleaf.history`
 * @return {boolean}
 * @throws {TypeError} where the stage is neither absent nor a number
 */
function historyIsSourceOfTruth(otMigrationStage) {
  if (otMigrationStage == null) return false
  if (
    typeof otMigrationStage !== 'number' ||
    !Number.isFinite(otMigrationStage)
  ) {
    throw new TypeError(
      `otMigrationStage is not a number: ${JSON.stringify(otMigrationStage)}`
    )
  }
  return otMigrationStage >= HISTORY_FILE_TREE_STAGE
}

module.exports = { HISTORY_FILE_TREE_STAGE, historyIsSourceOfTruth }
