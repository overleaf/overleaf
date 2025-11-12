import Settings from '@overleaf/settings'
import mongodb from 'mongodb-legacy'
import { Project } from '../app/src/models/Project.mjs'
import { scriptRunner } from './lib/ScriptRunner.mjs'

const { ObjectId } = mongodb

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
      oid = new ObjectId(projectId)
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
    { _id: { $in: projectIds.map(id => new ObjectId(id)) } },
    { $set: { imageName: `quay.io/sharelatex/${image}` } }
  ).exec()
  console.log(`Found ${res.matchedCount} out of ${projectIds.length} projects`)
  console.log(`Modified ${res.modifiedCount} projects`)
}

try {
  await scriptRunner(main)
  process.exit()
} catch (error) {
  console.error(error)
  process.exit(1)
}
