#!/usr/bin/env node

/**
 * This script takes a dump file, obtained via the /project/:project_id/dump
 * endpoint and feeds it to the update translator to how updates are transfomed
 * into changes sent to v1 history.
 */
import fs from 'node:fs'
import * as UpdateTranslator from '../app/js/UpdateTranslator.js'
import * as SyncManager from '../app/js/SyncManager.js'
import * as HistoryStoreManager from '../app/js/HistoryStoreManager.js'

const { filename } = parseArgs()
const { projectId, updates, chunk } = parseDumpFile(filename)

function expandResyncProjectStructure(chunk, update) {
  HistoryStoreManager._mocks.getMostRecentChunk = function (
    projectId,
    projectHistoryId,
    callback
  ) {
    callback(null, chunk)
  }

  SyncManager.expandSyncUpdates(
    projectId,
    99999, // dummy history id
    chunk,
    [update],
    cb => cb(), // extend lock
    (err, result) => {
      console.log('err', err, 'result', JSON.stringify(result, null, 2))
      process.exit()
    }
  )
}

function expandUpdates(updates) {
  const wrappedUpdates = updates.map(update => ({ update }))
  let changes
  try {
    changes = UpdateTranslator.convertToChanges(projectId, wrappedUpdates)
  } catch (err) {
    error(err)
  }
  console.log(JSON.stringify(changes, null, 2))
}

if (updates[0].resyncProjectStructure) {
  expandResyncProjectStructure(chunk, updates[0])
} else {
  expandUpdates(updates)
}

function parseArgs() {
  const args = process.argv.slice(2)
  if (args.length !== 1) {
    console.log('Usage: debug_translate_updates.js DUMP_FILE')
    process.exit(1)
  }
  const filename = args[0]
  return { filename }
}

function parseDumpFile(filename) {
  const json = fs.readFileSync(filename)
  const { project_id: projectId, updates, chunk } = JSON.parse(json)
  return { projectId, updates, chunk }
}

function error(err) {
  console.error(err)
  process.exit(1)
}
