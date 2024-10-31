import { db } from '../../app/src/infrastructure/mongodb.js'
import { ensureMongoTimeout } from '../helpers/env_variable_helper.mjs'
// Ensure default mongo query timeout has been increased 1h
if (!process.env.MONGO_SOCKET_TIMEOUT) {
  ensureMongoTimeout(360000)
}

async function main() {
  await checkAllProjectsAreMigrated()
  await setAllowDowngradeToFalse()
  await deleteHistoryCollections()
  console.log('Legacy history data cleaned up successfully')
  process.exit(0)
}

async function checkAllProjectsAreMigrated() {
  console.log('checking all projects are migrated to Full Project History')

  const count = await db.projects.countDocuments({
    'overleaf.history.display': { $ne: true },
  })

  if (count === 0) {
    console.log('All projects are migrated to Full Project History')
  } else {
    console.error(
      `There are ${count} projects that are not migrated to Full Project History` +
        ` please complete the migration before running this script again.`
    )
    process.exit(1)
  }
}

async function setAllowDowngradeToFalse() {
  console.log('unsetting `allowDowngrade` flag in all projects')
  await db.projects.updateMany(
    {
      'overleaf.history.id': { $exists: true },
      'overleaf.history.allowDowngrade': true,
    },
    { $unset: { 'overleaf.history.allowDowngrade': 1 } }
  )
  console.log('unsetting `allowDowngrade` flag in all projects - Done')
}

async function deleteHistoryCollections() {
  await gracefullyDropCollection(db.docHistory)
  await gracefullyDropCollection(db.docHistoryIndex)
  await gracefullyDropCollection(db.projectHistoryMetaData)
}

async function gracefullyDropCollection(collection) {
  const collectionName = collection.collectionName
  console.log(`removing \`${collectionName}\` data`)
  try {
    await collection.drop()
  } catch (err) {
    if (err.code === 26) {
      // collection already deleted
      console.log(`removing \`${collectionName}\` data - Already removed`)
    } else {
      throw err
    }
  }
  console.log(`removing \`${collectionName}\` data - Done`)
}

try {
  await main()
} catch (err) {
  console.error(err)
  process.exit(1)
}
