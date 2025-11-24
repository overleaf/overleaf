// @ts-check
import { db } from '../app/src/infrastructure/mongodb.mjs'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'
import { scriptRunner } from './lib/ScriptRunner.mjs'
import CollaboratorsHandler from '../app/src/Features/Collaborators/CollaboratorsHandler.mjs'

const DRY_RUN = !process.argv.includes('--dry-run=false')
const DEBUG = process.argv.includes('--debug=true')

// Deployment procedure:
// Run it locally (not dry run)
// Run it on staging (dry run then real and then real). Maybe leave it a few days but might not get good feedback
// Run on prod on a small number of projects to start with, then on all projects (using BATCH_RANGE_START and BATCH_RANGE_END env vars)
// Are there race conditions here? If someone is editing in parallel. Is it worth doing atomic queries?

/**
 * @typedef {Object} Project
 * @property {any} _id
 * @property {Object} track_changes
 */

/**
 * @param {(progress: string) => Promise<void>} trackProgress
 * @returns {Promise<void>}
 * @async
 */
async function main(trackProgress) {
  let projectsProcessed = 0
  await batchedUpdate(
    db.projects,
    {},
    /**
     * @param {Array<Project>} projects
     * @return {Promise<void>}
     */
    async function projects(projects) {
      for (const project of projects) {
        projectsProcessed += 1
        if (projectsProcessed % 100000 === 0) {
          console.log(projectsProcessed, 'projects processed')
        }
        await processProject(project)
      }
    },
    { _id: 1, track_changes: 1 },
    undefined,
    { trackProgress }
  )
}

async function processProject(project) {
  if (DEBUG) {
    console.log(
      `Processing project ${project._id} with track_changes: ${JSON.stringify(
        project.track_changes
      )}`
    )
  }

  if (typeof project.track_changes === 'object') {
    if (DEBUG) {
      console.log(
        `Skipping project ${project._id} as it is already in the new format`
      )
    }
    return
  }

  const newTrackChangesState =
    await CollaboratorsHandler.promises.convertTrackChangesToExplicitFormat(
      project._id,
      project.track_changes
    )

  if (DEBUG) {
    console.log(
      `Processed project ${project._id} to have new track_changes: ${JSON.stringify(
        newTrackChangesState
      )}`
    )
  }

  if (!DRY_RUN) {
    await db.projects.updateOne(
      { _id: project._id },
      { $set: { track_changes: newTrackChangesState } }
    )
    console.log(
      `Updated project ${project._id} track_changes from ${JSON.stringify(project.track_changes)} to ${JSON.stringify(newTrackChangesState)}`
    )
  } else {
    console.log(
      `Dry run - would have updated project ${project._id} track_changes from ${JSON.stringify(project.track_changes)} to ${JSON.stringify(newTrackChangesState)}`
    )
  }
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
