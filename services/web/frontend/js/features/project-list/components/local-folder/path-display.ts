export const DEFAULT_LOCAL_ALLOWED_ROOT = '/var/lib/overleaf/local-projects'
export const DEFAULT_LOCAL_BASE_DIR =
  '/var/lib/overleaf/local-projects/OverleafProjects'

const HOME_ROOT_RE = /^\/(?:home|Users)\/[^/]+$/
const HOME_PREFIX_RE = /^\/(?:home|Users)\/[^/]+(?=\/|$)/
const WINDOWS_RESERVED_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i

export function formatLocalDisplayPath(
  fullPath: string,
  allowedRoot?: string
): string {
  if (!fullPath) return ''
  const trimmedAllowed = (allowedRoot || '').replace(/\/+$/, '')
  if (
    trimmedAllowed &&
    HOME_ROOT_RE.test(trimmedAllowed) &&
    (fullPath === trimmedAllowed || fullPath.startsWith(`${trimmedAllowed}/`))
  ) {
    return `~${fullPath.slice(trimmedAllowed.length)}`
  }
  if (HOME_PREFIX_RE.test(fullPath)) {
    return fullPath.replace(HOME_PREFIX_RE, '~')
  }
  return fullPath
}

export function sanitizePreviewName(name: string, id: string): string {
  const shortId = String(id || '').slice(-6) || 'project'
  const cleaned = (name || '')
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
  const sliced = cleaned.slice(0, 120).replace(/[\s.]+$/, '').trim()
  if (!sliced) {
    return `project_${shortId}`
  }
  if (WINDOWS_RESERVED_RE.test(sliced)) {
    return `${sliced}_${shortId}`
  }
  return sliced
}
