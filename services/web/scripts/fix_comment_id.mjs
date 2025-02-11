// @ts-check

import minimist from 'minimist'
import DocstoreManager from '../app/src/Features/Docstore/DocstoreManager.js'
import { db, ObjectId } from '../app/src/infrastructure/mongodb.js'

const OPTS = parseArgs()

function usage() {
  console.error('Usage: node fix_comment_id.mjs [--commit] PROJECT_ID...')
}

function parseArgs() {
  const args = minimist(process.argv.slice(2), {
    boolean: ['commit'],
  })
  if (args._.length === 0) {
    usage()
    process.exit(0)
  }
  return {
    projectIds: args._,
    commit: args.commit,
  }
}

async function processProject(projectId) {
  console.log(`Processing project ${projectId}...`)
  const docRanges = await DocstoreManager.promises.getAllRanges(projectId)

  let commentsUpdated = 0
  for (const doc of docRanges) {
    const updateCommentsInDoc = await processDoc(doc)
    commentsUpdated += updateCommentsInDoc
  }
  if (OPTS.commit) {
    console.log(`${commentsUpdated} comments updated`)
  }
}

async function processDoc(doc) {
  let commentsUpdated = 0
  for (const comment of doc.ranges.comments ?? []) {
    if (comment.op.t !== comment.id) {
      console.log(
        `updating comment id ${comment.id} to ${comment.op.t} in doc ${doc._id} ...`
      )
      if (OPTS.commit) {
        await db.docs.updateOne(
          { _id: new ObjectId(doc._id) },
          {
            $set: {
              'ranges.comments.$[element].id': new ObjectId(comment.op.t),
            },
          },
          {
            arrayFilters: [
              { 'element.op.t': { $eq: new ObjectId(comment.op.t) } },
            ],
          }
        )
        commentsUpdated += 1
      } else {
        console.log(
          `Would update comment id ${comment.id} to ${comment.op.t} (dry run)`
        )
      }
    }
  }
  return commentsUpdated
}

// Main loop
for (const projectId of OPTS.projectIds) {
  await processProject(projectId)
}
if (!OPTS.commit) {
  console.log('This was a dry run. Rerun with --commit to apply changes')
}
process.exit(0)
