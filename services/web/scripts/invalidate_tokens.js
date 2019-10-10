const { db, ObjectId } = require('../app/src/infrastructure/mongojs')
const minimist = require('minimist')
const _ = require('lodash')
const argv = minimist(process.argv.slice(2))
const commit = argv.commit !== undefined
const projectIds = argv._.map(x => {
  return ObjectId(x)
})

if (!commit) {
  console.log('Doing dry run without --commit')
}
console.log('checking', projectIds.length, 'projects')
db.projects.find(
  {
    _id: { $in: projectIds }
  },
  (err, affectedProjects) => {
    if (err) {
      throw err
    }
    console.log('Found ' + affectedProjects.length + ' affected projects')
    affectedProjects.forEach(x => {
      console.log(
        JSON.stringify(
          _.pick(x, [
            '_id',
            'owner_ref',
            'tokenAccessReadOnly_refs',
            'tokenAccessReadAndWrite_refs'
          ])
        )
      )
    })
    if (!commit) {
      console.log('dry run, not updating')
      process.exit(0)
    } else {
      db.projects.update(
        {
          _id: {
            $in: affectedProjects.map(x => {
              return x._id
            })
          }
        },
        {
          $set: {
            publicAccesLevel: 'private', // note the spelling in the db is publicAccesLevel (with one 's')
            tokenAccessReadOnly_refs: [],
            tokenAccessReadAndWrite_refs: []
          }
        },
        {
          multi: true
        },
        (err, result) => {
          console.log('err', err, 'result', result)
          db.close()
          setTimeout(() => {
            process.exit(0)
          }, 5000)
        }
      )
    }
  }
)
