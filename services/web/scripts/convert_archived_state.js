const _ = require('lodash')

const WRITE_CONCURRENCY = parseInt(process.env.WRITE_CONCURRENCY, 10) || 10

const { batchedUpdate } = require('./helpers/batchedUpdate')
const { promiseMapWithLimit } = require('../app/src/util/promises')

// $ node scripts/convert_archived_state.js FIRST,SECOND
const STAGE = process.argv.pop()

async function main() {
  if (STAGE.includes('FIRST')) {
    await batchedUpdate(
      'projects',
      { archived: false },
      {
        $set: { archived: [] },
      }
    )

    console.error('Done, with first part')
  }

  if (STAGE.includes('SECOND')) {
    await batchedUpdate('projects', { archived: true }, performUpdate, {
      _id: 1,
      owner_ref: 1,
      collaberator_refs: 1,
      readOnly_refs: 1,
      tokenAccessReadAndWrite_refs: 1,
      tokenAccessReadOnly_refs: 1,
    })

    console.error('Done, with second part')
  }
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch(error => {
    console.error({ error })
    process.exit(1)
  })

async function performUpdate(collection, nextBatch) {
  await promiseMapWithLimit(WRITE_CONCURRENCY, nextBatch, project =>
    setArchived(collection, project)
  )
}

async function setArchived(collection, project) {
  const archived = calculateArchivedArray(project)

  return collection.updateOne(
    { _id: project._id },
    {
      $set: { archived },
    }
  )
}

function calculateArchivedArray(project) {
  return _.unionWith(
    [project.owner_ref],
    project.collaberator_refs,
    project.readOnly_refs,
    project.tokenAccessReadAndWrite_refs,
    project.tokenAccessReadOnly_refs,
    _objectIdEquals
  )
}

function _objectIdEquals(firstVal, secondVal) {
  // For use as a comparator for unionWith
  return firstVal.toString() === secondVal.toString()
}
