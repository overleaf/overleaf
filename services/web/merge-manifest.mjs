import fs from 'node:fs'
import path from 'node:path'

const PUBLIC_DIR = process.env.OVERLEAF_PUBLIC_DIR || '/overleaf/services/web/public'
const mainManifestPath = path.join(PUBLIC_DIR, 'manifest.json')
const mainManifest = JSON.parse(fs.readFileSync(mainManifestPath, 'utf8'))

const MANIFEST_SOURCES = [
  {
    manifestPath: path.join(PUBLIC_DIR, 'js/custom-pl/manifest.json'),
    entrypoints: [
      'pages/project-list',
      'pages/packages',
      'pages/user/settings',
      'pages/admin',
      'marketing',
      'modules/launchpad/pages/launchpad',
      'modules/user-activate/pages/user-activate-page',
    ],
  },
  {
    manifestPath: path.join(PUBLIC_DIR, 'js/custom-ide/manifest.json'),
    entrypoints: ['pages/ide'],
  },
]

const mergedNames = []

for (const source of MANIFEST_SOURCES) {
  if (!fs.existsSync(source.manifestPath)) {
    throw new Error(`Missing custom manifest: ${source.manifestPath}`)
  }
  const customManifest = JSON.parse(fs.readFileSync(source.manifestPath, 'utf8'))

  for (const name of source.entrypoints) {
    const ep = customManifest?.entrypoints?.[name]
    if (!ep || !Array.isArray(ep.assets?.js) || ep.assets.js.length === 0) {
      throw new Error(
        `Custom manifest ${source.manifestPath} is missing entrypoints["${name}"].assets.js`
      )
    }

    for (const section of ['js', 'css']) {
      const list = ep.assets?.[section] || []
      for (const urlPath of list) {
        const rel = urlPath.replace(/^\/+/, '')
        const diskPath = path.join(PUBLIC_DIR, rel)
        if (!fs.existsSync(diskPath)) {
          throw new Error(`Referenced asset does not exist on disk: ${diskPath}`)
        }
      }
    }

    mainManifest.entrypoints[name] = ep
    for (const ext of ['.js', '.css']) {
      if (customManifest[`${name}${ext}`]) {
        mainManifest[`${name}${ext}`] = customManifest[`${name}${ext}`]
      }
    }
    mergedNames.push(name)
  }
}

fs.writeFileSync(mainManifestPath, JSON.stringify(mainManifest, null, 2) + '\n', 'utf8')
console.log('[ok] merged entrypoints into public/manifest.json:', mergedNames.join(', '))

// Prune stale orphaned hashed assets from previous custom builds while keeping active files
const referencedRelPaths = new Set()
const addReferencedUrl = urlPath => {
  if (typeof urlPath !== 'string') return
  const rel = urlPath.replace(/^\/+/, '')
  referencedRelPaths.add(rel)
  referencedRelPaths.add(`${rel}.LICENSE.txt`)
}

for (const source of MANIFEST_SOURCES) {
  if (!fs.existsSync(source.manifestPath)) continue
  const customManifest = JSON.parse(fs.readFileSync(source.manifestPath, 'utf8'))
  for (const [key, val] of Object.entries(customManifest)) {
    if (key === 'entrypoints') continue
    if (typeof val === 'string') {
      addReferencedUrl(val)
    }
  }
}

for (const ep of Object.values(mainManifest.entrypoints || {})) {
  for (const section of ['js', 'css']) {
    for (const urlPath of ep?.assets?.[section] || []) {
      addReferencedUrl(urlPath)
    }
  }
}

const PRUNE_ROOTS = [
  path.join(PUBLIC_DIR, 'js/custom-pl'),
  path.join(PUBLIC_DIR, 'stylesheets/custom-pl'),
  path.join(PUBLIC_DIR, 'js/custom-ide'),
  path.join(PUBLIC_DIR, 'stylesheets/custom-ide'),
]

let prunedCount = 0
let prunedBytes = 0

function pruneDir(dirPath) {
  if (!fs.existsSync(dirPath)) return
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const full = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      pruneDir(full)
      continue
    }
    if (!/\.(js|css|LICENSE\.txt)$/.test(entry.name)) {
      continue
    }
    const rel = path.relative(PUBLIC_DIR, full).split(path.sep).join('/')
    if (!referencedRelPaths.has(rel)) {
      const size = fs.statSync(full).size
      fs.unlinkSync(full)
      prunedCount++
      prunedBytes += size
    }
  }
}

for (const root of PRUNE_ROOTS) {
  pruneDir(root)
}

if (prunedCount > 0) {
  console.log(
    `[ok] pruned ${prunedCount} orphaned custom asset(s) (${Math.round(prunedBytes / 1024)} KB)`
  )
}
