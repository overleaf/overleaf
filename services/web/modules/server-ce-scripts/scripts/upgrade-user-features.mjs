import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import { db } from '../../../app/src/infrastructure/mongodb.mjs'
import FeaturesHelper from '../../../app/src/Features/Subscription/FeaturesHelper.mjs'
import { fileURLToPath } from 'url'
const DRY_RUN = !process.argv.includes('--dry-run=false')
const { mergeFeatures, compareFeatures } = FeaturesHelper
async function main(DRY_RUN, defaultFeatures) {
  logger.info({ defaultFeatures }, 'default features')

  const cursor = db.users.find(
    {},
    { projection: { _id: 1, email: 1, features: 1 } }
  )
  for await (const user of cursor) {
    const newFeatures = mergeFeatures(user.features, defaultFeatures)
    const diff = compareFeatures(newFeatures, user.features)
    if (Object.keys(diff).length > 0) {
      logger.warn(
        {
          userId: user._id,
          email: user.email,
          oldFeatures: user.features,
          newFeatures,
        },
        'user features upgraded'
      )

      if (!DRY_RUN) {
        await db.users.updateOne(
          { _id: user._id },
          { $set: { features: newFeatures } }
        )
      }
    }
  }
}

export default main

const filename = fileURLToPath(import.meta.url)

if (filename === process.argv[1]) {
  if (DRY_RUN) {
    console.error('---')
    console.error('Dry-run enabled, use --dry-run=false to commit changes')
    console.error('---')
  }
  main(DRY_RUN, Settings.defaultFeatures)
    .then(() => {
      console.log('Done.')
      process.exit(0)
    })
    .catch(error => {
      console.error({ error })
      process.exit(1)
    })
}
