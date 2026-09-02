import Path from 'node:path'
import { db, auxInternalDb } from './mongodb.mjs'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = Path.dirname(__filename)

// Migrations tagged 'auxiliary' track their execution history on the
// auxiliary Mongo cluster (when one is configured) instead of the primary
// one, so a migration already marked executed against the primary cluster
// still runs once the auxiliary cluster is provisioned. When no auxiliary
// cluster is configured, everything falls back to the primary cluster.
const auxMigrations = auxInternalDb
  ? auxInternalDb.collection('migrations')
  : null

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
    this.migrationTagsByName = new Map()
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

  async _getMigrationTags(name) {
    if (!this.migrationTagsByName.has(name)) {
      const { dir, migrationExtension } = this.params
      const migrationPath = Path.resolve(dir, `${name}.${migrationExtension}`)
      let tags = []
      try {
        const { default: migration } = await import(migrationPath)
        tags = migration.tags || []
      } catch (err) {
        if (err.code !== 'ERR_MODULE_NOT_FOUND') {
          throw err
        }
        // The migration file no longer exists on disk (e.g. it was removed
        // long after it ran everywhere). We can't know if it was tagged
        // 'auxiliary', so it stays tracked as a primary-only migration.
      }
      this.migrationTagsByName.set(name, tags)
    }
    return this.migrationTagsByName.get(name)
  }

  async _migrationsCollectionFor(name) {
    if (!auxMigrations) {
      return db.migrations
    }
    const tags = await this._getMigrationTags(name)
    return tags.includes('auxiliary') ? auxMigrations : db.migrations
  }

  async getExecutedMigrationNames() {
    const primaryNames = (
      await db.migrations.find({}, { projection: { name: 1 } }).toArray()
    ).map(migration => migration.name)

    if (!auxMigrations) {
      return primaryNames.sort()
    }

    // Once an auxiliary cluster is configured, an 'auxiliary'-tagged
    // migration counts as executed only if it ran against the auxiliary
    // cluster — a stale primary-side record from before the auxiliary
    // cluster existed is ignored, so the migration runs again on the
    // auxiliary cluster.
    const nonAuxPrimaryNames = []
    for (const name of primaryNames) {
      const tags = await this._getMigrationTags(name)
      if (!tags.includes('auxiliary')) {
        nonAuxPrimaryNames.push(name)
      }
    }

    const auxNames = (
      await auxMigrations.find({}, { projection: { name: 1 } }).toArray()
    ).map(migration => migration.name)

    return [...nonAuxPrimaryNames, ...auxNames].sort()
  }

  async markExecuted(name) {
    const collection = await this._migrationsCollectionFor(name)
    return await collection.insertOne({
      name,
      migratedAt: new Date(),
    })
  }

  async unmarkExecuted(name) {
    const collection = await this._migrationsCollectionFor(name)
    return await collection.deleteOne({
      name,
    })
  }
}

export default Adapter
