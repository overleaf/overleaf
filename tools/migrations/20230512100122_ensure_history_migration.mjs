import util from 'node:util'
const { promisify } = util
const sleep = promisify(setTimeout)

const tags = ['server-ce', 'server-pro']

const migrate = async client => {
  const { db } = client
  const totalProjects = await db.projects.estimatedDocumentCount()
  if (totalProjects === 0) return

  // Does not use an index.
  const count = await db.projects.countDocuments({
    'overleaf.history.display': { $ne: true },
  })
  if (count > 0) {
    console.error(`
-----------------------------------------------------------------------

  Full Project History migration not completed for ${count} projects.

  Starting with Server Pro/Community Edition version 4.0,
  all projects must use the full project history feature.

  Release 3.5 includes a migration process. Please go back to version
   3.5 and run through the migration process:

    Overleaf Toolkit setups:

      toolkit$ echo "3.5.13" > config/version
      toolkit$ bin/up

    Legacy docker compose setups/Horizontal scaling setups:

      Update the image tag for "services -> sharelatex" to
        Server Pro:        quay.io/sharelatex/sharelatex-pro:3.5.13.
        Community Edition: sharelatex/sharelatex:3.5.13
      Then use "docker compose up" to apply the changes.

  Documentation for the migration process:
    https://github.com/overleaf/overleaf/wiki/Full-Project-History-Migration


  Refusing to start up, exiting in 10s.

-----------------------------------------------------------------------
`)
    await sleep(10_000)

    throw new Error(
      `Found ${count} projects not migrated to Full Project History`
    )
  }
}

const rollback = async client => {
  // Not applicable
}

export default {
  tags,
  migrate,
  rollback,
}
