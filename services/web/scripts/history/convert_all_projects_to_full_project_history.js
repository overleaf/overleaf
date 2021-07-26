const VERBOSE_LOGGING = process.env.VERBOSE_LOGGING === 'true'
const VERBOSE_PROJECT_NAMES = process.env.VERBOSE_PROJECT_NAMES === 'true'
const WRITE_CONCURRENCY = parseInt(process.env.WRITE_CONCURRENCY, 10) || 5
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 100
// persist fallback in order to keep batchedUpdate in-sync
process.env.BATCH_SIZE = BATCH_SIZE

const { ReadPreference, ObjectId } = require('mongodb')
const { db } = require('../../app/src/infrastructure/mongodb')
const { promiseMapWithLimit } = require('../../app/src/util/promises')
const { batchedUpdate } = require('../helpers/batchedUpdate')

const COUNT = {
  v2: 0,
  v1WithoutConversion: 0,
  v1WithConversion: 0,
  NoneWithoutConversion: 0,
  NoneWithConversion: 0,
  NoneWithPreserveHistoryFalse: 0,
  DeletedIdNeedsConversion: 0,
  DeletedIdWithoutConversion: 0,
}

// Timestamp of when 'Enable history for SL in background' release
const ID_WHEN_FULL_PROJECT_HISTORY_ENABLED = '5a8d8a370000000000000000'
const OBJECT_ID_WHEN_FULL_PROJECT_HISTORY_ENABLED = new ObjectId(
  ID_WHEN_FULL_PROJECT_HISTORY_ENABLED
)
const DATETIME_WHEN_FULL_PROJECT_HISTORY_ENABLED = OBJECT_ID_WHEN_FULL_PROJECT_HISTORY_ENABLED.getTimestamp()

async function processBatch(_, projects) {
  await promiseMapWithLimit(WRITE_CONCURRENCY, projects, processProject)
  console.log(COUNT)
}

async function processProject(project) {
  if (
    project.overleaf &&
    project.overleaf.history &&
    project.overleaf.history.id
  ) {
    if (project.overleaf.history.display) {
      // v2: full project history, do nothing, (query shoudln't include any, but we should stlll check?)
      COUNT.v2 += 1
      if (VERBOSE_LOGGING) {
        console.log(
          `project ${
            project[VERBOSE_PROJECT_NAMES ? 'name' : '_id']
          } is already v2`
        )
      }
    } else {
      if (projectCreatedAfterFullProjectHistoryEnabled(project)) {
        // IF project initialised after full project history enabled for all projects
        //    THEN project history should contain all information we need, without intervention
        await doUpgradeForV1WithoutConversion(project) // CASE #1
      } else {
        // ELSE SL history may predate full project history
        //    THEN delete full project history and convert their SL history to full project history
        // --
        // TODO: how to verify this, can get rough start date of SL history, but not full project history
        // TODO: check that SL history exists for project, if it doesn't then
        //    we can just upgrade without conversion?
        await doUpgradeForV1WithConversion(project) // CASE #4
      }
    }
  } else if (
    project.overleaf &&
    project.overleaf.history &&
    project.overleaf.history.deleted_id
  ) {
    // TODO: has history key but deleted_id in place of id - these do exist...
    // Is it safe to handle these like we would an Upgrade for None history state?
    const preserveHistory = await shouldPreserveHistory(project)
    const anyDocHistory = await anyDocHistoryExists(project)
    const anyDocHistoryIndex = await anyDocHistoryIndexExists(project)
    const needsConversion =
      preserveHistory && (anyDocHistory || anyDocHistoryIndex)
    if (needsConversion) {
      COUNT.DeletedIdNeedsConversion += 1
    } else {
      COUNT.DeletedIdWithoutConversion += 1
    }
    if (VERBOSE_LOGGING) {
      console.log(
        `project ${
          project[VERBOSE_PROJECT_NAMES ? 'name' : '_id']
        } has deleted_id and and ${
          needsConversion
            ? 'requires conversion'
            : 'does not require conversion'
        }`
      )
    }
  } else {
    const preserveHistory = await shouldPreserveHistory(project)
    if (preserveHistory) {
      const anyDocHistory = await anyDocHistoryExists(project)
      const anyDocHistoryIndex = await anyDocHistoryIndexExists(project)
      // TODO: also need to check docHistoryIndex???
      if (anyDocHistory || anyDocHistoryIndex) {
        // IF there is SL history ->
        //    THEN initialise full project history and convert SL history to full project history
        await doUpgradeForNoneWithConversion(project) // CASE #3
      } else {
        // ELSE there is not any SL history ->
        //    THEN initialise full project history and sync with current content
        await doUpgradeForNoneWithoutConversion(project) // CASE #2
      }
    } else {
      // -> FREE plan, (7 day history?)
      // TODO: can we ignore these if we enable in background and stage rollout
      COUNT.NoneWithPreserveHistoryFalse += 1
      if (VERBOSE_LOGGING) {
        console.log(
          `project ${
            project[VERBOSE_PROJECT_NAMES ? 'name' : '_id']
          } is None but preserveHistory is false`
        )
      }
    }
  }
}

// Helpers:

async function shouldPreserveHistory(project) {
  return await db.projectHistoryMetaData.findOne(
    {
      $and: [
        { project_id: { $eq: project._id } },
        { preserveHistory: { $eq: true } },
      ],
    },
    { readPreference: ReadPreference.SECONDARY }
  )
}

async function anyDocHistoryExists(project) {
  return await db.docHistory.findOne(
    { project_id: { $eq: project._id } },
    {
      projection: { _id: 1 },
      readPreference: ReadPreference.SECONDARY,
    }
  )
}

async function anyDocHistoryIndexExists(project) {
  return await db.docHistoryIndex.findOne(
    { project_id: { $eq: project._id } },
    {
      projection: { _id: 1 },
      readPreference: ReadPreference.SECONDARY,
    }
  )
}

function projectCreatedAfterFullProjectHistoryEnabled(project) {
  return (
    project._id.getTimestamp() >= DATETIME_WHEN_FULL_PROJECT_HISTORY_ENABLED
  )
}

// Do upgrades/conversion:

async function doUpgradeForV1WithoutConversion(project) {
  // Simply:
  // project.overleaf.history.display = true
  // TODO: Sanity check(?)
  COUNT.v1WithoutConversion += 1
  if (VERBOSE_LOGGING) {
    console.log(
      `project ${
        project[VERBOSE_PROJECT_NAMES ? 'name' : '_id']
      } is v1 and does not require conversion`
    )
  }
}

async function doUpgradeForV1WithConversion(project) {
  // Delete full project history (or create new)
  // Use conversion script to convert SL history to full project history
  COUNT.v1WithConversion += 1
  if (VERBOSE_LOGGING) {
    console.log(
      `project ${
        project[VERBOSE_PROJECT_NAMES ? 'name' : '_id']
      } is v1 and requires conversion`
    )
  }
}

async function doUpgradeForNoneWithoutConversion(project) {
  // Initialise full project history with current content
  COUNT.NoneWithoutConversion += 1
  if (VERBOSE_LOGGING) {
    console.log(
      `project ${
        project[VERBOSE_PROJECT_NAMES ? 'name' : '_id']
      } is None and and does not require conversion`
    )
  }
}

async function doUpgradeForNoneWithConversion(project) {
  // Initialise full project history
  // Use conversion script to convert SL history to full project history
  COUNT.NoneWithConversion += 1
  if (VERBOSE_LOGGING) {
    console.log(
      `project ${
        project[VERBOSE_PROJECT_NAMES ? 'name' : '_id']
      } is None and and requires conversion`
    )
  }
}

async function main() {
  const projection = {
    _id: 1,
    overleaf: 1,
  }
  if (VERBOSE_PROJECT_NAMES) {
    projection.name = 1
  }
  await batchedUpdate(
    'projects',
    { 'overleaf.history.display': { $ne: true } },
    processBatch,
    projection
  )
  console.log('Final')
  console.log(COUNT)
}

main()
  .then(() => {
    console.error('Done.')
    process.exit(0)
  })
  .catch(error => {
    console.error({ error })
    process.exit(1)
  })
