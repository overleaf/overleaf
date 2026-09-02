import { Filter, UNCATEGORIZED_KEY } from '../context/project-list-context'
import customLocalStorage from '../../../infrastructure/local-storage'

export const DASHBOARD_PATH = '/project'

export type ActivePage = 'library' | 'projects'

export type NavigationState =
  | { type: 'filter'; filter: Filter }
  | { type: 'tag'; tag: string }

function isDashboardBasePath(pathname: string): boolean {
  return pathname.replace(/\/$/, '') === DASHBOARD_PATH
}

// Each non-default filter maps to a URL segment of the same name (e.g.
// `owned` -> `/project/owned`); the `all` filter is the bare dashboard path.
const FILTER_SEGMENTS: Exclude<Filter, 'all'>[] = [
  'owned',
  'shared',
  'archived',
  'trashed',
]

function isFilterSegment(segment: string): segment is Exclude<Filter, 'all'> {
  return (FILTER_SEGMENTS as string[]).includes(segment)
}

export function getNavigationState(pathname: string): NavigationState {
  const path = pathname.replace(/\/$/, '')
  const rest = path.slice(DASHBOARD_PATH.length).replace(/^\//, '')

  if (rest === 'untagged') {
    return { type: 'tag', tag: UNCATEGORIZED_KEY }
  }

  const tagMatch = rest.match(/^tags\/(.+)$/)
  if (tagMatch) {
    try {
      return { type: 'tag', tag: decodeURIComponent(tagMatch[1]) }
    } catch {
      return { type: 'filter', filter: 'all' }
    }
  }

  if (isFilterSegment(rest)) {
    return { type: 'filter', filter: rest }
  }

  return { type: 'filter', filter: 'all' }
}

export function getNavigationUrl(state: NavigationState): string {
  if (state.type === 'tag') {
    if (state.tag === UNCATEGORIZED_KEY) {
      return `${DASHBOARD_PATH}/untagged`
    }
    return `${DASHBOARD_PATH}/tags/${encodeURIComponent(state.tag)}`
  }
  if (state.filter !== 'all') {
    return `${DASHBOARD_PATH}/${state.filter}`
  }
  return DASHBOARD_PATH
}

// --- Temporary migration code ---------------------------------------------
// The navigation state used to be persisted in local storage. To smooth the
// transition to URL-based navigation, when a user lands on the bare `/project`
// path we honour their stored state once and then delete it, so their first
// load after this change keeps them where they left off.
//
// This is one-time-per-user migration code. It can be removed (along with the
// `Legacy` helpers below) once the local-storage keys have aged out of active
// users — around September 2026. Introduced for #35214.
const LEGACY_FILTER_KEY = 'project-list-filter'
const LEGACY_SELECTED_TAG_ID_KEY = 'project-list-selected-tag-id'

function getLegacyNavigationState(): NavigationState | null {
  const selectedTagId = customLocalStorage.getItem(LEGACY_SELECTED_TAG_ID_KEY)
  if (typeof selectedTagId === 'string') {
    return { type: 'tag', tag: selectedTagId }
  }
  const filter = customLocalStorage.getItem(LEGACY_FILTER_KEY)
  if (typeof filter === 'string' && isFilterSegment(filter)) {
    return { type: 'filter', filter }
  }
  return null
}

function clearLegacyNavigationState(): void {
  customLocalStorage.removeItem(LEGACY_FILTER_KEY)
  customLocalStorage.removeItem(LEGACY_SELECTED_TAG_ID_KEY)
}

// Resolve the initial navigation state, honouring the legacy local-storage
// state once on the bare dashboard path. Read-only: the stored state is not
// cleared here (see migrateLegacyNavigationState).
export function getInitialNavigationState(): NavigationState {
  if (isDashboardBasePath(window.location.pathname)) {
    const legacyState = getLegacyNavigationState()
    if (legacyState) {
      return legacyState
    }
  }
  return getNavigationState(window.location.pathname)
}

// Reflect any legacy state in the URL (via replaceState, so the back button is
// not affected) and then delete it. Call once on mount.
export function migrateLegacyNavigationState(): void {
  if (isDashboardBasePath(window.location.pathname)) {
    const legacyState = getLegacyNavigationState()
    if (legacyState) {
      window.history.replaceState(null, '', getNavigationUrl(legacyState))
    }
  }
  clearLegacyNavigationState()
}
