import {
  db,
  READ_PREFERENCE_PRIMARY,
  READ_PREFERENCE_SECONDARY,
} from '../app/src/infrastructure/mongodb.mjs'
import { promiseMapWithLimit } from '@overleaf/promise-utils'

async function getDeletedProject(projectId, readPreference) {
  return await db.deletedProjects.findOne(
    { 'deleterData.deletedProjectId': projectId },
    {
      // There is no index on .project. Pull down something small.
      projection: { 'project._id': 1 },
      readPreference,
    }
  )
}

async function getProject(projectId, readPreference) {
  return await db.projects.findOne(
    { _id: projectId },
    {
      // Pulling down an empty object is fine for differentiating with null.
      projection: { _id: 0 },
      readPreference,
    }
  )
}

async function checkProjectExistsWithReadPreference(projectId, readPreference) {
  // NOTE: Possible race conditions!
  // There are two processes which are racing with our queries:
  //  1. project deletion
  //  2. project restoring
  // For 1. we check the projects collection before deletedProjects.
  // If a project were to be delete in this very moment, we should see the
  //  soft-deleted entry which is created before deleting the projects entry.
  // For 2. we check the projects collection after deletedProjects again.
  // If a project were to be restored in this very moment, it is very likely
  //  to see the projects entry again.
  // Unlikely edge case: Restore+Deletion in rapid succession.
  // We could add locking to the ProjectDeleter for ruling ^ out.
  if (await getProject(projectId, readPreference)) {
    // The project is live.
    return true
  }
  const deletedProject = await getDeletedProject(projectId, readPreference)
  if (deletedProject && deletedProject.project) {
    // The project is registered for hard-deletion.
    return true
  }
  if (await getProject(projectId, readPreference)) {
    // The project was just restored.
    return true
  }
  // The project does not exist.
  return false
}

async function checkProjectExistsOnPrimary(projectId) {
  return await checkProjectExistsWithReadPreference(
    projectId,
    READ_PREFERENCE_PRIMARY
  )
}

async function checkProjectExistsOnSecondary(projectId) {
  return await checkProjectExistsWithReadPreference(
    projectId,
    READ_PREFERENCE_SECONDARY
  )
}

async function getHardDeletedProjectIds({
  projectIds,
  READ_CONCURRENCY_PRIMARY,
  READ_CONCURRENCY_SECONDARY,
}) {
  const doubleCheckProjectIdsOnPrimary = []
  async function checkProjectOnSecondary(projectId) {
    if (await checkProjectExistsOnSecondary(projectId)) {
      // Finding a project with secondary confidence is sufficient.
      return
    }
    // At this point, the secondaries deem this project as having orphaned docs.
    doubleCheckProjectIdsOnPrimary.push(projectId)
  }

  const hardDeletedProjectIds = []
  async function checkProjectOnPrimary(projectId) {
    if (await checkProjectExistsOnPrimary(projectId)) {
      // The project is actually live.
      return
    }
    hardDeletedProjectIds.push(projectId)
  }

  await promiseMapWithLimit(
    READ_CONCURRENCY_SECONDARY,
    projectIds,
    checkProjectOnSecondary
  )
  await promiseMapWithLimit(
    READ_CONCURRENCY_PRIMARY,
    doubleCheckProjectIdsOnPrimary,
    checkProjectOnPrimary
  )
  return hardDeletedProjectIds
}

export default {
  getHardDeletedProjectIds,
}
