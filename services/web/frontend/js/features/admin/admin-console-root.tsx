import { KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'
import { getUserFacingMessage } from '@/infrastructure/fetch-json'
import Notification from '@/shared/components/notification'
import OLButton from '@/shared/components/ol/ol-button'
import OLPageContentCard from '@/shared/components/ol/ol-page-content-card'
import OLSpinner from '@/shared/components/ol/ol-spinner'
import { UserProvider } from '@/shared/context/user-context'
import useWaitForI18n from '@/shared/hooks/use-wait-for-i18n'
import getMeta from '@/utils/meta'
import { AdminOverview, getAdminOverview } from './api'
import MaintenanceTab from './maintenance-tab'
import OverviewTab from './overview-tab'
import ProjectsAccessTab, { ProjectFilter } from './projects-access-tab'
import UsersTab, { UserFilter } from './users-tab'
import './admin-console.scss'

type AdminTabId = 'overview' | 'users' | 'projects' | 'maintenance'

const TAB_ORDER: AdminTabId[] = ['overview', 'users', 'projects', 'maintenance']

function resolveInitialTab(): AdminTabId {
  if (window.location.hash === '#maintenance') return 'maintenance'
  if (
    window.location.hash === '#projects' ||
    window.location.pathname.startsWith('/admin/projects')
  ) {
    return 'projects'
  }
  if (
    window.location.hash === '#users' ||
    window.location.pathname.startsWith('/admin/user')
  ) {
    return 'users'
  }
  const metaTab = getMeta('ol-adminInitialTab')
  if (
    metaTab === 'users' ||
    metaTab === 'projects' ||
    metaTab === 'maintenance'
  ) {
    return metaTab
  }
  return 'overview'
}

export default function AdminConsoleRoot() {
  const { isReady } = useWaitForI18n()
  const [activeTab, setActiveTab] = useState<AdminTabId>(resolveInitialTab)
  const [usersFilter, setUsersFilter] = useState<UserFilter>('all')
  const [projectsFilter, setProjectsFilter] = useState<ProjectFilter>('all')
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [loadingOverview, setLoadingOverview] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const overviewTabRef = useRef<HTMLButtonElement>(null)
  const usersTabRef = useRef<HTMLButtonElement>(null)
  const projectsTabRef = useRef<HTMLButtonElement>(null)
  const maintenanceTabRef = useRef<HTMLButtonElement>(null)

  const refreshOverview = useCallback(async () => {
    setLoadingOverview(true)
    setError(null)
    try {
      const data = await getAdminOverview()
      setOverview(data)
    } catch (err) {
      setError(String(getUserFacingMessage(err as Error)))
    } finally {
      setLoadingOverview(false)
    }
  }, [])

  useEffect(() => {
    refreshOverview()
  }, [refreshOverview])

  const selectTab = (
    tab: AdminTabId,
    nextUsersFilter?: UserFilter,
    nextProjectsFilter?: ProjectFilter
  ) => {
    if (nextUsersFilter) {
      setUsersFilter(nextUsersFilter)
    }
    if (nextProjectsFilter) {
      setProjectsFilter(nextProjectsFilter)
    }
    setActiveTab(tab)
    if (tab === 'users' && window.location.pathname !== '/admin/user') {
      window.history.replaceState(null, '', '/admin/user')
    } else if (
      tab === 'projects' &&
      window.location.pathname !== '/admin/projects'
    ) {
      window.history.replaceState(null, '', '/admin/projects')
    } else if (tab === 'overview' && window.location.pathname !== '/admin') {
      window.history.replaceState(null, '', '/admin')
    } else if (tab === 'maintenance') {
      window.history.replaceState(null, '', '/admin#maintenance')
    }
  }

  const focusAndSelectTab = (tab: AdminTabId) => {
    selectTab(tab)
    if (tab === 'overview') overviewTabRef.current?.focus()
    if (tab === 'users') usersTabRef.current?.focus()
    if (tab === 'projects') projectsTabRef.current?.focus()
    if (tab === 'maintenance') maintenanceTabRef.current?.focus()
  }

  const handleTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const idx = TAB_ORDER.indexOf(activeTab)
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      focusAndSelectTab(TAB_ORDER[(idx + 1) % TAB_ORDER.length])
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focusAndSelectTab(TAB_ORDER[(idx - 1 + TAB_ORDER.length) % TAB_ORDER.length])
    } else if (e.key === 'Home') {
      e.preventDefault()
      focusAndSelectTab(TAB_ORDER[0])
    } else if (e.key === 'End') {
      e.preventDefault()
      focusAndSelectTab(TAB_ORDER[TAB_ORDER.length - 1])
    }
  }

  if (!isReady) {
    return null
  }

  const sharedProjectsBadge = overview
    ? overview.counts.totalProjects
    : null

  return (
    <UserProvider>
      <div className="container ol-admin-console">
        <div className="ol-admin-shell">
          <OLPageContentCard className="ol-admin-page-card">
            <div className="ol-admin-header">
              <div>
                <h1 className="ol-admin-title">System Admin</h1>
                <p className="ol-admin-subtitle">
                  Manage workspace users, configure project sharing across your
                  network, and control editor maintenance.
                </p>
              </div>
              <div className="ol-admin-header-actions">
                <OLButton
                  variant="secondary"
                  size="sm"
                  leadingIcon="arrow_back"
                  href="/project"
                >
                  Projects
                </OLButton>
                {overview?.runtime.packageHubEnabled && (
                  <OLButton
                    variant="secondary"
                    size="sm"
                    leadingIcon="extension"
                    href="/packages"
                  >
                    Package Hub
                  </OLButton>
                )}
              </div>
            </div>

            <div
              className="ol-admin-tabs"
              role="tablist"
              aria-label="Admin sections"
            >
              <button
                ref={overviewTabRef}
                id="admin-tab-overview"
                type="button"
                role="tab"
                aria-selected={activeTab === 'overview'}
                aria-controls="admin-panel-overview"
                tabIndex={activeTab === 'overview' ? 0 : -1}
                className={`ol-admin-tab-btn ${
                  activeTab === 'overview' ? 'is-active' : ''
                }`}
                onClick={() => selectTab('overview')}
                onKeyDown={handleTabKeyDown}
              >
                Overview &amp; Health
              </button>
              <button
                ref={usersTabRef}
                id="admin-tab-users"
                type="button"
                role="tab"
                aria-selected={activeTab === 'users'}
                aria-controls="admin-panel-users"
                tabIndex={activeTab === 'users' ? 0 : -1}
                className={`ol-admin-tab-btn ${
                  activeTab === 'users' ? 'is-active' : ''
                }`}
                onClick={() => selectTab('users')}
                onKeyDown={handleTabKeyDown}
              >
                <span>Users</span>
                {overview ? (
                  <span className="ol-admin-tab-count">
                    {overview.counts.totalUsers}
                  </span>
                ) : null}
              </button>
              <button
                ref={projectsTabRef}
                id="admin-tab-projects"
                type="button"
                role="tab"
                aria-selected={activeTab === 'projects'}
                aria-controls="admin-panel-projects"
                tabIndex={activeTab === 'projects' ? 0 : -1}
                className={`ol-admin-tab-btn ${
                  activeTab === 'projects' ? 'is-active' : ''
                }`}
                onClick={() => selectTab('projects')}
                onKeyDown={handleTabKeyDown}
              >
                <span>Shared Projects</span>
                {sharedProjectsBadge !== null ? (
                  <span className="ol-admin-tab-count">
                    {sharedProjectsBadge}
                  </span>
                ) : null}
              </button>
              <button
                ref={maintenanceTabRef}
                id="admin-tab-maintenance"
                type="button"
                role="tab"
                aria-selected={activeTab === 'maintenance'}
                aria-controls="admin-panel-maintenance"
                tabIndex={activeTab === 'maintenance' ? 0 : -1}
                className={`ol-admin-tab-btn ${
                  activeTab === 'maintenance' ? 'is-active' : ''
                }`}
                onClick={() => selectTab('maintenance')}
                onKeyDown={handleTabKeyDown}
              >
                <span>Settings &amp; Maintenance</span>
                {overview && overview.systemMessages.length > 0 ? (
                  <span className="ol-admin-tab-count">
                    {overview.systemMessages.length}
                  </span>
                ) : null}
              </button>
            </div>

            {error && (
              <div className="notification-list mb-3">
                <Notification type="error" content={error} />
              </div>
            )}

            {activeTab === 'overview' && (
              <div
                id="admin-panel-overview"
                role="tabpanel"
                aria-labelledby="admin-tab-overview"
              >
                {overview ? (
                  <OverviewTab
                    overview={overview}
                    isRefreshing={loadingOverview}
                    onRefresh={refreshOverview}
                    onNavigateTab={selectTab}
                  />
                ) : (
                  <div className="d-flex align-items-center gap-2 py-4 ol-admin-muted">
                    <OLSpinner size="sm" />
                    <span>Loading system health…</span>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'users' && (
              <div
                id="admin-panel-users"
                role="tabpanel"
                aria-labelledby="admin-tab-users"
              >
                <UsersTab
                  initialFilter={usersFilter}
                  onUsersMutated={refreshOverview}
                />
              </div>
            )}

            {activeTab === 'projects' && (
              <div
                id="admin-panel-projects"
                role="tabpanel"
                aria-labelledby="admin-tab-projects"
              >
                <ProjectsAccessTab
                  initialFilter={projectsFilter}
                  onProjectsMutated={refreshOverview}
                />
              </div>
            )}

            {activeTab === 'maintenance' && (
              <div
                id="admin-panel-maintenance"
                role="tabpanel"
                aria-labelledby="admin-tab-maintenance"
              >
                {overview ? (
                  <MaintenanceTab
                    editorOpen={overview.editor.isOpen}
                    messages={overview.systemMessages}
                    onEditorChange={isOpen =>
                      setOverview(prev =>
                        prev ? { ...prev, editor: { isOpen } } : prev
                      )
                    }
                    onMessagesChange={systemMessages =>
                      setOverview(prev =>
                        prev ? { ...prev, systemMessages } : prev
                      )
                    }
                  />
                ) : (
                  <div className="d-flex align-items-center gap-2 py-4 ol-admin-muted">
                    <OLSpinner size="sm" />
                    <span>Loading maintenance settings…</span>
                  </div>
                )}
              </div>
            )}
          </OLPageContentCard>
        </div>
      </div>
    </UserProvider>
  )
}
