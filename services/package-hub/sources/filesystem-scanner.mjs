import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import {
  MKTEXLSR_BIN,
  TEXLIVE_ROOT,
  TEXMFLOCAL,
  TLMGR_BIN,
  resolveSafeTexmfPath,
  runCommandSafe,
  validatePackageName,
} from '../security-utils.mjs'
import { stateStore } from '../state-store.mjs'
import { tlpdbCache } from '../tlpdb-parser.mjs'
import { ensureLocalTlnetRepo, syncTlnetTlpdbSha512 } from './texlive-source.mjs'

async function collectFiles(dir, baseDir = dir) {
  const out = []
  let entries = []
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) {
      out.push(...(await collectFiles(full, baseDir)))
    } else if (entry.isFile()) {
      out.push(path.relative(baseDir, full))
    }
  }
  return out
}

/**
 * Scan TEXMFLOCAL & local TLPDB to reconcile DB state with filesystem reality
 * and re-sync any missing persisted packages after container recreation.
 */
export async function scanAndReconcile(ctx = null) {
  await stateStore.init()
  await tlpdbCache.ensureLoaded(true)
  const state = stateStore.getState()
  const report = {
    discoveredCustom: [],
    discoveredCtan: [],
    repairedTexlive: [],
    removedStale: [],
    mktexlsrRan: false,
  }

  // 1. Scan custom packages in texmf-local/tex/latex/custom/<pkg>
  const customRoots = [
    path.join(TEXMFLOCAL, 'tex', 'latex', 'custom'),
    path.join(TEXMFLOCAL, 'bibtex', 'bst', 'custom'),
    path.join(TEXMFLOCAL, 'bibtex', 'bib', 'custom'),
  ]
  const foundCustomNames = new Set()
  for (const rootDir of customRoots) {
    if (!fs.existsSync(rootDir)) continue
    const dirs = await fsp.readdir(rootDir, { withFileTypes: true })
    for (const d of dirs) {
      if (!d.isDirectory() || !validatePackageName(d.name)) continue
      const pkgDir = path.join(rootDir, d.name)
      const files = await collectFiles(pkgDir)
      if (files.length === 0) continue
      foundCustomNames.add(d.name)
      if (!state.customPackages[d.name]) {
        state.customPackages[d.name] = {
          name: d.name,
          version: '1.0.0',
          description: `Discovered on filesystem (${files.join(', ')})`,
          type: files.some(f => f.endsWith('.cls')) ? 'class' : 'style',
          size_kb: 4,
          files,
          targetSubdir: path.relative(TEXMFLOCAL, pkgDir),
          uploaded_by: 'filesystem-scan',
          uploaded_by_email: 'local@filesystem',
          installedAt: new Date().toISOString(),
        }
        report.discoveredCustom.push(d.name)
      }
    }
  }

  // Prune customPackages entries whose directory no longer exists
  for (const existingName of Object.keys(state.customPackages || {})) {
    if (!foundCustomNames.has(existingName)) {
      delete state.customPackages[existingName]
      report.removedStale.push(`custom:${existingName}`)
    }
  }

  // 2. Scan CTAN packages in texmf-local/tex/latex/ctan/<pkg>
  const ctanRoot = path.join(TEXMFLOCAL, 'tex', 'latex', 'ctan')
  const foundCtanNames = new Set()
  if (fs.existsSync(ctanRoot)) {
    const dirs = await fsp.readdir(ctanRoot, { withFileTypes: true })
    for (const d of dirs) {
      if (!d.isDirectory() || !validatePackageName(d.name)) continue
      const pkgDir = path.join(ctanRoot, d.name)
      const files = await collectFiles(pkgDir)
      if (files.length === 0) continue
      foundCtanNames.add(d.name)
      if (!state.ctanPackages[d.name]) {
        state.ctanPackages[d.name] = {
          name: d.name,
          version: 'ctan',
          description: `CTAN package discovered in texmf-local (${files.length} files)`,
          license: 'unknown',
          author: '',
          ctanPath: `/macros/latex/contrib/${d.name}`,
          size_kb: 32,
          files,
          installedAt: new Date().toISOString(),
        }
        report.discoveredCtan.push(d.name)
      }
    }
  }

  for (const existingName of Object.keys(state.ctanPackages || {})) {
    if (!foundCtanNames.has(existingName)) {
      delete state.ctanPackages[existingName]
      report.removedStale.push(`ctan:${existingName}`)
    }
  }

  // 3. Reconcile TeX Live packages recorded in persistent state against current container TLPDB
  // If container was recreated, packages in stateStore.texlivePackages might not be in texlive.tlpdb yet.
  const tlnetCacheDir = path.resolve(
    process.env.PACKAGE_HUB_TLNET_DIR || '/var/lib/overleaf/package-hub/tlnet'
  )
  const missingInTlpdb = []
  for (const pkgName of Object.keys(state.texlivePackages || {})) {
    if (!validatePackageName(pkgName)) continue
    const localEntry = await tlpdbCache.getLocalEntry(pkgName)
    if (!localEntry) {
      missingInTlpdb.push(pkgName)
    }
  }

  if (missingInTlpdb.length > 0 && fs.existsSync(path.join(tlnetCacheDir, 'tlpkg', 'texlive.tlpdb'))) {
    ctx?.appendLog?.(
      `Container reset detected for persisted packages: ${missingInTlpdb.join(', ')}. Re-syncing tlmgr...`
    )
    const availableCached = missingInTlpdb.filter(pkg =>
      fs.existsSync(path.join(tlnetCacheDir, 'archive', `${pkg}.tar.xz`))
    )
    if (availableCached.length > 0) {
      await ensureLocalTlnetRepo()
      await syncTlnetTlpdbSha512()
      const res = await runCommandSafe(
        TLMGR_BIN,
        ['--repository', tlnetCacheDir, '--verify-repo=none', 'install', ...availableCached],
        { timeoutMs: 180000, onLine: l => ctx?.appendLog?.(l) }
      )
      if (res.code === 0) {
        await runCommandSafe(TLMGR_BIN, ['path', 'add'], { timeoutMs: 30000 })
        report.repairedTexlive.push(...availableCached)
      }
    }
  }

  // Ensure texmf-local filename database ls-R is up to date
  await runCommandSafe(MKTEXLSR_BIN, [], {
    timeoutMs: 60000,
    onLine: l => ctx?.appendLog?.(l),
  })
  report.mktexlsrRan = true

  // Also ensure any persisted tl-persisted directory corresponds to something clean
  const tlPersistedRoot = path.join(TEXMFLOCAL, 'tex', 'latex', 'tl-persisted')
  if (fs.existsSync(tlPersistedRoot)) {
    const entries = await fsp.readdir(tlPersistedRoot, { withFileTypes: true })
    for (const d of entries) {
      if (d.isDirectory() && validatePackageName(d.name)) {
        const local = await tlpdbCache.getLocalEntry(d.name)
        if (local && !state.texlivePackages[d.name]) {
          state.texlivePackages[d.name] = {
            name: d.name,
            version: local.catalogueVersion || String(local.revision || '1.0'),
            revision: local.revision || 0,
            installedAt: new Date().toISOString(),
          }
        }
      }
    }
  }

  state.lastReconciledAt = new Date().toISOString()
  await stateStore.savePersistentState()
  tlpdbCache.invalidate()
  await tlpdbCache.ensureLoaded(true)

  return report
}
