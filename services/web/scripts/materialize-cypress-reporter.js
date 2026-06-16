#!/usr/bin/env node
'use strict'
/**
 * Materialize Cypress reporter packages (and their transitive dependencies)
 * into a real node_modules tree so that Cypress's Electron process (which uses
 * PackherdModuleLoader, NOT Yarn PnP hooks) can load them.
 *
 * Builds a NESTED node_modules structure (each package gets its own
 * node_modules/ for its deps) to avoid version conflicts from flat dedup.
 *
 * The target-dir must be OUTSIDE the PnP workspace root — otherwise PnP
 * intercepts requires from the materialized packages and blocks undeclared deps.
 *
 * Usage:  yarn node scripts/materialize-cypress-reporter.js <target-dir>
 */

const path = require('path')
const fs = require('fs')

const targetDir = process.argv[2]
if (!targetDir) {
  console.error(
    'Usage: yarn node scripts/materialize-cypress-reporter.js <target-dir>'
  )
  process.exit(1)
}

const pnp = require('module').findPnpApi(__filename)
if (!pnp) {
  console.log('Not running under PnP — nothing to do.')
  process.exit(0)
}

let totalCopied = 0

// PnP patches readFileSync/readdirSync/statSync but NOT cpSync.
// Manual recursive copy to read from virtual/zip paths.
function copyRecursive(src, dest) {
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true })
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry))
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, fs.readFileSync(src))
  }
}

function resolvePkgDir(pkgName, issuer) {
  // Use resolveToUnqualified to get the package directory without going
  // through the package's exports map (which may not expose package.json).
  let pkgDir = pnp.resolveToUnqualified(pkgName, issuer + '/')
  if (pkgDir.endsWith('/')) pkgDir = pkgDir.slice(0, -1)
  return pkgDir
}

/**
 * Materialize a package and its deps into destDir/node_modules/pkgName.
 * Each package's own deps get nested under its own node_modules/.
 */
function materializeRecursive(pkgName, issuer, destNodeModules, seen) {
  // Dedupe by destination path to avoid infinite loops, but allow the same
  // package to appear in multiple locations (nested node_modules).
  const key = `${destNodeModules}/${pkgName}`
  if (seen.has(key)) return
  seen.add(key)

  let pkgDir
  try {
    pkgDir = resolvePkgDir(pkgName, issuer)
  } catch {
    return // optional/missing dep
  }

  const dest = path.join(destNodeModules, pkgName)
  copyRecursive(pkgDir, dest)
  totalCopied++

  const pkg = JSON.parse(
    fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')
  )
  const deps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
  ]

  if (deps.length > 0) {
    const nestedNodeModules = path.join(dest, 'node_modules')
    for (const dep of deps) {
      materializeRecursive(dep, pkgDir, nestedNodeModules, seen)
    }
  }
}

const rootNodeModules = path.resolve(targetDir, 'node_modules')
const seen = new Set()
const topLevel = [
  'cypress-multi-reporters',
  'mocha-junit-reporter',
  'typescript',
]

for (const pkg of topLevel) {
  try {
    materializeRecursive(pkg, process.cwd(), rootNodeModules, seen)
  } catch (e) {
    console.warn(`Warning: could not materialize ${pkg}: ${e.message}`)
  }
}

console.log(`Materialized ${totalCopied} packages into ${rootNodeModules}`)
