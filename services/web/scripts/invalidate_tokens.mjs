import { db, ObjectId } from '../app/src/infrastructure/mongodb.mjs'
import minimist from 'minimist'
const argv = minimist(process.argv.slice(2))
const commit = argv.commit !== undefined
const projectIds = argv._.map(x => {
  return new ObjectId(x)
})

if (!commit) {
  console.log('Doing dry run without --commit')
}
console.log('checking', projectIds.length, 'projects')

const affectedProjects = await db.projects
  .find(
    { _id: { $in: projectIds } },
    {
      projection: {
        _id: 1,
        owner_ref: 1,
        tokenAccessReadOnly_refs: 1,
        tokenAccessReadAndWrite_refs: 1,
      },
    }
  )
  .toArray()
console.log('Found ' + affectedProjects.length + ' affected projects')
affectedProjects.forEach(project => {
  console.log(JSON.stringify(project))
})
if (!commit) {
  console.log('dry run, not updating')
  process.exit(0)
} else {
  try {
    const result = await db.projects.updateMany(
      { _id: { $in: affectedProjects.map(project => project._id) } },
      {
        $set: {
          publicAccesLevel: 'private', // note the spelling in the db is publicAccesLevel (with one 's')
          tokenAccessReadOnly_refs: [],
          tokenAccessReadAndWrite_refs: [],
        },
      }
    )
    console.log('result', JSON.stringify(result))
    process.exit(0)
  } catch (err) {
    console.error('err', err)
    process.exit(1)
  }
}
