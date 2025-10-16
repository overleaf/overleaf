import Adapter from '../../../tools/migrations/lib/adapter.mjs'
import { promises as fs } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function main(args) {
  if (
    !args ||
    args.length === 0 ||
    args.includes('help') ||
    args.includes('--help') ||
    args.includes('-h')
  ) {
    console.log('')
    console.log('usage: node ./scripts/mark_migration.mjs migration state')
    console.log('')
    console.log('    migration:   name of migration file')
    console.log('    state:       executed | unexecuted')
    console.log('')
    return
  }

  const migration = args[0]
  if (!migration) {
    throw new Error('Error: migration must be supplied')
  }
  const state = args[1]
  if (!state) {
    throw new Error('Error: migration state must be supplied')
  }

  try {
    await fs.access(join(__dirname, '../migrations', `${migration}.mjs`))
  } catch (err) {
    throw new Error(
      `Error: migration ${migration} does not exist on disk: ${err}`
    )
  }

  console.log(`Marking ${migration} as ${state}`)

  process.env.SKIP_TAG_CHECK = 'true'
  const adapter = new Adapter()
  await adapter.connect()
  switch (state) {
    case 'executed':
      await adapter.markExecuted(migration)
      break
    case 'unexecuted':
      await adapter.unmarkExecuted(migration)
      break
    default:
      throw new Error(`invalid state "${state}"`)
  }
  console.log('Done')
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2)
  main(args)
    .then(() => {
      process.exit(0)
    })
    .catch(err => {
      console.error(err)
      process.exit(1)
    })
}
