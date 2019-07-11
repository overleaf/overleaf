//
// Remove the brandVariationId attribute from project documents that have
// that attribute, which value matches the one given.
//
// node scripts/remove_brand_variation_ids.js 3
//   gives a report of project documents that have brandVariationId attribute
//   with value, "3"
//
// node scripts/remove_brand_variation_ids.js 3 --commit true
//   actually removes the brandVariationId attribute from  project documents
//   that have brandVariationId attribute with value, "3"
//
const { db } = require('../app/src/infrastructure/mongojs')
const async = require('async')
const minimist = require('minimist')

const argv = minimist(process.argv.slice(2))
const bvId = argv._[0]
const commit = argv.commit !== undefined
const maxParallel = 4

console.log(
  (commit ? 'Remove' : 'Dry run for remove') +
    ' brandVariationId from projects that have { brandVariationId: ' +
    bvId +
    ' }'
)

var count = 0

db.projects.find(
  { brandVariationId: bvId.toString() },
  { _id: 1, name: 1 },
  processRemovals
)

function processRemovals(err, projects) {
  if (err) throw err
  async.eachLimit(
    projects,
    maxParallel,
    function(project, cb) {
      count += 1
      console.log(
        (commit ? 'Removing' : 'Would remove') +
          ' brandVariationId on project ' +
          project._id +
          ', name: "' +
          project.name +
          '"'
      )
      if (commit) {
        db.projects.update(
          { _id: project._id },
          { $unset: { brandVariationId: '' } },
          cb
        )
      } else {
        async.setImmediate(cb)
      }
    },
    function(err) {
      if (err) {
        console.log('There was a problem: ', err)
      }
      console.log(
        'BrandVariationId ' +
          (commit ? 'removed' : 'would be removed') +
          ' from ' +
          count +
          ' projects'
      )

      process.exit()
    }
  )
}
