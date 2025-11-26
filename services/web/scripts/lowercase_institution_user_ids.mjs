import { db } from '../app/src/infrastructure/mongodb.mjs'
import minimist from 'minimist'
import UserGetter from '../app/src/Features/User/UserGetter.mjs'
import fs from 'node:fs'
import { scriptRunner } from './lib/ScriptRunner.mjs'

function usage() {
  console.log(
    'Usage: node lowercase_institution_user_ids.mjs -i <institution-id>'
  )
  console.log(
    'Converts external user IDs to lowercase for all users in an institute'
  )
  console.log('Options:')
  console.log(
    '  --institution-id, -i                     Institution ID to update'
  )
  console.log(
    '  --dry-run, -d                            Finds users with non-lowercase id but does not do any updates'
  )
  console.log(
    '  --file, -f                               A file that contains external user ids to be updated'
  )

  console.log(
    '                                           If not provided, the script will update all the users within the institution that have upper case external user id'
  )
  console.log(
    '  -h, --help                               Show this help message'
  )
  process.exit(0)
}

const {
  'dry-run': dryRun,
  'institution-id': providerId,
  help,
  file,
} = minimist(process.argv.slice(2), {
  string: ['institution-id', 'file'],
  boolean: ['dry-run', 'help'],
  alias: {
    'institution-id': 'i',
    'dry-run': 'd',
    help: 'h',
    file: 'f',
  },
  default: {
    'dry-run': true,
  },
})

async function main() {
  if (help || !providerId) {
    usage()
  }

  let externalUserIdsToUpdate = null
  if (file) {
    const lines = fs.readFileSync(file, 'utf8').split('\n')
    externalUserIdsToUpdate = new Set(lines)
  }

  const users = await UserGetter.promises.getSsoUsersAtInstitution(providerId, {
    _id: 1,
    samlIdentifiers: 1,
  })

  let userToUpdate = 0
  let userUpdated = 0

  for (const user of users) {
    const matchingIdentifier = user.samlIdentifiers.find(
      u => u.providerId === providerId
    )
    const lowercaseId = matchingIdentifier.externalUserId.toLowerCase()

    // skip if external user id is already in lower case
    if (lowercaseId === matchingIdentifier.externalUserId) {
      continue
    }

    // skip if an id file is provided but current external user id is not in the file
    if (externalUserIdsToUpdate && !externalUserIdsToUpdate.has(lowercaseId)) {
      continue
    }

    userToUpdate = userToUpdate + 1
    console.log(
      `${user._id},${matchingIdentifier.externalUserId},${lowercaseId}`
    )

    if (dryRun) {
      continue
    }

    try {
      await db.users.updateOne(
        { _id: user._id, 'samlIdentifiers.providerId': providerId },
        { $set: { 'samlIdentifiers.$.externalUserId': lowercaseId } }
      )
      userUpdated = userUpdated + 1
    } catch (error) {
      console.error(error)
    }
  }

  if (dryRun) {
    console.log(`DRY RUN: ${userToUpdate} users will be updated`)
  } else {
    console.log(`UPDATED: ${userUpdated}/${userToUpdate} users successfully`)
  }
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
