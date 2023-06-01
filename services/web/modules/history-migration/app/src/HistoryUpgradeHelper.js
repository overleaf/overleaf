const { ObjectId } = require('mongodb')
const {
  db,
  READ_PREFERENCE_SECONDARY,
} = require('../../../../app/src/infrastructure/mongodb')
const Settings = require('@overleaf/settings')

const ProjectHistoryHandler = require('../../../../app/src/Features/Project/ProjectHistoryHandler')
const HistoryManager = require('../../../../app/src/Features/History/HistoryManager')
const ProjectHistoryController = require('./ProjectHistoryController')
const ProjectEntityHandler = require('../../../../app/src/Features/Project/ProjectEntityHandler')
const ProjectEntityUpdateHandler = require('../../../../app/src/Features/Project/ProjectEntityUpdateHandler')
const DocumentUpdaterHandler = require('../../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler')

// Timestamp of when 'Enable history for SL in background' release
const ID_WHEN_FULL_PROJECT_HISTORY_ENABLED =
  Settings.apis.project_history?.idWhenFullProjectHistoryEnabled // was '5a8d8a370000000000000000'
const DATETIME_WHEN_FULL_PROJECT_HISTORY_ENABLED =
  ID_WHEN_FULL_PROJECT_HISTORY_ENABLED
    ? new ObjectId(ID_WHEN_FULL_PROJECT_HISTORY_ENABLED).getTimestamp()
    : null

async function countProjects(query = {}) {
  const count = await db.projects.countDocuments(query)
  return count
}

async function countDocHistory(query = {}) {
  const count = await db.docHistory.countDocuments(query)
  return count
}

async function findProjects(query = {}, projection = {}) {
  const projects = await db.projects.find(query).project(projection).toArray()
  return projects
}

async function determineProjectHistoryType(project) {
  if (project.overleaf && project.overleaf.history) {
    if (project.overleaf.history.upgradeFailed) {
      return 'UpgradeFailed'
    }
    if (project.overleaf.history.conversionFailed) {
      return 'ConversionFailed'
    }
  }
  if (
    project.overleaf &&
    project.overleaf.history &&
    project.overleaf.history.id
  ) {
    if (project.overleaf.history.display) {
      // v2: full project history, do nothing
      return 'V2'
    } else {
      if (projectCreatedAfterFullProjectHistoryEnabled(project)) {
        // IF project initialised after full project history enabled for all projects
        //    THEN project history should contain all information we need, without intervention
        return 'V1WithoutConversion'
      } else {
        // ELSE SL history may predate full project history
        //    THEN delete full project history and convert their SL history to full project history
        // --
        // TODO: how to verify this, can get rough start date of SL history, but not full project history
        const preserveHistory = await shouldPreserveHistory(project)
        const anyDocHistory = await anyDocHistoryExists(project)
        const anyDocHistoryIndex = await anyDocHistoryIndexExists(project)
        if (preserveHistory) {
          if (anyDocHistory || anyDocHistoryIndex) {
            // if SL history exists that we need to preserve, then we must convert
            return 'V1WithConversion'
          } else {
            // otherwise just upgrade without conversion
            return 'V1WithoutConversion'
          }
        } else {
          // if preserveHistory false, then max 7 days of SL history
          // but v1 already record to both histories, so safe to upgrade
          return 'V1WithoutConversion'
        }
      }
    }
  } else {
    const preserveHistory = await shouldPreserveHistory(project)
    const anyDocHistory = await anyDocHistoryExists(project)
    const anyDocHistoryIndex = await anyDocHistoryIndexExists(project)
    if (anyDocHistory || anyDocHistoryIndex) {
      // IF there is SL history ->
      if (preserveHistory) {
        // that needs to be preserved:
        //    THEN initialise full project history and convert SL history to full project history
        return 'NoneWithConversion'
      } else {
        return 'NoneWithTemporaryHistory'
      }
    } else {
      // ELSE there is not any SL history ->
      //    THEN initialise full project history and sync with current content
      return 'NoneWithoutConversion'
    }
  }
}

async function upgradeProject(project, options) {
  const historyType = await determineProjectHistoryType(project)
  if (historyType === 'V2') {
    return { historyType, upgraded: true }
  }
  const upgradeFn = getUpgradeFunctionForType(historyType)
  if (!upgradeFn) {
    return { error: 'unsupported history type' }
  }
  if (options.forceClean) {
    try {
      const projectId = project._id
      // delete any existing history stored in the mongo backend
      await HistoryManager.promises.deleteProject(projectId, projectId)
      // unset overleaf.history.id to prevent the migration script from failing on checks
      await db.projects.updateOne(
        { _id: projectId },
        { $unset: { 'overleaf.history.id': '' } }
      )
    } catch (err) {
      // failed to delete existing history, but we can try to continue
    }
  }
  const result = await upgradeFn(project, options)
  result.historyType = historyType
  return result
}

// Do upgrades/conversion:

function getUpgradeFunctionForType(historyType) {
  return UpgradeFunctionMapping[historyType]
}

const UpgradeFunctionMapping = {
  NoneWithoutConversion: doUpgradeForNoneWithoutConversion,
  UpgradeFailed: doUpgradeForNoneWithoutConversion,
  ConversionFailed: doUpgradeForNoneWithConversion,
  V1WithoutConversion: doUpgradeForV1WithoutConversion,
  V1WithConversion: doUpgradeForV1WithConversion,
  NoneWithConversion: doUpgradeForNoneWithConversion,
  NoneWithTemporaryHistory: doUpgradeForNoneWithConversion,
}

async function doUpgradeForV1WithoutConversion(project) {
  await db.projects.updateOne(
    { _id: project._id },
    {
      $set: {
        'overleaf.history.display': true,
        'overleaf.history.upgradedAt': new Date(),
        'overleaf.history.upgradeReason': `v1-without-sl-history`,
      },
    }
  )
  return { upgraded: true }
}

async function doUpgradeForV1WithConversion(project) {
  const result = {}
  const projectId = project._id
  // migrateProjectHistory expects project id as a string
  const projectIdString = project._id.toString()
  try {
    // We treat these essentially as None projects, the V1 history is irrelevant,
    // so we will delete it, and do a conversion as if we're a None project
    await ProjectHistoryController.deleteProjectHistory(projectIdString)
    await ProjectHistoryController.migrateProjectHistory(projectIdString)
  } catch (err) {
    // if migrateProjectHistory fails, it cleans up by deleting
    // the history and unsetting the history id
    // therefore a failed project will still look like a 'None with conversion' project
    result.error = err
    await db.projects.updateOne(
      { _id: projectId },
      {
        $set: {
          'overleaf.history.conversionFailed': true,
        },
      }
    )
    return result
  }
  await db.projects.updateOne(
    { _id: projectId },
    {
      $set: {
        'overleaf.history.upgradeReason': `v1-with-conversion`,
      },
      $unset: {
        'overleaf.history.upgradeFailed': true,
        'overleaf.history.conversionFailed': true,
      },
    }
  )
  result.upgraded = true
  return result
}

async function doUpgradeForNoneWithoutConversion(project) {
  const result = {}
  const projectId = project._id
  try {
    // Logic originally from ProjectHistoryHandler.ensureHistoryExistsForProject
    // However sends a force resync project to project history instead
    // of a resync request to doc-updater
    let historyId = await ProjectHistoryHandler.promises.getHistoryId(projectId)
    if (historyId == null) {
      historyId = await HistoryManager.promises.initializeProject(projectId)
      if (historyId != null) {
        await ProjectHistoryHandler.promises.setHistoryId(projectId, historyId)
      }
    }
    // tell document updater to clear the docs, they will be reloaded with any new history id
    await DocumentUpdaterHandler.promises.flushProjectToMongoAndDelete(
      projectId
    )
    // now resync the project
    await HistoryManager.promises.resyncProject(projectId, {
      force: true,
      origin: { kind: 'history-migration' },
    })
    await HistoryManager.promises.flushProject(projectId)
  } catch (err) {
    result.error = err
    await db.projects.updateOne(
      { _id: project._id },
      {
        $set: {
          'overleaf.history.upgradeFailed': true,
        },
      }
    )
    return result
  }
  await db.projects.updateOne(
    { _id: project._id },
    {
      $set: {
        'overleaf.history.display': true,
        'overleaf.history.upgradedAt': new Date(),
        'overleaf.history.upgradeReason': `none-without-conversion`,
      },
    }
  )
  result.upgraded = true
  return result
}

async function doUpgradeForNoneWithConversion(project, options = {}) {
  const result = {}
  const projectId = project._id
  // migrateProjectHistory expects project id as a string
  const projectIdString = project._id.toString()
  try {
    if (options.convertLargeDocsToFile) {
      result.convertedDocCount = await convertLargeDocsToFile(
        projectId,
        options.userId
      )
    }
    await ProjectHistoryController.migrateProjectHistory(
      projectIdString,
      options.migrationOptions
    )
  } catch (err) {
    // if migrateProjectHistory fails, it cleans up by deleting
    // the history and unsetting the history id
    // therefore a failed project will still look like a 'None with conversion' project
    result.error = err
    // We set a failed flag so future runs of the script don't automatically retry
    await db.projects.updateOne(
      { _id: projectId },
      {
        $set: {
          'overleaf.history.conversionFailed': true,
        },
      }
    )
    return result
  }
  await db.projects.updateOne(
    { _id: projectId },
    {
      $set: {
        'overleaf.history.upgradeReason':
          `none-with-conversion` + options.reason ? `/${options.reason}` : ``,
      },
      $unset: {
        'overleaf.history.upgradeFailed': true,
        'overleaf.history.conversionFailed': true,
      },
    }
  )
  result.upgraded = true
  return result
}

// Util

function projectCreatedAfterFullProjectHistoryEnabled(project) {
  if (DATETIME_WHEN_FULL_PROJECT_HISTORY_ENABLED == null) {
    return false
  } else {
    return (
      project._id.getTimestamp() >= DATETIME_WHEN_FULL_PROJECT_HISTORY_ENABLED
    )
  }
}

async function shouldPreserveHistory(project) {
  return await db.projectHistoryMetaData.findOne(
    {
      $and: [
        { project_id: { $eq: project._id } },
        { preserveHistory: { $eq: true } },
      ],
    },
    { readPreference: READ_PREFERENCE_SECONDARY }
  )
}

async function anyDocHistoryExists(project) {
  return await db.docHistory.findOne(
    { project_id: { $eq: project._id } },
    {
      projection: { _id: 1 },
      readPreference: READ_PREFERENCE_SECONDARY,
    }
  )
}

async function anyDocHistoryIndexExists(project) {
  return await db.docHistoryIndex.findOne(
    { project_id: { $eq: project._id } },
    {
      projection: { _id: 1 },
      readPreference: READ_PREFERENCE_SECONDARY,
    }
  )
}

async function convertLargeDocsToFile(projectId, userId) {
  const docs = await ProjectEntityHandler.promises.getAllDocs(projectId)
  let convertedDocCount = 0
  for (const doc of Object.values(docs)) {
    const sizeBound = JSON.stringify(doc.lines)
    if (docIsTooLarge(sizeBound, doc.lines, Settings.max_doc_length)) {
      await ProjectEntityUpdateHandler.promises.convertDocToFile(
        projectId,
        doc._id,
        userId,
        null
      )
      convertedDocCount++
    }
  }
  return convertedDocCount
}

// check whether the total size of the document in characters exceeds the
// maxDocLength.
//
// Copied from document-updater:
// https://github.com/overleaf/internal/blob/74adfbebda5f3c2c37d9937f0db5c4106ecde492/services/document-updater/app/js/Limits.js#L18
function docIsTooLarge(estimatedSize, lines, maxDocLength) {
  if (estimatedSize <= maxDocLength) {
    return false // definitely under the limit, no need to calculate the total size
  }
  // calculate the total size, bailing out early if the size limit is reached
  let size = 0
  for (const line of lines) {
    size += line.length + 1 // include the newline
    if (size > maxDocLength) return true
  }
  // since we didn't hit the limit in the loop, the document is within the allowed length
  return false
}

module.exports = {
  countProjects,
  countDocHistory,
  findProjects,
  determineProjectHistoryType,
  getUpgradeFunctionForType,
  upgradeProject,
  convertLargeDocsToFile,
  anyDocHistoryExists,
  anyDocHistoryIndexExists,
  doUpgradeForNoneWithConversion,
}
