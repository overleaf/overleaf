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
 * @return {Promise<Array<string>>}
 */
export async function selectProjectsInDateRange(start, end, N) {
  let projects = await projectsCollection
    .aggregate([
      {
        $match: {
          _id: {
            $gt: objectIdFromDate(start),
            $lte: objectIdFromDate(end),
          },
        },
      },
      { $sample: { size: N } },
      { $project: { 'overleaf.history.id': 1 } },
    ])
    .toArray()
  if (HAS_PROJECTS_WITHOUT_HISTORY) {
    projects = projects.filter(p => Boolean(p.overleaf?.history?.id))
    if (projects.length === 0) {
      // Very unlucky sample. Try again.
      return await selectProjectsInDateRange(start, end, N)
    }
  }
  return projects.map(p => p.overleaf.history.id.toString())
}

export async function* getSampleProjectsCursor(N) {
  const cursor = projectsCollection.aggregate([
    { $sample: { size: N } },
    { $project: { 'overleaf.history.id': 1 } },
  ])

  let validProjects = 0

  for await (const project of cursor) {
    if (HAS_PROJECTS_WITHOUT_HISTORY) {
      continue
    }
    validProjects++
    yield project.overleaf.history.id.toString()
  }

  if (validProjects === 0) {
    yield* getSampleProjectsCursor(N)
  }
}
