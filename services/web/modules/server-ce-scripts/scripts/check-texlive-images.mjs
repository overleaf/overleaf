import { db } from '../../../app/src/infrastructure/mongodb.mjs'

async function readImagesInUse() {
  const projectCount = await db.projects.countDocuments()
  if (projectCount === 0) {
    return []
  }
  const images = await db.projects.distinct('imageName')

  if (!images || images.length === 0 || images.includes(null)) {
    console.error(`'project.imageName' is not set for some projects`)
    console.error(
      `Set SKIP_TEX_LIVE_CHECK=true in config/variables.env, restart the instance and run 'bin/run-script scripts/backfill_project_image_name.mjs' to initialise TexLive image in existing projects.`
    )
    console.error(
      `After running the script, remove SKIP_TEX_LIVE_CHECK from config/variables.env and restart the instance.`
    )
    process.exit(1)
  }
  return images
}

function checkIsServerPro() {
  if (process.env.OVERLEAF_IS_SERVER_PRO !== 'true') {
    console.log('Running Overleaf Community Edition, skipping TexLive checks')
    process.exit(0)
  }
}

function checkSandboxedCompilesAreEnabled() {
  if (process.env.SANDBOXED_COMPILES !== 'true') {
    console.log('Sandboxed compiles disabled, skipping TexLive checks')
    process.exit(0)
  }
}

function checkTexLiveEnvVariablesAreProvided() {
  if (
    !process.env.TEX_LIVE_DOCKER_IMAGE ||
    !process.env.ALL_TEX_LIVE_DOCKER_IMAGES
  ) {
    console.error(
      'Sandboxed compiles require TEX_LIVE_DOCKER_IMAGE and ALL_TEX_LIVE_DOCKER_IMAGES being set.'
    )
    process.exit(1)
  }
}

async function main() {
  if (process.env.SKIP_TEX_LIVE_CHECK === 'true') {
    console.log(`SKIP_TEX_LIVE_CHECK=true, skipping TexLive images check`)
    process.exit(0)
  }

  checkIsServerPro()
  checkSandboxedCompilesAreEnabled()
  checkTexLiveEnvVariablesAreProvided()

  const allTexLiveImages = process.env.ALL_TEX_LIVE_DOCKER_IMAGES.split(',')

  if (!allTexLiveImages.includes(process.env.TEX_LIVE_DOCKER_IMAGE)) {
    console.error(
      `TEX_LIVE_DOCKER_IMAGE must be included in ALL_TEX_LIVE_DOCKER_IMAGES`
    )
    process.exit(1)
  }

  const currentImages = await readImagesInUse()

  const danglingImages = []
  for (const image of currentImages) {
    if (!allTexLiveImages.includes(image)) {
      danglingImages.push(image)
    }
  }
  if (danglingImages.length > 0) {
    danglingImages.forEach(image =>
      console.error(
        `${image} is currently in use but it's not included in ALL_TEX_LIVE_DOCKER_IMAGES`
      )
    )
    console.error(
      `Set SKIP_TEX_LIVE_CHECK=true in config/variables.env, restart the instance and run 'bin/run-script scripts/update_project_image_name.js <dangling_image> <new_image>' to update projects to a new image.`
    )
    console.error(
      `After running the script, remove SKIP_TEX_LIVE_CHECK from config/variables.env and restart the instance.`
    )
    process.exit(1)
  }

  console.log('Done.')
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
