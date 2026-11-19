import fs from 'node:fs'
import path from 'node:path'

export const ALLOWED_ROOT = path.resolve(
  process.env.LOCAL_SYNC_ALLOWED_ROOT || '/home/uzairserver'
)

export const DEFAULT_BASE_DIR = path.resolve(
  process.env.LOCAL_SYNC_DEFAULT_BASE_DIR ||
    path.join(ALLOWED_ROOT, 'OverleafProjects')
)

export const SYNC_MANIFEST_FILENAME = '.overleaf-sync.json'

const FORBIDDEN_TOP_LEVEL_NAMES = new Set(['overleaf-toolkit'])

/**
 * Expand leading `~` or `~/` to ALLOWED_ROOT.
 * @param {string} raw
 * @returns {string}
 */
export function expandTilde(raw) {
  if (typeof raw !== 'string') return ''
  const trimmed = raw.trim()
  if (trimmed === '~') return ALLOWED_ROOT
  if (trimmed.startsWith('~/')) {
    return path.join(ALLOWED_ROOT, trimmed.slice(2))
  }
  return trimmed
}

/**
 * Check whether `candidate` is equal to `base` or inside `base`.
 * @param {string} base
 * @param {string} candidate
 * @returns {boolean}
 */
export function isPathEqualOrInside(base, candidate) {
  const normBase = path.resolve(base)
  const normCandidate = path.resolve(candidate)
  if (normCandidate === normBase) return true
  const prefix = normBase.endsWith(path.sep) ? normBase : normBase + path.sep
  return normCandidate.startsWith(prefix)
}

/**
 * Check whether either path is equal to or an ancestor of the other.
 * Used to avoid overlapping project sync folders.
 * @param {string} pathA
 * @param {string} pathB
 * @returns {boolean}
 */
export function doPathsOverlap(pathA, pathB) {
  return (
    isPathEqualOrInside(pathA, pathB) || isPathEqualOrInside(pathB, pathA)
  )
}

/**
 * Check if a resolved path inside ALLOWED_ROOT targets a forbidden location.
 * @param {string} resolvedPath
 * @returns {string | null} error reason or null if permitted
 */
function checkForbiddenSubpath(resolvedPath) {
  if (!isPathEqualOrInside(ALLOWED_ROOT, resolvedPath)) {
    return `Folder location must be inside ${ALLOWED_ROOT}`
  }
  if (resolvedPath === ALLOWED_ROOT) {
    return `Please choose a subfolder inside ${ALLOWED_ROOT} (not the home root itself)`
  }

  const rel = path.relative(ALLOWED_ROOT, resolvedPath)
  const segments = rel.split(path.sep).filter(Boolean)
  if (segments.length === 0) {
    return `Please choose a subfolder inside ${ALLOWED_ROOT}`
  }

  const topSegment = segments[0]
  if (topSegment.startsWith('.')) {
    return `Hidden system directories (${path.join(ALLOWED_ROOT, topSegment)}) cannot be used for Overleaf project folders`
  }
  if (FORBIDDEN_TOP_LEVEL_NAMES.has(topSegment)) {
    return `${path.join(ALLOWED_ROOT, topSegment)} is reserved for Overleaf internal storage and cannot be used as a project export folder`
  }

  return null
}

/**
 * Find the nearest existing ancestor directory and resolve its realpath to
 * ensure symlinks cannot escape ALLOWED_ROOT or enter forbidden directories.
 * @param {string} resolvedPath
 * @returns {{ ok: true, realAncestor: string, exists: boolean } | { ok: false, error: string }}
 */
function verifyRealAncestors(resolvedPath) {
  let cursor = resolvedPath
  const visited = new Set()
  let targetExists = false

  while (!visited.has(cursor)) {
    visited.add(cursor)
    try {
      const stat = fs.lstatSync(cursor)
      if (cursor === resolvedPath) {
        if (!stat.isDirectory() && !stat.isSymbolicLink()) {
          return {
            ok: false,
            error: `Path exists and is a file, not a folder: ${resolvedPath}`,
          }
        }
        if (stat.isSymbolicLink()) {
          const targetStat = fs.statSync(cursor)
          if (!targetStat.isDirectory()) {
            return {
              ok: false,
              error: `Path symlink does not point to a folder: ${resolvedPath}`,
            }
          }
        }
        targetExists = true
      }
      const real = fs.realpathSync(cursor)
      if (!isPathEqualOrInside(ALLOWED_ROOT, real)) {
        return {
          ok: false,
          error: `Path resolves outside ${ALLOWED_ROOT} via symlink (${real})`,
        }
      }
      if (real !== ALLOWED_ROOT) {
        const forbidden = checkForbiddenSubpath(real)
        if (forbidden) {
          return { ok: false, error: forbidden }
        }
      }
      return { ok: true, realAncestor: real, exists: targetExists }
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        const parent = path.dirname(cursor)
        if (parent === cursor) break
        cursor = parent
        continue
      }
      return {
        ok: false,
        error: `Cannot access path (${err?.code || err?.message || 'error'})`,
      }
    }
  }

  return {
    ok: false,
    error: `Could not verify parent directory for ${resolvedPath}`,
  }
}

/**
 * Expand, normalize, and strictly validate a host folder path.
 * @param {string} rawPath
 * @param {{ checkSymlinks?: boolean, allowRootForBrowse?: boolean }} [options]
 * @returns {{ ok: true, normalizedPath: string, exists?: boolean } | { ok: false, error: string }}
 */
export function validateHostFolderPath(rawPath, options = {}) {
  const { checkSymlinks = true, allowRootForBrowse = false } = options
  if (typeof rawPath !== 'string' || rawPath.trim().length === 0) {
    return { ok: false, error: 'Folder path is required' }
  }
  if (/[\0\r\n]/.test(rawPath)) {
    return { ok: false, error: 'Folder path contains invalid control characters' }
  }

  const expanded = expandTilde(rawPath)
  if (!path.isAbsolute(expanded)) {
    return {
      ok: false,
      error: `Folder path must be an absolute path inside ${ALLOWED_ROOT} (or start with ~/)`,
    }
  }

  const normalizedPath = path.resolve(expanded)

  if (allowRootForBrowse && normalizedPath === ALLOWED_ROOT) {
    return { ok: true, normalizedPath, exists: true }
  }

  const forbidden = checkForbiddenSubpath(normalizedPath)
  if (forbidden) {
    return { ok: false, error: forbidden }
  }

  if (checkSymlinks) {
    const ancestorCheck = verifyRealAncestors(normalizedPath)
    if (!ancestorCheck.ok) {
      return ancestorCheck
    }
    return { ok: true, normalizedPath, exists: ancestorCheck.exists }
  }

  return { ok: true, normalizedPath }
}

/**
 * Sanitize an Overleaf project name into a safe single directory name.
 * Preserves human-readable spaces and letters while stripping filesystem hazards.
 * @param {string} projectName
 * @param {string} projectId
 * @returns {string}
 */
export function sanitizeProjectFolderName(projectName, projectId = '') {
  const shortId = String(projectId || '').slice(-6) || 'project'
  const cleaned = String(projectName || '')
    .replace(/[\0-\x1f\x7f]/g, '')
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .replace(/\.+$/, '')
    .trim()

  if (!cleaned || cleaned === '.' || cleaned === '..') {
    return `project_${shortId}`
  }

  return cleaned.slice(0, 120).trim() || `project_${shortId}`
}

/**
 * Validate a relative file path inside a synced project folder.
 * Rejects traversal (`..`), absolute paths, control chars, and manifest overwrite.
 * @param {string} rawRelPath
 * @returns {{ ok: true, relPath: string } | { ok: false, error: string }}
 */
export function validateRelativeEntityPath(rawRelPath) {
  if (typeof rawRelPath !== 'string' || rawRelPath.length === 0) {
    return { ok: false, error: 'Empty relative file path' }
  }
  if (/[\0\r\n]/.test(rawRelPath)) {
    return { ok: false, error: 'Invalid control character in file path' }
  }
  const stripped = rawRelPath.replace(/^\/+/, '')
  if (!stripped) {
    return { ok: false, error: 'Empty relative file path' }
  }
  const normalized = path.posix.normalize(stripped.replace(/\\/g, '/'))
  if (
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    path.posix.isAbsolute(normalized)
  ) {
    return { ok: false, error: `Unsafe relative path: ${rawRelPath}` }
  }
  const segments = normalized.split('/')
  if (segments.some(seg => seg === '' || seg === '.' || seg === '..')) {
    return { ok: false, error: `Unsafe path segment: ${rawRelPath}` }
  }
  if (normalized === SYNC_MANIFEST_FILENAME) {
    return { ok: false, error: 'Cannot overwrite sync manifest file' }
  }
  return { ok: true, relPath: normalized }
}

/**
 * Check if a directory entry name under ALLOWED_ROOT is allowed to appear
 * in the UI folder browser.
 * @param {string} parentDir
 * @param {string} entryName
 * @returns {boolean}
 */
export function isBrowsableDirectoryEntry(parentDir, entryName) {
  if (!entryName || entryName.startsWith('.')) return false
  const resolvedParent = path.resolve(parentDir)
  if (
    resolvedParent === ALLOWED_ROOT &&
    FORBIDDEN_TOP_LEVEL_NAMES.has(entryName)
  ) {
    return false
  }
  return true
}
