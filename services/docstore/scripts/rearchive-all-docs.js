const DocArchiveManager = require('../app/js/DocArchiveManager').promises
const MongoManager = require('../app/js/MongoManager').promises
const { getCollection, ObjectId } = require('../app/js/mongodb')
const minimist = require('minimist')

async function worker(projectId) {
  try {
    // see if the project needs to be unarchived, and unarchive it
    const archivedDocs = await MongoManager.getArchivedProjectDocs(projectId)
    if (archivedDocs.length) {
      await DocArchiveManager.unArchiveAllDocs(projectId)
    }

    // get the doc content so we can validate it
    const docs = await MongoManager.getProjectsDocs(
      projectId,
      { include_deleted: false },
      { lines: 1 }
    )

    // start archiving in the background while we check the content, if it was archived to begin with
    let archivePromise
    if (archivedDocs.length) {
      archivePromise = DocArchiveManager.archiveAllDocs(projectId)
    }

    let warning = false

    // validate the doc contents and log any warnings to investigate later
    for (const doc of docs) {
      if (!doc.lines) {
        warning = true
        console.error('WARN:', projectId, doc._id, 'has no content')
      }
      // eslint-disable-next-line no-control-regex
      if (doc.lines && doc.lines.some((line) => line.match(/(\r|\u0000)/))) {
        warning = true
        console.error('WARN:', projectId, doc._id, 'has invalid characters')
      }
    }

    // ensure the archive process has finished
    if (archivePromise) {
      await archivePromise
    }

    if (!warning) {
      // log to stderr along with the other output
      console.error('OK:', projectId)
    }
  } catch (err) {
    console.error('ERROR:', projectId, err)
  }
}

async function rearchiveAllDocs() {
  const params = minimist(process.argv.slice(2))
  const maxWorkers = params.w || 1
  console.log(`Starting with ${maxWorkers} workers`)

  // start from an objectId and run in ascending order, so we can resume later
  const query = {}
  const startId = params._[0]
  if (startId) {
    const validator = new RegExp('^[0-9a-fA-F]{24}$')
    if (!validator.test(startId)) {
      console.error('Invalid object id')
      return
    }
    query._id = {
      $gt: ObjectId(startId)
    }
    console.log(`Starting from object ID ${startId}`)
  } else {
    console.log('No object id specified. Starting from the beginning.')
  }

  const results = (await getCollection('projects'))
    .find(query, { _id: 1 })
    .sort({ _id: 1 })
  let jobCount = 0

  // keep going until we run out of projects
  while (true) {
    // get a new project to run a job with
    const project = await results.next()
    // if there are no more projects, wait until all the jobs have finished and exit
    if (!project) {
      // eslint-disable-next-line no-unmodified-loop-condition
      while (jobCount) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      return
    }

    // wait until there are fewer than maxWorkers jobs running
    // eslint-disable-next-line no-unmodified-loop-condition
    while (jobCount >= maxWorkers) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }

    // start a new job in the background and then continue the loop
    ++jobCount
    worker(project._id)
      .then(() => --jobCount)
      .catch(() => {
        console.error('ERROR:', project._id)
        --jobCount
      })
  }
}

if (!module.parent) {
  rearchiveAllDocs()
    .then(() => {
      console.log('Finished!')
      process.exit(0)
    })
    .catch((err) => {
      console.error('Something went wrong:', err)
      process.exit(1)
    })
}
