import { db } from '../app/src/infrastructure/mongodb.mjs'
import minimist from 'minimist'
import UserGetter from '../app/src/Features/User/UserGetter.mjs'
import { scriptRunner } from './lib/ScriptRunner.mjs'

function usage() {
  console.log(
    'Usage: node update_institution_user_saml_ids.mjs -i <institution-id> -s <search> [-r <replace>]'
  )
  console.log(
    'Performs string replacement on external user IDs for all users in an institution. A search-and-replace or/and an append operation must be specified.'
  )
  console.log('Options:')
  console.log(
    '  --institution-id, -i                     Institution ID to update'
  )
  console.log('  --search, -s                             String to search for')
  console.log(
    '  --search-regexp                          Regular expression to search for (ignored if --search is provided)'
  )
  console.log(
    '  --replace, -r                            String to replace with (optional, defaults to empty string)'
  )
  console.log(
    '  --append, -a                            String to append at the end'
  )
  console.log(
    '  --dry-run, -d                            Shows changes but does not perform updates'
  )
  console.log(
    '  --help, -h                               Show this help message'
  )
  process.exit(0)
}

const {
  'dry-run': dryRun,
  'institution-id': providerId,
  search,
  'search-regexp': searchRegexp,
  replace,
  append,
  help,
} = minimist(process.argv.slice(2), {
  string: ['institution-id', 'search', 'search-regexp', 'replace'],
  boolean: ['dry-run', 'help'],
  alias: {
    'institution-id': 'i',
    search: 's',
    replace: 'r',
    append: 'a',
    'dry-run': 'd',
    help: 'h',
  },
  default: {
    'dry-run': true,
    replace: '',
  },
})

async function main() {
  const hasSearchOrAppend =
    Boolean(search) || Boolean(searchRegexp) || Boolean(append)
  if (help || !providerId || !hasSearchOrAppend) {
    usage()
  }

  const users = await UserGetter.promises.getSsoUsersAtInstitution(providerId, {
    _id: 1,
    samlIdentifiers: 1,
  })
  console.log('SSO Users found for institution: ' + users.length)

  let usersToUpdate = 0
  let usersUpdated = 0

  for (const user of users) {
    const matchingIdentifier = user.samlIdentifiers.find(
      u => u.providerId === providerId
    )

    if (!matchingIdentifier) {
      continue
    }

    let updatedId
    if (search) {
      updatedId = matchingIdentifier.externalUserId.replaceAll(search, replace)
    } else if (searchRegexp) {
      const regexp = new RegExp(searchRegexp, 'g')
      updatedId = matchingIdentifier.externalUserId.replaceAll(regexp, replace)
    }
    if (append) {
      updatedId = matchingIdentifier.externalUserId + append
    }

    usersToUpdate = usersToUpdate + 1
    console.log(`${user._id},${matchingIdentifier.externalUserId},${updatedId}`)

    if (dryRun) {
      continue
    }

    try {
      await db.users.updateOne(
        { _id: user._id, 'samlIdentifiers.providerId': providerId },
        { $set: { 'samlIdentifiers.$.externalUserId': updatedId } }
      )
      usersUpdated = usersUpdated + 1
    } catch (error) {
      console.error(error)
    }
  }

  if (dryRun) {
    console.log(`DRY RUN: ${usersToUpdate} users will be updated`)
  } else {
    console.log(`UPDATED: ${usersUpdated}/${usersToUpdate} users successfully`)
  }
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
