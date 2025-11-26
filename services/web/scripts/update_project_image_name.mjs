import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'
import { db } from '../app/src/infrastructure/mongodb.mjs'

const oldImage = process.argv[2]
const newImage = process.argv[3]

function usage() {
  console.log(
    `Usage: update_project_image_name.js <old_texlive_image> <new_texlive_image>`
  )
  console.log(
    'Environment variable ALL_TEX_LIVE_DOCKER_IMAGES must contain <new_texlive_image>.'
  )
}

if (!oldImage || !newImage) {
  usage()
  process.exit(1)
}

if (!process.env.ALL_TEX_LIVE_DOCKER_IMAGES) {
  console.error(
    'Error: environment variable ALL_TEX_LIVE_DOCKER_IMAGES is not defined.'
  )
  usage()
  process.exit(1)
}

if (!process.env.ALL_TEX_LIVE_DOCKER_IMAGES.split(',').includes(newImage)) {
  console.error(`Error: ALL_TEX_LIVE_DOCKER_IMAGES doesn't contain ${newImage}`)
  usage()
  process.exit(1)
}

try {
  await batchedUpdate(
    db.projects,
    { imageName: oldImage },
    { $set: { imageName: newImage } }
  )
  console.log('Done')
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
