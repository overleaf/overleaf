import OLButton from '@/shared/components/ol/ol-button'
import { AdminOverview, ServiceHealth } from './api'
import type { ProjectFilter } from './projects-access-tab'
import type { UserFilter } from './users-tab'

type OverviewTabProps = {
  overview: AdminOverview
  isRefreshing: boolean
  onRefresh: () => void
  onNavigateTab: (
    tab: 'overview' | 'users' | 'projects' | 'maintenance',
    usersFilter?: UserFilter,
    projectsFilter?: ProjectFilter
  ) => void
}

function formatUptime(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${Math.max(1, minutes)}m`
}

function ServiceStatus({
  health,
  healthyText = 'Connected',
  downText = 'Unavailable',
}: {
  health: ServiceHealth
  healthyText?: string
  downText?: string
}) {
  return (
    <span className="ol-admin-status">
      <span
        className={`ol-admin-status-dot ${
          health.ok ? 'is-healthy' : 'is-danger'
        }`}
        aria-hidden="true"
      />
      <span>
        {health.ok
          ? `${healthyText}${
              typeof health.latencyMs === 'number'
                ? ` (${health.latencyMs} ms)`
                : ''
            }`
          : downText}
      </span>
    </span>
  )
}

export default function OverviewTab({
  overview,
  isRefreshing,
  onRefresh,
  onNavigateTab,
}: OverviewTabProps) {
  const { counts, services, editor, runtime, systemMessages } = overview

  return (
    <>
      <div className="ol-admin-summary-strip" aria-label="Workspace summary">
        <button
          type="button"
          className="ol-admin-metric-cell"
          onClick={() => onNavigateTab('users', 'all')}
        >
          <span className="ol-admin-metric-label">Total users</span>
          <span className="ol-admin-metric-value">{counts.totalUsers}</span>
        </button>

        <button
          type="button"
          className="ol-admin-metric-cell"
          onClick={() => onNavigateTab('users', 'admins')}
        >
          <span className="ol-admin-metric-label">Administrators</span>
          <span className="ol-admin-metric-value">{counts.adminUsers}</span>
        </button>

        <button
          type="button"
          className="ol-admin-metric-cell"
          onClick={() => onNavigateTab('users', 'suspended')}
        >
          <span className="ol-admin-metric-label">Suspended</span>
          <span
            className={`ol-admin-metric-value ${
              counts.suspendedUsers > 0 ? 'is-danger' : ''
            }`}
          >
            {counts.suspendedUsers}
          </span>
        </button>

        <button
          type="button"
          className="ol-admin-metric-cell"
          onClick={() => onNavigateTab('projects', undefined, 'all')}
        >
          <span className="ol-admin-metric-label">Projects</span>
          <span className="ol-admin-metric-value">{counts.totalProjects}</span>
        </button>
      </div>

      <div className="ol-admin-section-grid">
        <section
          className="ol-admin-panel"
          aria-labelledby="admin-core-services-heading"
        >
          <div className="ol-admin-panel-header">
            <h2
              id="admin-core-services-heading"
              className="ol-admin-panel-title"
            >
              Core services
            </h2>
            <OLButton
              variant="ghost"
              size="sm"
              type="button"
              leadingIcon="refresh"
              isLoading={isRefreshing}
              loadingLabel="Checking…"
              onClick={onRefresh}
            >
              Refresh
            </OLButton>
          </div>

          <div className="ol-admin-service-list">
            <div className="ol-admin-service-row">
              <div>
                <div className="ol-admin-service-name">LaTeX Editor Access</div>
                <div className="ol-admin-service-detail">
                  {editor.isOpen
                    ? 'Users can open projects and compile documents.'
                    : 'Maintenance mode enabled; new editor sessions blocked.'}
                </div>
              </div>
              {editor.isOpen ? (
                <span className="ol-admin-status">
                  <span
                    className="ol-admin-status-dot is-healthy"
                    aria-hidden="true"
                  />
                  <span>Open</span>
                </span>
              ) : (
                <span className="ol-admin-tag ol-admin-tag--warning">
                  Maintenance mode
                </span>
              )}
            </div>

            <div className="ol-admin-service-row">
              <div>
                <div className="ol-admin-service-name">MongoDB</div>
                <div className="ol-admin-service-detail">
                  {services.mongodb.ok
                    ? 'Primary user and project metadata store connected.'
                    : services.mongodb.error || 'Connection error'}
                </div>
              </div>
              <ServiceStatus health={services.mongodb} />
            </div>

            <div className="ol-admin-service-row">
              <div>
                <div className="ol-admin-service-name">Redis</div>
                <div className="ol-admin-service-detail">
                  {services.redis.ok
                    ? 'Session store and real-time pub/sub responding.'
                    : services.redis.error || 'Connection error'}
                </div>
              </div>
              <ServiceStatus health={services.redis} />
            </div>

            <div className="ol-admin-service-row">
              <div>
                <div className="ol-admin-service-name">Local Folder Sync</div>
                <div className="ol-admin-service-detail">
                  {services.localSync.ok ? (
                    <>
                      Base path:{' '}
                      <span className="dm-mono" translate="no">
                        {services.localSync.data?.defaultBaseDir || 'Active'}
                      </span>
                    </>
                  ) : (
                    services.localSync.error || 'Sync daemon not responding'
                  )}
                </div>
              </div>
              <ServiceStatus health={services.localSync} healthyText="Active" />
            </div>

            <div className="ol-admin-service-row">
              <div>
                <div className="ol-admin-service-name">Package Hub</div>
                <div className="ol-admin-service-detail">
                  {services.packageHub.ok
                    ? `${services.packageHub.data?.installedCount ?? 0} installed, ${services.packageHub.data?.availableCount ?? 0} catalog packages`
                    : services.packageHub.error ||
                      'Package daemon not responding'}
                </div>
              </div>
              <ServiceStatus health={services.packageHub} healthyText="Active" />
            </div>
          </div>
        </section>

        <section
          className="ol-admin-panel"
          aria-labelledby="admin-environment-heading"
        >
          <div className="ol-admin-panel-header">
            <h2
              id="admin-environment-heading"
              className="ol-admin-panel-title"
            >
              Environment
            </h2>
          </div>

          <ul className="ol-admin-kv-list">
            <li>
              <span className="ol-admin-kv-key">Workspace</span>
              <span className="ol-admin-kv-val">{runtime.appName}</span>
            </li>
            <li>
              <span className="ol-admin-kv-key">Runtime</span>
              <span className="ol-admin-kv-val dm-mono" translate="no">
                Node {runtime.nodeVersion} ({runtime.platform}/{runtime.arch})
              </span>
            </li>
            <li>
              <span className="ol-admin-kv-key">Process uptime</span>
              <span className="ol-admin-kv-val">
                {formatUptime(runtime.uptimeSeconds)}
              </span>
            </li>
            <li>
              <span className="ol-admin-kv-key">Shared projects</span>
              <span className="ol-admin-kv-val">
                {counts.enterpriseSharedProjects} network/workspace,{' '}
                {counts.userSharedProjects} user-shared
              </span>
            </li>
            <li>
              <span className="ol-admin-kv-key">SMTP email</span>
              <span className="ol-admin-kv-val">
                <span className="ol-admin-status">
                  <span
                    className={`ol-admin-status-dot ${
                      runtime.smtpConfigured ? 'is-healthy' : 'is-neutral'
                    }`}
                    aria-hidden="true"
                  />
                  <span>
                    {runtime.smtpConfigured ? 'Configured' : 'Not configured'}
                  </span>
                </span>
              </span>
            </li>
            <li>
              <span className="ol-admin-kv-key">Active announcements</span>
              <span className="ol-admin-kv-val">{systemMessages.length}</span>
            </li>
          </ul>

          <div className="ol-admin-panel-footer">
            <OLButton
              variant="primary"
              size="sm"
              type="button"
              onClick={() => onNavigateTab('users')}
            >
              Manage users
            </OLButton>
            <OLButton
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => onNavigateTab('projects', undefined, 'all')}
            >
              Manage project access
            </OLButton>
            <OLButton
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => onNavigateTab('maintenance')}
            >
              Maintenance &amp; banners
            </OLButton>
            {runtime.packageHubEnabled && (
              <OLButton variant="secondary" size="sm" href="/packages">
                Package Hub
              </OLButton>
            )}
            <OLButton variant="secondary" size="sm" href="/launchpad">
              Launchpad checks
            </OLButton>
          </div>
        </section>
      </div>
    </>
  )
}
