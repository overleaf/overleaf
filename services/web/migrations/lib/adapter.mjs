import Path from 'path'
import mongodb from '../../app/src/infrastructure/mongodb.js'
import Mongoose from '../../app/src/infrastructure/Mongoose.js'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = Path.dirname(__filename)
const { db, waitForDb } = mongodb
const { getNativeDb } = Mongoose

class Adapter {
  constructor(params) {
    if (
      !process.env.SKIP_TAG_CHECK &&
      !process.argv.includes('create') &&
      !(process.argv.includes('-t') || process.argv.includes('--tags'))
    ) {
      console.error("ERROR: must pass tags using '-t' or '--tags', exiting")
      process.exit(1)
    }
    this.params = params || {}
  }

  getTemplatePath() {
    return Path.resolve(__dirname, 'template.mjs')
  }

  async connect() {
    await waitForDb()
    const nativeDb = await getNativeDb()
    return { db, nativeDb }
  }

  disconnect() {
    return Promise.resolve()
  }

  async getExecutedMigrationNames() {
    const { db } = await this.connect()
    const migrations = await db.migrations
      .find({}, { sort: { migratedAt: 1 }, projection: { name: 1 } })
      .toArray()
    return migrations.map(migration => migration.name)
  }

  async markExecuted(name) {
    const { db } = await this.connect()
    return db.migrations.insertOne({
      name,
      migratedAt: new Date(),
    })
  }

  async unmarkExecuted(name) {
    const { db } = await this.connect()
    return db.migrations.deleteOne({
      name,
    })
  }
}

export default Adapter
