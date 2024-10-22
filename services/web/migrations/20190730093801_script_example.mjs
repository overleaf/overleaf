/* eslint-disable no-unused-vars */

/*
 * Example migration for a script:
 *
 * This migration demonstrates how to run a script. In this case, the example
 * script will print "hello world" if there are no users in the users collection
 * or "hello <name>", when User.findOne() finds something.
 */

import runScript from '../scripts/example/script_for_migration.mjs'

const tags = []

const migrate = async client => {
  const { db } = client
  await runScript()
}

const rollback = async client => {
  const { db } = client
}

export default {
  tags,
  migrate,
  rollback,
}
