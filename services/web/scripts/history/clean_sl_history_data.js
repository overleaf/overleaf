const { waitForDb, db } = require('../../app/src/infrastructure/mongodb')

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
  console.log('removing `docHistory` data')
  await db.docHistory.deleteMany({})
  console.log('removing `docHistory` data - Done')

  console.log('removing `docHistoryIndex` data')
  await db.docHistoryIndex.deleteMany({})
  console.log('removing `docHistoryIndex` data - Done')

  console.log('removing `projectHistoryMetaData` data')
  await db.projectHistoryMetaData.deleteMany({})
  console.log('removing `projectHistoryMetaData` data - Done')
}

waitForDb()
  .then(main)
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
