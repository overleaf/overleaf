import Path from 'node:path'
import Adapter from '../../lib/adapter.mjs'

// The adapter aborts unless a tag is passed on argv, a CLI-only guard.
process.env.SKIP_TAG_CHECK = '1'

const adapter = new Adapter({
  dir: Path.resolve(import.meta.dirname, '../..'),
  migrationExtension: 'mjs',
})

console.log(JSON.stringify(await adapter._getMigrationTags(process.argv[2])))

// lib/mongodb.mjs connects when imported and nothing here needs the connection.
process.exit(0)
