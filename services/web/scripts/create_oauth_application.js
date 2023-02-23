const fs = require('fs')
const { OauthApplication } = require('../app/src/models/OauthApplication')
const parseArgs = require('minimist')
const OError = require('@overleaf/o-error')
const { waitForDb } = require('../app/src/infrastructure/mongodb')

async function _loadInputDocument(inputFilePath) {
  console.log(`Loading input from ${inputFilePath}`)
  try {
    const inputText = await fs.promises.readFile(inputFilePath, 'utf-8')
    const inputDocument = JSON.parse(inputText)
    return inputDocument
  } catch (err) {
    throw OError.tag(err, 'error loading input document')
  }
}

async function _writeOauthApplicationDocument(doc) {
  console.log('Waiting for db...')
  await waitForDb()
  const oauthApp = new OauthApplication(doc)
  console.log(
    `Writing document to mongo { name: '${oauthApp.name}', id: '${oauthApp.id}' }`
  )
  await oauthApp.save()
}

async function main() {
  const argv = parseArgs(process.argv.slice(2), {
    string: ['file'],
    unknown: function (arg) {
      console.error('unrecognised argument', arg)
      process.exit(1)
    },
  })
  const doc = await _loadInputDocument(argv.file)
  await _writeOauthApplicationDocument(doc)
}

if (require.main === module) {
  main()
    .then(() => {
      console.log('Done')
      process.exit(0)
    })
    .catch(err => {
      console.error(err)
      process.exit(1)
    })
}
