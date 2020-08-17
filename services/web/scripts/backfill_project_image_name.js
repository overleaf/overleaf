const minimist = require('minimist')
const { batchedUpdateWithResultHandling } = require('./helpers/batchedUpdate')

const argv = minimist(process.argv.slice(2))
const commit = argv.commit !== undefined

if (!commit) {
  console.error('DOING DRY RUN. TO SAVE CHANGES PASS --commit')
  process.exit(1)
}

batchedUpdateWithResultHandling(
  'projects',
  { imageName: null },
  { $set: { imageName: 'quay.io/sharelatex/texlive-full:2014.2' } }
)
