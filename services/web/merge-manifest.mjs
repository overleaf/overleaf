import fs from 'node:fs'
import path from 'node:path'

const PUBLIC_DIR = process.env.OVERLEAF_PUBLIC_DIR || '/overleaf/services/web/public'
const mainManifestPath = path.join(PUBLIC_DIR, 'manifest.json')
const customManifestPath = path.join(PUBLIC_DIR, 'js/custom-pl/manifest.json')

const mainManifest = JSON.parse(fs.readFileSync(mainManifestPath, 'utf8'))
const customManifest = JSON.parse(fs.readFileSync(customManifestPath, 'utf8'))

const ep = customManifest?.entrypoints?.['pages/project-list']
if (!ep || !Array.isArray(ep.assets?.js) || ep.assets.js.length === 0) {
  throw new Error('Custom project-list manifest is missing entrypoints["pages/project-list"].assets.js')
}

// Verify every referenced asset exists on disk
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

mainManifest.entrypoints['pages/project-list'] = ep
if (customManifest['pages/project-list.js']) {
  mainManifest['pages/project-list.js'] = customManifest['pages/project-list.js']
}
if (customManifest['pages/project-list.css']) {
  mainManifest['pages/project-list.css'] = customManifest['pages/project-list.css']
}

fs.writeFileSync(mainManifestPath, JSON.stringify(mainManifest, null, 2) + '\n', 'utf8')
console.log('[ok] merged pages/project-list into public/manifest.json:')
console.log(JSON.stringify(ep, null, 2))
