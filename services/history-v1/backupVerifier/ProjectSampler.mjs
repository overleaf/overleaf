// @ts-check
import { objectIdFromDate } from './utils.mjs'
import { db } from '../storage/lib/mongodb.js'
import config from 'config'

const projectsCollection = db.collection('projects')

const HAS_PROJECTS_WITHOUT_HISTORY =
  config.get('hasProjectsWithoutHistory') === 'true'

/**
 * @param {Date} start
 * @param {Date} end
 * @param {number} N
 * @yields {string}
 */
export async function* getProjectsCreatedInDateRangeCursor(start, end, N) {
  yield* getSampleProjectsCursor(N, [
    {
      $match: {
        _id: {
          $gt: objectIdFromDate(start),
          $lte: objectIdFromDate(end),
        },
      },
    },
  ])
}

export async function* getProjectsUpdatedInDateRangeCursor(start, end, N) {
  yield* getSampleProjectsCursor(N, [
    {
      $match: {
        'overleaf.history.updatedAt': {
          $gt: start,
          $lte: end,
        },
      },
    },
  ])
}

/**
 * @typedef {import('mongodb').Document} Document
 */

/**
 *
 * @generator
 * @param {number} N
 * @param {Array<Document>} preSampleAggregationStages
 * @yields {string}
 */
export async function* getSampleProjectsCursor(
  N,
  preSampleAggregationStages = []
) {
  const cursor = projectsCollection.aggregate([
    ...preSampleAggregationStages,
    { $sample: { size: N } },
    { $project: { 'overleaf.history.id': 1 } },
  ])

  let validProjects = 0
  let hasInvalidProject = false

  for await (const project of cursor) {
    if (HAS_PROJECTS_WITHOUT_HISTORY && !project.overleaf?.history?.id) {
      hasInvalidProject = true
      continue
    }
    validProjects++
    yield project.overleaf.history.id.toString()
  }

  if (validProjects === 0 && hasInvalidProject) {
    yield* getSampleProjectsCursor(N, preSampleAggregationStages)
  }
}
