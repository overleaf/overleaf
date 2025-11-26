import minimist from 'minimist'
import { fileURLToPath } from 'url'
import { db } from '../../../app/src/infrastructure/mongodb.mjs'

const filename = fileURLToPath(import.meta.url)

async function main() {
  const argv = minimist(process.argv.slice(2), {
    string: ['user-id', 'old-name', 'new_name'],
  })

  const { 'user-id': userId, 'old-name': oldName, 'new-name': newName } = argv
  if (!userId || !oldName || !newName) {
    console.error(
      `Usage: node ${filename} --user-id=5a9414f259776c7900b300e6 --old-name=my-folder --new-name=my-folder-renamed`
    )
    process.exit(101)
  }

  await db.tags.updateOne(
    { name: oldName, user_id: userId },
    { $set: { name: newName } }
  )
}

main()
  .then(() => {
    console.error('Done.')
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
