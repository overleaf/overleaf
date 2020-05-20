// Run like this:
// node ... --projectIds ./path/to/file/with/one/projectId/in/each/line

const fs = require('fs')
const { db, ObjectId } = require('../app/src/infrastructure/mongojs')

const minimist = require('minimist')

const argv = minimist(process.argv.slice(2))
const commit = argv.commit !== undefined

if (!argv.projectIds) {
  console.error('--projectIds flag is missing')
  process.exit(100)
}

if (!commit) {
  console.log('DOING DRY RUN. TO SAVE CHANGES PASS --commit')
}

const languages = [
  'am',
  'hy',
  'bn',
  'gu',
  'he',
  'hi',
  'hu',
  'is',
  'kn',
  'ml',
  'mr',
  'or',
  'ss',
  'ta',
  'te',
  'uk',
  'uz',
  'zu',
  'fi'
]

const projectIds = fs
  .readFileSync(argv.projectIds, { encoding: 'utf-8' })
  .split('\n')
  .filter(Boolean)

function main(callback) {
  const query = {
    _id: { $in: projectIds.map(ObjectId) },
    spellCheckLanguage: { $in: languages }
  }
  db.projects.update(
    query,
    { $set: { spellCheckLanguage: '' } },
    { multi: true },
    (err, result) => {
      if (err) {
        return callback(err)
      }
      console.log(`>> Updated projects: ${JSON.stringify(result)}`)
      return callback()
    }
  )
}

if (require.main === module) {
  main(err => {
    if (err) {
      console.error(err)
      return process.exit(1)
    }
    console.log('>> done')
    process.exit(0)
  })
}
