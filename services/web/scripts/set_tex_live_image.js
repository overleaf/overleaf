const Settings = require('settings-sharelatex')
const { ObjectId } = require('mongodb')
const { Project } = require('../app/src/models/Project')

async function main() {
  const { image, projectIds } = parseArgs()
  await updateImage(image, projectIds)
}

function parseArgs() {
  if (process.argv.length < 4) {
    printUsage()
    process.exit(1)
  }
  const image = parseImage(process.argv[2])
  const projectIds = parseProjectIds(process.argv.slice(3))
  return { image, projectIds }
}

function printUsage() {
  console.error('Usage: node set_tex_live_image.js <image> <projectId> ...')
}

function parseImage(image) {
  const allowedImageNames = Settings.allowedImageNames.map(x => x.imageName)
  if (!allowedImageNames.includes(image)) {
    console.error(`Unknown image: ${image}`)
    console.error('Please use one of:')
    for (const allowedImage of allowedImageNames) {
      console.error(`    - ${allowedImage}`)
    }
    process.exit(1)
  }
  return image
}

function parseProjectIds(projectIds) {
  const oids = []
  for (const projectId of projectIds) {
    let oid
    try {
      oid = ObjectId(projectId)
    } catch (err) {
      console.error(`Invalid project id: ${projectId}`)
      process.exit(1)
    }
    oids.push(oid)
  }
  return oids
}

async function updateImage(image, projectIds) {
  const res = await Project.updateMany(
    { _id: { $in: projectIds.map(ObjectId) } },
    { $set: { imageName: `quay.io/sharelatex/${image}` } }
  ).exec()
  console.log(`Found ${res.n} out of ${projectIds.length} projects`)
  console.log(`Modified ${res.nModified} projects`)
}

main()
  .then(() => {
    process.exit()
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
