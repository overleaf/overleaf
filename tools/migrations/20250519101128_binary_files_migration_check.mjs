import { setTimeout } from 'node:timers/promises'
import { db } from './lib/mongodb.mjs'
import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro']

const migrate = async () => {
  const nActiveProjects = await db.projects.estimatedDocumentCount()
  const nDeletedProjects = await db.deletedProjects.estimatedDocumentCount()
  if (nActiveProjects === 0 && nDeletedProjects === 0) {
    // Empty database. Skip binary files migration check.
    return
  }
  try {
    await Helpers.assertDependency('20250519101128_binary_files_migration')
  } catch (err) {
    if (err instanceof Helpers.BadMigrationOrder) {
      console.warn('-'.repeat(79))
      console.warn(
        'Please follow the binary files migration before upgrading to Server Pro/CE 6.0.'
      )
      console.warn()
      console.warn(
        '  Docs: https://docs.overleaf.com/on-premises/release-notes/release-notes-5.x.x/binary-files-migration'
      )
      console.warn()
      console.warn('-'.repeat(79))
      await setTimeout(5_000)
      process.exit(1)
    }
    throw err
  }
}

const rollback = async () => {}

export default {
  tags,
  migrate,
  rollback,
}
