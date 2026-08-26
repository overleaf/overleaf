import assert from 'node:assert/strict'
import Path from 'node:path'
import { describe, it } from 'node:test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const MIGRATIONS_DIR = Path.resolve(import.meta.dirname, '../..')
const FIXTURE = Path.join(
  MIGRATIONS_DIR,
  'test',
  'fixtures',
  'reportMigrationTags.mjs'
)

// The adapter opens a Mongo connection when imported, so the tags are read in a subprocess that exits as soon as it has them.
async function readMigrationTags(name) {
  const { stdout } = await execFileAsync(process.execPath, [FIXTURE, name], {
    cwd: MIGRATIONS_DIR,
  })
  // @overleaf/settings logs to stdout when it loads, so the tags are on the last line.
  return JSON.parse(stdout.trim().split('\n').pop())
}

describe('Adapter', function () {
  describe('_getMigrationTags', function () {
    it('reads the tags a migration declares', async function () {
      assert.deepEqual(
        await readMigrationTags('20190720165251_create_migrations'),
        ['server-ce', 'server-pro', 'saas']
      )
    })

    it('reads no tags for a migration that is recorded as executed but no longer on disk', async function () {
      assert.deepEqual(
        await readMigrationTags('20190730093801_script_example'),
        []
      )
    })
  })
})
