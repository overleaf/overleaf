import fs from 'node:fs'
import minimist from 'minimist'
import { parse } from 'csv'
import Stream from 'node:stream/promises'
import SubscriptionGroupHandler from '../app/src/Features/Subscription/SubscriptionGroupHandler.mjs'
import { Subscription } from '../app/src/models/Subscription.mjs'
import { InvalidEmailError } from '../app/src/Features/Errors/Errors.js'

function usage() {
  console.log(
    'Usage: node scripts/add_subscription_members_csv.mjs -f <filename> -i <inviter_id> -s <subscription_id> [options]'
  )
  console.log('Required arguments:')
  console.log(
    '  -s, --subscriptionId <id>        The ID of the subscription to update'
  )
  console.log(
    '  -i, --inviterId <id>             The ID of the user sending the invites'
  )
  console.log(
    '  -f, --filename <filename>        The path to the file to read data from'
  )
  console.log('Options:')
  console.log(
    '  --commit, -c                     Whether changes should be committed to the DB invites should be sent/revoked'
  )
  console.log(
    '  --removeMembersNotIncluded -r    Remove members that are not in the CSV. Disabled when managed users are enabled for the subscription'
  )
  console.log(
    '  --verbose, -v                    Prints detailed information about the affected group members'
  )
  console.log('  -h, --help                       Show this help message')
  process.exit(0)
}

let {
  commit,
  removeMembersNotIncluded,
  inviterId,
  subscriptionId,
  filename,
  help,
  verbose,
} = minimist(process.argv.slice(2), {
  string: ['filename', 'subscriptionId', 'inviterId'],
  boolean: ['commit', 'removeMembersNotIncluded', 'help', 'verbose'],
  alias: {
    commit: 'c',
    removeMembersNotIncluded: 'r',
    filename: 'f',
    help: 'h',
    inviterId: 'i',
    subscriptionId: 's',
    verbose: 'v',
  },
  default: {
    commit: false,
    removeMembersNotIncluded: false,
    help: false,
    verbose: false,
  },
})

const EMAIL_FIELD = 'email'

if (help) {
  usage()
  process.exit(0)
}

if (!subscriptionId || !inviterId || !filename) {
  usage()
  process.exit(1)
}

async function processRows(rows) {
  const emailList = []
  for await (const row of rows) {
    const email = row[EMAIL_FIELD]
    if (email) {
      emailList.push(email)
    }
  }
  if (emailList.length === 0) {
    console.error(`CSV error: 'email' column doesn't exist or it's empty'`)
    process.exit(1)
  }

  let previewResult

  try {
    previewResult =
      await SubscriptionGroupHandler.promises.updateGroupMembersBulk(
        inviterId,
        subscriptionId,
        emailList,
        { removeMembersNotIncluded }
      )
  } catch (error) {
    if (error instanceof InvalidEmailError) {
      console.error(`${filename} contains invalid email addresses:`)
      console.error(error.info?.invalidEmails.join(','))
      process.exit(1)
    } else {
      throw error
    }
  }

  console.log('Result Preview:')
  logResult(previewResult)

  if (previewResult.newTotalCount > previewResult.membersLimit) {
    console.warn(
      'WARNING: the invite list has reached the membership limit (newTotalCount > membersLimit)'
    )
    if (commit) {
      console.error(`Invites won't be sent and users won't be deleted`)
    }
    process.exit(1)
  }

  if (!commit) {
    console.log(
      'this is a dry-run, use the --commit option to send the invite and make any DB changes'
    )
    return
  }

  console.log(
    `Sending invites to ${previewResult.emailsToSendInvite.length} email addresses`
  )

  if (previewResult.membersToRemove > 0) {
    console.log(
      `${previewResult.membersToRemove.length} members will be removed from the group`
    )
  }

  const commitResult =
    await SubscriptionGroupHandler.promises.updateGroupMembersBulk(
      inviterId,
      subscriptionId,
      emailList,
      { removeMembersNotIncluded, commit }
    )

  console.log('Result:')
  logResult(commitResult)
}

function logResult(result) {
  console.log(
    JSON.stringify(
      {
        ...result,
        emailsToSendInvite: verbose
          ? result.emailsToSendInvite
          : result.emailsToSendInvite.length,
        membersToRemove: verbose
          ? result.membersToRemove
          : result.membersToRemove.length,
        emailsToRevokeInvite: verbose
          ? result.emailsToRevokeInvite
          : result.emailsToRevokeInvite.length,
      },
      null,
      2
    )
  )
}

async function main() {
  const subscription = await Subscription.findOne({
    _id: subscriptionId,
  }).exec()
  if (!subscription) {
    console.error(`subscription with id=${subscriptionId} not found`)
    process.exit(1)
  }
  if (subscription.managedUsersEnabled && removeMembersNotIncluded) {
    console.warn(
      `subscription with id=${subscriptionId} has 'managedUsersEnabled=true'` +
        `'--removeMembersNotIncluded' has been disabled`
    )
    removeMembersNotIncluded = false
  }
  await Stream.pipeline(
    fs.createReadStream(filename),
    parse({
      columns: true,
    }),
    processRows
  )
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
