#!/usr/bin/env node

/**
 * Script to check for and optionally fix duplicate collaborators in projects
 *
 * A duplicate collaborator is when the same user id appears in multiple collaborator
 * arrays for the same project (collaberator_refs, readOnly_refs, reviewer_refs, etc.)
 *
 * If "--fix" is used, this script will remove users from higher privilege roles and keeps them in lower privilege roles
 *
 * Usage:
 *   node scripts/check_duplicate_collaborators.mjs [--fix] [--project-id=<id>]
 */

import {
  batchedUpdate,
  READ_PREFERENCE_SECONDARY,
} from '@overleaf/mongo-utils/batchedUpdate.js'
import { db, ObjectId } from '../app/src/infrastructure/mongodb.mjs'
import minimist from 'minimist'
import { scriptRunner } from './lib/ScriptRunner.mjs'

const args = minimist(process.argv.slice(2), {
  boolean: ['fix'],
  string: ['project-id', 'start-date', 'end-date'],
  default: {
    fix: false,
  },
})

async function fixDuplicateCollaborators(project, trackProgress) {
  const dryRun = !args.fix
  const removeCollaboratorRefs = []
  const removeReviewerRefs = []

  for (const reviewerRef of project.reviewer_refs || []) {
    if (includesId(project.readOnly_refs, reviewerRef)) {
      removeReviewerRefs.push(reviewerRef) // remove from reviewer_refs (keep read-only)
    }
    if (includesId(project.collaberator_refs, reviewerRef)) {
      removeCollaboratorRefs.push(reviewerRef) // remove from collaberator_refs (keep reviewer)
    }
  }

  if (
    !dryRun &&
    (removeCollaboratorRefs.length > 0 || removeReviewerRefs.length > 0)
  ) {
    await db.projects.updateOne(
      { _id: project._id },
      {
        $pull: {
          collaberator_refs: { $in: removeCollaboratorRefs },
          reviewer_refs: { $in: removeReviewerRefs },
        },
      }
    )
  }

  const action = args.fix ? 'Removed' : 'Found duplicates in'

  if (removeCollaboratorRefs.length > 0) {
    trackProgress(
      `${action} collaborators from project ${project._id}:`,
      removeCollaboratorRefs
    )
  }
  if (removeReviewerRefs.length > 0) {
    trackProgress(
      `${action} reviewers from project ${project._id}:`,
      removeReviewerRefs
    )
  }
}

async function main(trackProgress) {
  if (!args['start-date'] && !args['project-id']) {
    console.error(
      'Please provide either --start-date or --project-id argument.'
    )
    process.exit(1)
  }

  if (args['project-id']) {
    const projectId = new ObjectId(args['project-id'])
    const project = await db.projects.findOne(
      { _id: projectId },
      {
        readPreference: READ_PREFERENCE_SECONDARY,
        projection: {
          _id: 1,
          collaberator_refs: 1,
          readOnly_refs: 1,
          reviewer_refs: 1,
        },
      }
    )

    if (!project) {
      console.error(`Project with id ${projectId} not found`)
      process.exit(1)
    }

    await fixDuplicateCollaborators(project, trackProgress)

    return
  }

  let projectsProcessed = 0
  await batchedUpdate(
    db.projects,
    {
      reviewer_refs: { $ne: [] },
      $or: [{ readOnly_refs: { $ne: [] } }, { collaberator_refs: { $ne: [] } }],
    },
    /**
     * @param {Array<Project>} projects
     * @return {Promise<void>}
     */
    async function projects(projects) {
      for (const project of projects) {
        projectsProcessed += 1
        if (projectsProcessed % 10000 === 0) {
          console.log(projectsProcessed, 'projects processed')
        }

        await fixDuplicateCollaborators(project, trackProgress)
      }
    },
    {
      _id: 1,
      collaberator_refs: 1,
      readOnly_refs: 1,
      reviewer_refs: 1,
    },
    undefined,
    {
      trackProgress,
      BATCH_RANGE_START: new Date(args['start-date']).toISOString(),
      BATCH_RANGE_END: args['end-date']
        ? new Date(args['end-date']).toISOString()
        : new Date().toISOString(),
    }
  )
}

function includesId(array, id) {
  return array?.some(item => item.toString() === id.toString())
}

try {
  await scriptRunner(main)
  process.exit()
} catch (error) {
  console.error(error)
  process.exit(1)
}
