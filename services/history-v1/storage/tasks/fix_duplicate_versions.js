#!/usr/bin/env node

'use strict'

const commandLineArgs = require('command-line-args')
const { chunkStore } = require('..')

main()
  .then(() => {
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })

async function main() {
  const opts = commandLineArgs([
    { name: 'project-ids', type: String, multiple: true, defaultOption: true },
    { name: 'save', type: Boolean, defaultValue: false },
    { name: 'help', type: Boolean, defaultValue: false },
  ])
  if (opts.help || opts['project-ids'] == null) {
    console.log('Usage: fix_duplicate_versions [--save] PROJECT_ID...')
    process.exit()
  }
  for (const projectId of opts['project-ids']) {
    await processProject(projectId, opts.save)
  }
  if (!opts.save) {
    console.log('\nThis was a dry run. Re-run with --save to persist changes.')
  }
}

async function processProject(projectId, save) {
  console.log(`Project ${projectId}:`)
  const chunk = await chunkStore.loadLatest(projectId, { persistedOnly: true })
  let numChanges = 0
  numChanges += removeDuplicateProjectVersions(chunk)
  numChanges += removeDuplicateDocVersions(chunk)
  console.log(`    ${numChanges > 0 ? numChanges : 'no'} changes`)
  if (save && numChanges > 0) {
    await replaceChunk(projectId, chunk)
  }
}

function removeDuplicateProjectVersions(chunk) {
  let numChanges = 0
  let lastVersion = null
  const { snapshot, changes } = chunk.history
  if (snapshot.projectVersion != null) {
    lastVersion = snapshot.projectVersion
  }
  for (const change of changes) {
    if (change.projectVersion == null) {
      // Not a project structure change. Ignore.
      continue
    }
    if (
      lastVersion != null &&
      !areProjectVersionsIncreasing(lastVersion, change.projectVersion)
    ) {
      // Duplicate. Remove all ops
      console.log(
        `    Removing out-of-order project structure change: ${change.projectVersion} <= ${lastVersion}`
      )
      change.setOperations([])
      delete change.projectVersion
      numChanges++
    } else {
      lastVersion = change.projectVersion
    }
  }

  return numChanges
}

function removeDuplicateDocVersions(chunk) {
  let numChanges = 0
  const lastVersions = new Map()
  const { snapshot, changes } = chunk.history
  if (snapshot.v2DocVersions != null) {
    for (const { pathname, v } of Object.values(snapshot.v2DocVersions.data)) {
      lastVersions.set(pathname, v)
    }
  }
  for (const change of changes) {
    if (change.v2DocVersions == null) {
      continue
    }

    // Collect all docs that have problematic versions
    const badPaths = []
    const badDocIds = []
    for (const [docId, { pathname, v }] of Object.entries(
      change.v2DocVersions.data
    )) {
      const lastVersion = lastVersions.get(docId)
      if (lastVersion != null && v <= lastVersion) {
        // Duplicate. Remove ops related to that doc
        console.log(
          `    Removing out-of-order change for doc ${docId} (${pathname}): ${v} <= ${lastVersion}`
        )
        badPaths.push(pathname)
        badDocIds.push(docId)
        numChanges++
      } else {
        lastVersions.set(docId, v)
      }
    }

    // Remove bad operations
    if (badPaths.length > 0) {
      change.setOperations(
        change.operations.filter(
          op => op.pathname == null || !badPaths.includes(op.pathname)
        )
      )
    }

    // Remove bad v2 doc versions
    for (const docId of badDocIds) {
      delete change.v2DocVersions.data[docId]
    }
  }

  return numChanges
}

function areProjectVersionsIncreasing(v1Str, v2Str) {
  const v1 = parseProjectVersion(v1Str)
  const v2 = parseProjectVersion(v2Str)
  return v2.major > v1.major || (v2.major === v1.major && v2.minor > v1.minor)
}

function parseProjectVersion(version) {
  const [major, minor] = version.split('.').map(x => parseInt(x, 10))
  if (isNaN(major) || isNaN(minor)) {
    throw new Error(`Invalid project version: ${version}`)
  }
  return { major, minor }
}

async function replaceChunk(projectId, chunk) {
  const endVersion = chunk.getEndVersion()
  const oldChunkId = await chunkStore.getChunkIdForVersion(
    projectId,
    endVersion
  )
  console.log(`    Replacing chunk ${oldChunkId}`)
  // The chunks table has a unique constraint on doc_id and end_version. Because
  // we're replacing a chunk with the same end version, we need to destroy the
  // chunk first.
  await chunkStore.destroy(projectId, oldChunkId)
  await chunkStore.create(projectId, chunk)
}
