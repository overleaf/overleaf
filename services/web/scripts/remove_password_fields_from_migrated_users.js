const { db } = require('../app/src/infrastructure/mongojs')
const minimist = require('minimist')

const argv = minimist(process.argv.slice(2))
const commit = argv.commit !== undefined

if (!commit) {
  console.log('DOING DRY RUN. TO SAVE CHANGES PASS --commit')
}

function main(callback) {
  const query = { 'overleaf.id': { $exists: true } }
  db.users.count(query, (err, result) => {
    if (err) {
      return callback(err)
    }
    console.log(`>> Count: ${result}`)
    if (!commit) {
      return callback()
    }
    db.users.update(
      query,
      { $unset: { hashedPassword: 1 } },
      { multi: true },
      (err, result) => {
        if (err) {
          return callback(err)
        }
        console.log(`>> Updated users: ${JSON.stringify(result)}`)
        return callback()
      }
    )
  })
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
