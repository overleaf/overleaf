// @ts-check

const { callbackify } = require('util')
const HistoryManager = require('../History/HistoryManager')

/**
 * Migrate a single project
 *
 * @param {string} projectId
 * @param {"forwards" | "backwards"} direction
 */
async function migrateProject(projectId, direction = 'forwards') {
  await HistoryManager.promises.flushProject(projectId)
  await HistoryManager.promises.resyncProject(projectId, {
    historyRangesMigration: direction,
  })
}

module.exports = {
  migrateProject: callbackify(migrateProject),
  promises: { migrateProject },
}
