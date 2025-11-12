import { Subscription } from '../app/src/models/Subscription.mjs'
import SubscriptionUpdater from '../app/src/Features/Subscription/SubscriptionUpdater.mjs'
import minimist from 'minimist'
import mongodb from 'mongodb-legacy'

const { ObjectId } = mongodb

const run = async () => {
  for (const id of ids) {
    console.log('id', id)
    const subscription = await Subscription.findOne({ _id: new ObjectId(id) })
    await SubscriptionUpdater.promises.deleteSubscription(
      subscription,
      deleterData
    )
    console.log('Deleted subscription', id)
  }
}

let ids, deleterData
const setup = () => {
  const argv = minimist(process.argv.slice(2))
  ids = argv.ids
  if (!ids) {
    console.error('No ids given')
    process.exit(1)
  }
  ids = ids.split(',')

  const deleterId = argv.deleterId
  if (!deleterId) {
    console.error('No deleterId given')
    process.exit(1)
  }

  deleterData = { id: new ObjectId(deleterId) }
}

setup()

try {
  await run()
  process.exit(0)
} catch (err) {
  console.error('Aiee, something went wrong!', err)
  process.exit(1)
}
