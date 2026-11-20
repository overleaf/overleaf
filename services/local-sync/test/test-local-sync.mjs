import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ol-local-sync-test-'))
const fakeHome = path.join(testRoot, 'home')
const stageRoot = path.join(testRoot, 'stage')
const sockPath = path.join(testRoot, 'sync.sock')
fs.mkdirSync(fakeHome, { recursive: true })
fs.mkdirSync(path.join(fakeHome, 'overleaf-toolkit'), { recursive: true })
fs.mkdirSync(path.join(fakeHome, '.ssh'), { recursive: true })
fs.mkdirSync(path.join(fakeHome, 'Documents'), { recursive: true })
fs.mkdirSync(stageRoot, { recursive: true })

// Create a symlink escaping fakeHome
const outsideDir = path.join(testRoot, 'outside')
fs.mkdirSync(outsideDir, { recursive: true })
fs.symlinkSync(outsideDir, path.join(fakeHome, 'escape-link'))

process.env.LOCAL_SYNC_ALLOWED_ROOT = fakeHome
process.env.LOCAL_SYNC_DEFAULT_BASE_DIR = path.join(fakeHome, 'OverleafProjects')

const {
  validateHostFolderPath,
  sanitizeProjectFolderName,
  validateRelativeEntityPath,
  doPathsOverlap,
} = await import('../path-utils.mjs')

// --- Unit tests for path-utils ---
assert.equal(validateHostFolderPath('/etc/passwd').ok, false, 'reject /etc')
assert.equal(validateHostFolderPath(fakeHome).ok, false, 'reject home root')
assert.equal(
  validateHostFolderPath(path.join(fakeHome, 'overleaf-toolkit')).ok,
  false,
  'reject overleaf-toolkit'
)
assert.equal(
  validateHostFolderPath(path.join(fakeHome, 'overleaf-toolkit/data')).ok,
  false,
  'reject overleaf-toolkit subdir'
)
assert.equal(
  validateHostFolderPath(path.join(fakeHome, '.ssh')).ok,
  false,
  'reject hidden dot dir'
)
assert.equal(
  validateHostFolderPath(path.join(fakeHome, 'escape-link/sub')).ok,
  false,
  'reject symlink escape outside home'
)
assert.equal(
  validateHostFolderPath('~/Documents/MyPaper').ok,
  true,
  'allow ~/Documents/MyPaper'
)
assert.equal(
  validateHostFolderPath('~/Documents/MyPaper').normalizedPath,
  path.join(fakeHome, 'Documents/MyPaper')
)
assert.equal(
  sanitizeProjectFolderName('My / Cool: Paper? *2026*', '6acd0bd1c78525f12b4a65b0'),
  'My _ Cool_ Paper_ _2026_'
)
assert.equal(
  sanitizeProjectFolderName('CON', '6acd0bd1c78525f12b4a65b0'),
  'CON_4a65b0',
  'escape Windows reserved CON folder name'
)
assert.equal(
  sanitizeProjectFolderName('nul.txt', '6acd0bd1c78525f12b4a65b0'),
  'nul.txt_4a65b0',
  'escape Windows reserved nul.txt folder name'
)
assert.equal(
  sanitizeProjectFolderName('COM1', '6acd0bd1c78525f12b4a65b0'),
  'COM1_4a65b0',
  'escape Windows reserved COM1 folder name'
)
assert.equal(
  sanitizeProjectFolderName('LPT9', '6acd0bd1c78525f12b4a65b0'),
  'LPT9_4a65b0',
  'escape Windows reserved LPT9 folder name'
)
assert.equal(
  sanitizeProjectFolderName('My Paper...   ', '6acd0bd1c78525f12b4a65b0'),
  'My Paper',
  'strip trailing dots and spaces for NTFS/SMB'
)
assert.equal(
  validateHostFolderPath('~\\Documents\\WinPaper').normalizedPath,
  path.join(fakeHome, 'Documents/WinPaper'),
  'normalize Windows backslashes after tilde'
)
assert.equal(validateRelativeEntityPath('../secret.txt').ok, false)
assert.equal(validateRelativeEntityPath('.overleaf-sync.json').ok, false)
assert.equal(validateRelativeEntityPath('/chapters/intro.tex').relPath, 'chapters/intro.tex')
assert.equal(doPathsOverlap('/a/b', '/a/b/c'), true)
assert.equal(doPathsOverlap('/a/b', '/a/bc'), false)
assert.equal(
  doPathsOverlap('/projects/Paper', '/projects/paper/sub', {
    caseInsensitive: true,
  }),
  true
)
console.log('[pass] path-utils unit tests passed')

// --- Integration tests for local-sync daemon ---
function reqDaemon(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null
    const req = http.request(
      {
        socketPath: sockPath,
        path: endpoint,
        method,
        headers: payload
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            }
          : {},
      },
      res => {
        const chunks = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            data: JSON.parse(Buffer.concat(chunks).toString('utf8')),
          })
        })
      }
    )
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

const child = spawn(process.execPath, [path.join(__dirname, '..', 'app.mjs')], {
  env: {
    ...process.env,
    LOCAL_SYNC_ALLOWED_ROOT: fakeHome,
    LOCAL_SYNC_DEFAULT_BASE_DIR: path.join(fakeHome, 'OverleafProjects'),
    LOCAL_SYNC_SOCKET_PATH: sockPath,
    LOCAL_SYNC_STAGE_ROOT: stageRoot,
  },
  stdio: 'pipe',
})

// Wait for socket to appear
for (let i = 0; i < 40; i++) {
  if (fs.existsSync(sockPath)) break
  await new Promise(r => setTimeout(r, 100))
}
assert.equal(fs.existsSync(sockPath), true, 'daemon socket should exist')

try {
  // 1. Health
  const h = await reqDaemon('GET', '/health')
  assert.equal(h.status, 200)
  assert.equal(h.data.ok, true)

  // 2. Browse hides .ssh and overleaf-toolkit
  const br = await reqDaemon('POST', '/browse', { path: fakeHome })
  assert.equal(br.status, 200)
  const names = br.data.directories.map(d => d.name)
  assert.equal(names.includes('Documents'), true)
  assert.equal(names.includes('overleaf-toolkit'), false)
  assert.equal(names.includes('.ssh'), false)
  assert.equal(names.includes('escape-link'), false)

  // 3. Initial sync of Project A
  const stage1 = path.join(stageRoot, 'job1')
  fs.mkdirSync(path.join(stage1, 'sections'), { recursive: true })
  fs.writeFileSync(path.join(stage1, 'main.tex'), '\\documentclass{article}\n')
  fs.writeFileSync(path.join(stage1, 'sections/intro.tex'), 'Intro v1\n')
  const folderA1 = path.join(fakeHome, 'OverleafProjects/PaperA')

  const s1 = await reqDaemon('POST', '/sync', {
    projectId: 'projA',
    projectName: 'PaperA',
    targetDir: folderA1,
    stagingDir: stage1,
    files: ['main.tex', 'sections/intro.tex'],
  })
  assert.equal(s1.status, 200)
  assert.equal(s1.data.syncedFilesCount, 2)
  assert.equal(
    fs.readFileSync(path.join(folderA1, 'main.tex'), 'utf8'),
    '\\documentclass{article}\n'
  )

  // Add a personal user file inside folderA1 -> must NEVER be deleted
  fs.writeFileSync(path.join(folderA1, 'my-personal-notes.txt'), 'keep me!')

  // 4. Re-sync Project A with sections/intro.tex removed -> stale Overleaf file removed, personal file preserved
  const stage2 = path.join(stageRoot, 'job2')
  fs.mkdirSync(stage2, { recursive: true })
  fs.writeFileSync(path.join(stage2, 'main.tex'), '\\documentclass{article}\n% v2\n')

  const s2 = await reqDaemon('POST', '/sync', {
    projectId: 'projA',
    projectName: 'PaperA',
    targetDir: folderA1,
    stagingDir: stage2,
    files: ['main.tex'],
  })
  assert.equal(s2.status, 200)
  assert.equal(s2.data.removedStaleCount, 1)
  assert.equal(fs.existsSync(path.join(folderA1, 'sections/intro.tex')), false)
  assert.equal(fs.existsSync(path.join(folderA1, 'sections')), false, 'empty stale dir pruned')
  assert.equal(
    fs.readFileSync(path.join(folderA1, 'my-personal-notes.txt'), 'utf8'),
    'keep me!',
    'personal file preserved'
  )

  // 5. Conflict protection: Project B tries to sync into Project A's folder -> 409
  const conflict = await reqDaemon('POST', '/sync', {
    projectId: 'projB',
    projectName: 'PaperB',
    targetDir: folderA1,
    stagingDir: stage2,
    files: ['main.tex'],
  })
  assert.equal(conflict.status, 409, 'must refuse overwriting another project folder')

  // 6. Move Project A to custom folder with cleanOld=true -> old Overleaf files removed, personal file STILL kept!
  const folderA2 = path.join(fakeHome, 'Documents/CustomPaperA')
  const s3 = await reqDaemon('POST', '/sync', {
    projectId: 'projA',
    projectName: 'PaperA',
    targetDir: folderA2,
    stagingDir: stage2,
    files: ['main.tex'],
    oldDir: folderA1,
    cleanOld: true,
  })
  assert.equal(s3.status, 200)
  assert.equal(s3.data.cleanedOldDir, true)
  assert.equal(fs.existsSync(path.join(folderA2, 'main.tex')), true)
  assert.equal(fs.existsSync(path.join(folderA1, 'main.tex')), false)
  assert.equal(fs.existsSync(path.join(folderA1, '.overleaf-sync.json')), false)
  assert.equal(
    fs.readFileSync(path.join(folderA1, 'my-personal-notes.txt'), 'utf8'),
    'keep me!',
    'old personal file preserved even after cleanOld'
  )

  console.log('[pass] local-sync daemon integration tests passed')
} finally {
  child.kill('SIGTERM')
  fs.rmSync(testRoot, { recursive: true, force: true })
}
