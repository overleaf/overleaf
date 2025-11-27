// @ts-check
import minimist from 'minimist'
import { batchedUpdateWithResultHandling } from '@overleaf/mongo-utils/batchedUpdate.js'
import { db } from '../app/src/infrastructure/mongodb.mjs'

const argv = minimist(process.argv.slice(2))
const commit = argv.commit !== undefined
let imageName = argv._[0]

function usage() {
  console.log(
    'Usage: node backfill_project_image_name.mjs --commit <texlive_docker_image>'
  )
  console.log(
    'Argument <texlive_docker_image> is not required when TEX_LIVE_DOCKER_IMAGE is set.'
  )
  console.log(
    'Environment variable ALL_TEX_LIVE_DOCKER_IMAGES must contain <texlive_docker_image>.'
  )
}

if (!imageName && process.env.TEX_LIVE_DOCKER_IMAGE) {
  imageName = process.env.TEX_LIVE_DOCKER_IMAGE
}

if (!imageName) {
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

if (!process.env.ALL_TEX_LIVE_DOCKER_IMAGES.split(',').includes(imageName)) {
  console.error(
    `Error: ALL_TEX_LIVE_DOCKER_IMAGES doesn't contain ${imageName}`
  )
  usage()
  process.exit(1)
}

if (!commit) {
  console.error('DOING DRY RUN. TO SAVE CHANGES PASS --commit')
  process.exit(1)
}

batchedUpdateWithResultHandling(
  db.projects,
  { imageName: null },
  { $set: { imageName } }
)
