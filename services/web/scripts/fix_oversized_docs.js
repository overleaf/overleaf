const fs = require('fs')
const minimist = require('minimist')
const { waitForDb, ObjectId } = require('../app/src/infrastructure/mongodb')
const DocstoreManager = require('../app/src/Features/Docstore/DocstoreManager')
const FileStoreHandler = require('../app/src/Features/FileStore/FileStoreHandler')
const FileWriter = require('../app/src/infrastructure/FileWriter')
const ProjectEntityMongoUpdateHandler = require('../app/src/Features/Project/ProjectEntityMongoUpdateHandler')
const ProjectLocator = require('../app/src/Features/Project/ProjectLocator')
const RedisWrapper = require('@overleaf/redis-wrapper')
const Settings = require('@overleaf/settings')

const opts = parseArgs()
const redis = RedisWrapper.createClient(Settings.redis.web)

function parseArgs() {
  const args = minimist(process.argv.slice(2), {
    boolean: ['commit', 'ignore-ranges'],
  })

  const projectIds = args._
  if (projectIds.length === 0) {
    console.log(`Usage: ${process.argv[1]} [OPTS] PROJECT_ID

Options:
    --commit          Actually convert oversized docs to binary files
    --max-doc-size    Size over which docs are converted to binary files
    --ignore-ranges   Convert docs even if they contain ranges
`)
    process.exit(0)
  }

  const commit = args.commit
  const ignoreRanges = args['ignore-ranges']
  const maxDocSize = args['max-doc-size']
    ? parseInt(args['max-doc-size'], 10)
    : 2 * 1024 * 1024

  return { projectIds, commit, ignoreRanges, maxDocSize }
}

async function main() {
  await waitForDb()
  for (const projectId of opts.projectIds) {
    await processProject(projectId)
  }
  if (!opts.commit) {
    console.log('This was a dry run. Re-run with --commit to apply changes')
  }
}

async function processProject(projectId) {
  const docIds = await getDocIds(projectId)
  for (const docId of docIds) {
    await processDoc(projectId, docId)
  }
}

async function processDoc(projectId, docId) {
  const doc = await getDoc(projectId, docId)
  const size = doc.lines.reduce((sum, line) => sum + line.length + 1, 0)
  if (size > opts.maxDocSize) {
    if (
      !opts.ignoreRanges &&
      ((doc.ranges.comments && doc.ranges.comments.length > 0) ||
        (doc.ranges.changes && doc.ranges.changes.length > 0))
    ) {
      console.log(
        `Skipping doc ${doc.path} in project ${projectId} because it has ranges`
      )
      return
    }
    console.log(
      `Converting doc ${doc.path} in project ${projectId} to binary (${size} bytes)`
    )
    if (opts.commit) {
      const fileRef = await sendDocToFilestore(projectId, doc)
      await ProjectEntityMongoUpdateHandler.promises.replaceDocWithFile(
        ObjectId(projectId),
        ObjectId(docId),
        fileRef
      )
      await deleteDocFromMongo(projectId, doc)
      await deleteDocFromRedis(projectId, docId)
    }
  }
}

async function getDocIds(projectId) {
  const docIds = await redis.smembers(`DocsIn:{${projectId}}`)
  return docIds
}

async function getDoc(projectId, docId) {
  const lines = await redis.get(`doclines:{${docId}}`)
  const ranges = await redis.get(`Ranges:{${docId}}`)
  const { path } = await ProjectLocator.promises.findElement({
    project_id: projectId,
    element_id: docId,
    type: 'doc',
  })
  return {
    id: docId,
    lines: JSON.parse(lines),
    ranges: ranges ? JSON.parse(ranges) : {},
    path: path.fileSystem,
  }
}

async function sendDocToFilestore(projectId, doc) {
  const basename = doc.path.split('/').pop()
  const tmpFilePath = await FileWriter.promises.writeLinesToDisk(
    projectId,
    doc.lines
  )
  try {
    const { fileRef } = await FileStoreHandler.promises.uploadFileFromDisk(
      projectId,
      { name: basename, rev: doc.version + 1 },
      tmpFilePath
    )
    return fileRef
  } finally {
    fs.promises.unlink(tmpFilePath)
  }
}

async function deleteDocFromMongo(projectId, doc) {
  const basename = doc.path.split('/').pop()
  const deletedAt = new Date()
  await DocstoreManager.promises.deleteDoc(
    projectId,
    doc.id,
    basename,
    deletedAt
  )
}

async function deleteDocFromRedis(projectId, docId) {
  await redis.del(
    `Blocking:{${docId}}`,
    `doclines:{${docId}}`,
    `DocOps:{${docId}}`,
    `DocVersion:{${docId}}`,
    `DocHash:{${docId}}`,
    `ProjectId:{${docId}}`,
    `Ranges:{${docId}}`,
    `UnflushedTime:{${docId}}`,
    `Pathname:{${docId}}`,
    `ProjectHistoryId:{${docId}}`,
    `ProjectHistoryType:{${docId}}`,
    `PendingUpdates:{${docId}}`,
    `lastUpdatedAt:{${docId}}`,
    `lastUpdatedBy:{${docId}}`
  )
  await redis.srem(`DocsIn:{${projectId}}`, projectId)
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
