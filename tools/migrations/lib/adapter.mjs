import Path from 'node:path'
import { db } from './mongodb.mjs'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = Path.dirname(__filename)

class Adapter {
  constructor(params) {
    if (
      !process.env.SKIP_TAG_CHECK &&
      !process.argv.includes('create') &&
      !(process.argv.includes('-t') || process.argv.includes('--tag'))
    ) {
      console.error("ERROR: must pass tags using '-t' or '--tag', exiting")
      process.exit(1)
    }
    this.params = params || {}
  }

  getTemplatePath() {
    return Path.resolve(__dirname, '20000000000000_template.mjs')
  }

  async connect() {
    return { db }
  }

  disconnect() {
    return Promise.resolve()
  }

  async getExecutedMigrationNames() {
    const migrations = await db.migrations
      .find({}, { sort: { migratedAt: 1 }, projection: { name: 1 } })
      .toArray()
    return migrations.map(migration => migration.name)
  }

  async markExecuted(name) {
    return await db.migrations.insertOne({
      name,
      migratedAt: new Date(),
    })
  }

  async unmarkExecuted(name) {
    return await db.migrations.deleteOne({
      name,
    })
  }
}

export default Adapter
