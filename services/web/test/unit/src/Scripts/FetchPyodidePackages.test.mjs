import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SERVICE_WEB_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..'
)

describe('fetch-pyodide-packages.mjs', function () {
  it('PYODIDE_VERSION matches the pyodide dependency in package.json', async function () {
    const packageJson = JSON.parse(
      await readFile(path.join(SERVICE_WEB_DIR, 'package.json'), 'utf8')
    )
    const scriptSource = await readFile(
      path.join(SERVICE_WEB_DIR, 'scripts/fetch-pyodide-packages.mjs'),
      'utf8'
    )

    const match = scriptSource.match(/PYODIDE_VERSION\s*=\s*'([^']+)'/)
    expect(match, 'PYODIDE_VERSION constant not found in fetch script').to.not
      .be.null
    const scriptVersion = match[1]
    const packageVersion =
      packageJson.dependencies?.pyodide ?? packageJson.devDependencies?.pyodide

    expect(scriptVersion).to.equal(
      packageVersion,
      'PYODIDE_VERSION in scripts/fetch-pyodide-packages.mjs must match the pyodide version in package.json; bump both together.'
    )
  })
})
