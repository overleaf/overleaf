const _ = require('lodash')

const WRITE_CONCURRENCY = parseInt(process.env.WRITE_CONCURRENCY, 10) || 10

const { db } = require('../app/src/infrastructure/mongodb')
const { batchedUpdate } = require('./helpers/batchedUpdate')
const { promiseMapWithLimit } = require('../app/src/util/promises')

// $ node scripts/convert_archived_state.js FIRST,SECOND

async function main(STAGE) {
  for (const FIELD of ['archived', 'trashed']) {
    if (STAGE.includes('FIRST')) {
      await batchedUpdate(
        'projects',
        { [FIELD]: false },
        {
          $set: { [FIELD]: [] },
        }
      )

      console.error('Done, with first part for field:', FIELD)
    }

    if (STAGE.includes('SECOND')) {
      await batchedUpdate(
        'projects',
        { [FIELD]: true },
        async function performUpdate(nextBatch) {
          await promiseMapWithLimit(
            WRITE_CONCURRENCY,
            nextBatch,
            async project => {
              try {
                await upgradeFieldToArray({ project, FIELD })
              } catch (err) {
                console.error(project._id, err)
                throw err
              }
            }
          )
        },
        {
          _id: 1,
          owner_ref: 1,
          collaberator_refs: 1,
          readOnly_refs: 1,
          tokenAccessReadAndWrite_refs: 1,
          tokenAccessReadOnly_refs: 1,
        }
      )

      console.error('Done, with second part for field:', FIELD)
    }
  }
}

module.exports = main

if (require.main === module) {
  main(process.argv.pop())
    .then(() => {
      process.exit(0)
    })
    .catch(error => {
      console.error({ error })
      process.exit(1)
    })
}

async function upgradeFieldToArray({ project, FIELD }) {
  return db.projects.updateOne(
    { _id: project._id },
    {
      $set: { [FIELD]: getAllUserIds(project) },
    }
  )
}

function getAllUserIds(project) {
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
