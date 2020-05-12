const { db } = require('../app/src/infrastructure/mongojs')

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

function main(callback) {
  const query = { spellCheckLanguage: { $in: languages } }
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
