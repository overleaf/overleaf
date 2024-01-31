const Path = require('path')

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
    return Path.resolve(__dirname, 'template.js')
  }

  async connect() {
    const { waitForDb, db } = require('../../app/src/infrastructure/mongodb')
    const { getNativeDb } = require('../../app/src/infrastructure/Mongoose')
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

module.exports = Adapter
