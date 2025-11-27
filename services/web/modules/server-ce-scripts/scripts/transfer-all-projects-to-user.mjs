import { ObjectId } from '../../../app/src/infrastructure/mongodb.mjs'
import minimist from 'minimist'
import OwnershipTransferHandler from '../../../app/src/Features/Collaborators/OwnershipTransferHandler.mjs'
import UserGetter from '../../../app/src/Features/User/UserGetter.mjs'
import EmailHelper from '../../../app/src/Features/Helpers/EmailHelper.mjs'

const args = minimist(process.argv.slice(2), {
  string: ['from-user', 'to-user'],
})

/**
 * @param {string} flag
 * @return {Promise<string>}
 */
async function resolveUser(flag) {
  const raw = args[flag]
  if (!raw) throw new Error(`missing parameter --${flag}`)
  if (ObjectId.isValid(raw)) return raw
  const email = EmailHelper.parseEmail(raw)
  if (!email) throw new Error(`invalid email --${flag}=${raw}`)
  const user = await UserGetter.promises.getUser({ email }, { _id: 1 })
  if (!user)
    throw new Error(`user with email --${flag}=${email} does not exist`)
  return user._id.toString()
}

async function main() {
  const fromUserId = await resolveUser('from-user')
  const toUserId = await resolveUser('to-user')
  await OwnershipTransferHandler.promises.transferAllProjectsToUser({
    fromUserId,
    toUserId,
    ipAddress: '0.0.0.0',
  })
}

main()
  .then(() => {
    console.error('Done.')
    process.exit(0)
  })
  .catch(err => {
    console.error('---')
    console.error(err)
    process.exit(1)
  })
