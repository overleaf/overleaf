const Path = require('path')
const {
  addCollection,
  waitForDb,
  db,
} = require('../../app/src/infrastructure/mongodb')

class Adapter {
  constructor(params) {
    if (!(process.argv.includes('-t') || process.argv.includes('--tags'))) {
      console.error("ERROR: must pass tags using '-t' or '--tags', exiting")
      process.exit(1)
    }
    this.params = params || {}
  }

  getTemplatePath() {
    return Path.resolve(__dirname, 'template.js')
  }

  async connect() {
    await waitForDb()

    await addCollection('projectImportFailures')
    await addCollection('samllog')
    await addCollection('user')

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
    return db.migrations.insertOne({
      name: name,
      migratedAt: new Date(),
    })
  }

  async unmarkExecuted(name) {
    return db.migrations.deleteOne({
      name: name,
    })
  }
}

module.exports = Adapter
