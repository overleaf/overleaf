import {
  db,
  READ_PREFERENCE_SECONDARY,
  waitForDb,
  ObjectId,
} from '../app/src/infrastructure/mongodb.js'
import minimist from 'minimist'
import InstitutionHubsController from '../modules/metrics/app/src/InstitutionHubsController.js'

function usage() {
  console.log(
    `Usage: node export_institution_chat.js --institution <id> --from <date> --to <date> [--pretty] [--help]

    --institution=ID
      The V1 institution ID

    --from=DATE
      The start of the report period. Specified as an ISO 8601 date string
      (e.g. 2024-08-01T00:00:00.000Z)

    --to=DATE
      The end of the report period. Specified as an ISO 8601 date string
      (e.g. 2024-09-01T00:00:00.000Z)

    --help
      Prints this help page\n`
  )
}

function parseArgs() {
  const argv = minimist(process.argv.slice(2), {
    string: ['institution', 'from', 'to'],
    bool: ['help'],
    default: {
      help: false,
    },
  })
  if (argv.help) {
    usage()
    process.exit(0)
  }

  if (!argv.institution || !argv.from || !argv.to) {
    usage()
    process.exit(1)
  }

  const institutionId = parseInt(argv.institution, 10)
  const from = new Date(argv.from).getTime()
  const to = new Date(argv.to).getTime()

  if (to < from) {
    console.error('The end date must be after the start date.')
    process.exit(1)
  }

  return { institutionId, from, to }
}

async function fetchInstitutionAndAffiliations(institutionId) {
  const { json: affiliations } =
    await InstitutionHubsController.promises.v1InstitutionsApi(
      institutionId,
      'csv_affiliations'
    )
  return affiliations.filter(({ license }) => license === 'pro_plus')
}

function getUserMappings(affiliations) {
  const entries = affiliations.map(({ user_id: userId, email }) => [
    userId,
    email,
  ])
  return new Map(entries)
}

async function main() {
  const args = parseArgs()
  await waitForDb()
  const affiliations = await fetchInstitutionAndAffiliations(args.institutionId)
  const userMappings = getUserMappings(affiliations)

  const projectRecords = []

  for (const [userId, email] of userMappings.entries()) {
    projectRecords.push(...(await processUser(userId, email, args)))
  }
  console.log(JSON.stringify(projectRecords, null, 2))
}

async function processUser(userId, email, args) {
  const projectsOwnedByUser = db.projects.find(
    { owner_ref: new ObjectId(userId) },
    { projection: { name: 1 }, readPreference: READ_PREFERENCE_SECONDARY }
  )
  const projectRecords = []
  for await (const project of projectsOwnedByUser) {
    const hasMessages = await processProject(project, args)
    if (hasMessages) {
      projectRecords.push({
        projectId: project._id,
        owner: email,
      })
    }
  }
  return projectRecords
}

async function processProject(project, args) {
  const { _id: projectId } = project
  const globalRoom = await db.rooms.findOne(
    {
      project_id: new ObjectId(projectId),
      thread_id: { $exists: false },
    },
    { readPreference: READ_PREFERENCE_SECONDARY }
  )
  if (!globalRoom) {
    return null
  }
  const messages = await db.messages
    .find(
      {
        room_id: globalRoom._id,
        timestamp: { $gte: args.from, $lte: args.to },
      },
      {
        projection: {
          user_id: 1,
          timestamp: 1,
        },
        readPreference: READ_PREFERENCE_SECONDARY,
      }
    )
    .sort({ timestamp: 1 })
    .toArray()
  return messages.length > 0
}

try {
  await main()
  process.exit(0)
} catch (err) {
  console.error(err)
  process.exit(1)
}
