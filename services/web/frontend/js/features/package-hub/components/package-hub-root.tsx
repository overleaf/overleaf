import classNames from 'classnames'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import Notification from '@/shared/components/notification'
import OLButton from '@/shared/components/ol/ol-button'
import OLCol from '@/shared/components/ol/ol-col'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLFormSelect from '@/shared/components/ol/ol-form-select'
import OLPageContentCard from '@/shared/components/ol/ol-page-content-card'
import OLRow from '@/shared/components/ol/ol-row'
import { OLToast } from '@/shared/components/ol/ol-toast'
import { OLToastContainer } from '@/shared/components/ol/ol-toast-container'
import Pagination from '@/shared/components/pagination'
import useWaitForI18n from '@/shared/hooks/use-wait-for-i18n'
import getMeta from '@/utils/meta'
import type {
  AuditEntry,
  CommunityManifest,
  JobItem,
  PackageHubConfig,
  PackageItem,
  PackageSource,
  PackagesListResponse,
} from '../types'
import {
  clearActivityHistory,
  getAuditLog,
  getJobStatus,
  installPackages,
  listCommunityManifests,
  listJobs,
  listPackages,
  removePackages,
  subscribeToJobStream,
  updatePackages,
} from '../util/api'
import ActivityDrawer from './activity-drawer'
import AdminSettingsModal from './admin-settings-modal'
import CommunityPacksView from './community-packs-view'
import ConfirmRemoveModal from './confirm-remove-modal'
import PackageCard from './package-card'
import PackageDetailsModal from './package-details-modal'
import PackageUploadModal from './package-upload-modal'
import './package-hub.scss'

type ToastMessage = {
  id: string
  type: 'success' | 'error' | 'info'
  title: string
  content: string
  jobId?: string
}

const SOURCE_TABS: Array<{ id: 'all' | PackageSource; key: string }> = [
  { id: 'all', key: 'package_hub_tab_all' },
  { id: 'texlive', key: 'package_hub_tab_texlive' },
  { id: 'ctan', key: 'package_hub_tab_ctan' },
  { id: 'custom', key: 'package_hub_tab_custom' },
  { id: 'community', key: 'package_hub_tab_community' },
]

const STATUS_FILTERS: Array<{
  id: 'all' | 'installed' | 'available' | 'updates' | 'custom' | 'community'
  key: string
}> = [
  { id: 'all', key: 'package_hub_filter_all' },
  { id: 'installed', key: 'package_hub_filter_installed' },
  { id: 'available', key: 'package_hub_filter_available' },
  { id: 'updates', key: 'package_hub_filter_updates' },
  { id: 'custom', key: 'package_hub_filter_custom' },
  { id: 'community', key: 'package_hub_filter_community' },
]

export default function PackageHubRoot() {
  const { isReady } = useWaitForI18n()

  return (
    <div className="container package-hub-page">
      <OLRow>
        <OLCol xs={12}>{isReady ? <PackageHubContent /> : null}</OLCol>
      </OLRow>
    </div>
  )
}

function PackageHubContent() {
  const { t } = useTranslation()
  const config = (getMeta('ol-packageHubConfig') || {
    canMutate: true,
    canUpload: true,
    isAdmin: false,
  }) as PackageHubConfig

  const [sourceTab, setSourceTab] = useState<'all' | PackageSource>('all')
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'installed' | 'available' | 'updates' | 'custom' | 'community'
  >('all')
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'recent'>('name')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(1)

  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [packages, setPackages] = useState<PackageItem[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [counts, setCounts] = useState<PackagesListResponse['counts']>({
    all: 0,
    installed: 0,
    available: 0,
    updates: 0,
    custom: 0,
    community: 0,
  })

  const [manifests, setManifests] = useState<CommunityManifest[]>([])
  const [manifestsLoading, setManifestsLoading] = useState(false)

  const [selectedMap, setSelectedMap] = useState<Map<string, PackageItem>>(
    new Map()
  )
  const [busyNames, setBusyNames] = useState<Set<string>>(new Set())
  const [errorNames, setErrorNames] = useState<Set<string>>(new Set())

  const [detailsPkg, setDetailsPkg] = useState<PackageItem | null>(null)
  const [removeTargets, setRemoveTargets] = useState<PackageItem[]>([])
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showAdminModal, setShowAdminModal] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)
  const [highlightedJobId, setHighlightedJobId] = useState<string | null>(null)

  const [jobs, setJobs] = useState<JobItem[]>([])
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [clearingHistory, setClearingHistory] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const streamUnsubsRef = useRef<Map<string, () => void>>(new Map())

  const pushToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setToasts(prev => [...prev, { ...toast, id }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(tItem => tItem.id !== id))
  }, [])

  // 300ms debounced search
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1)
      setDebouncedQuery(searchInput.trim())
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const fetchPackages = useCallback(async () => {
    setLoading(true)
    setListError(null)
    try {
      const data = await listPackages({
        source: sourceTab,
        status: statusFilter,
        sort: sortBy,
        q: debouncedQuery,
        page,
        limit: 24,
      })
      setPackages(data.items)
      setTotalPages(data.totalPages || 1)
      setTotalCount(data.total || 0)
      if (data.counts) setCounts(data.counts)
    } catch (err: any) {
      setListError(
        err?.data?.error || err?.message || 'Failed to load packages'
      )
    } finally {
      setLoading(false)
    }
  }, [sourceTab, statusFilter, sortBy, debouncedQuery, page])

  const fetchCommunity = useCallback(async () => {
    setManifestsLoading(true)
    try {
      const list = await listCommunityManifests()
      setManifests(list)
    } catch {
    } finally {
      setManifestsLoading(false)
    }
  }, [])

  const fetchActivity = useCallback(async () => {
    try {
      const [jobsRes, auditRes] = await Promise.all([
        listJobs(),
        getAuditLog(80),
      ])
      if (Array.isArray(jobsRes.items)) setJobs(jobsRes.items)
      if (Array.isArray(auditRes.items)) setAuditEntries(auditRes.items)
    } catch {}
  }, [])

  const handleClearHistory = useCallback(async () => {
    if (clearingHistory) return
    setClearingHistory(true)
    try {
      const res = await clearActivityHistory('all')
      setJobs(prev =>
        Array.isArray(res?.remainingJobs)
          ? res.remainingJobs
          : prev.filter(j => j.status === 'running' || j.status === 'queued')
      )
      setAuditEntries([])
      setHighlightedJobId(null)
      pushToast({
        type: 'success',
        title: t('package_hub_drawer_clear_btn'),
        content: t('package_hub_drawer_cleared_toast'),
      })
    } catch (err: any) {
      pushToast({
        type: 'error',
        title: 'Failed to clear history',
        content: err?.data?.error || err?.message || 'Request failed',
      })
    } finally {
      setClearingHistory(false)
    }
  }, [clearingHistory, pushToast, t])

  useEffect(() => {
    if (sourceTab === 'community') {
      fetchCommunity()
    } else {
      fetchPackages()
    }
  }, [sourceTab, fetchPackages, fetchCommunity])

  useEffect(() => {
    fetchActivity()
  }, [fetchActivity])

  useEffect(() => {
    return () => {
      for (const unsub of streamUnsubsRef.current.values()) {
        unsub()
      }
      streamUnsubsRef.current.clear()
    }
  }, [])

  const trackJob = useCallback(
    (
      jobId: string,
      label: string,
      affectedNames: string[] = [],
      onRollback?: () => void
    ) => {
      setHighlightedJobId(jobId)
      const optimisticJob: JobItem = {
        id: jobId,
        jobId,
        type: 'install',
        status: 'running',
        progress: 5,
        phase: 'Queued',
        message: label,
        log: [],
        created_by: 'me',
        created_at: new Date().toISOString(),
      }
      setJobs(prev => [optimisticJob, ...prev.filter(j => j.id !== jobId)])

      const finish = (
        finalStatus: 'success' | 'failed',
        errMsg?: string | null
      ) => {
        if (affectedNames.length > 0) {
          setBusyNames(prev => {
            const next = new Set(prev)
            affectedNames.forEach(n => next.delete(n))
            return next
          })
        }
        if (finalStatus === 'success') {
          if (affectedNames.length > 0) {
            setErrorNames(prev => {
              const next = new Set(prev)
              affectedNames.forEach(n => next.delete(n))
              return next
            })
          }
          pushToast({
            type: 'success',
            title: label,
            content:
              'Completed successfully and refreshed TeX Live filename database.',
            jobId,
          })
          fetchPackages()
          fetchCommunity()
          fetchActivity()
        } else {
          onRollback?.()
          if (affectedNames.length > 0) {
            setErrorNames(prev => {
              const next = new Set(prev)
              affectedNames.forEach(n => next.add(n))
              return next
            })
          }
          pushToast({
            type: 'error',
            title: `${label} failed`,
            content:
              errMsg ||
              'Package operation failed. Open View Log for details.',
            jobId,
          })
          fetchActivity()
        }
      }

      const unsub = subscribeToJobStream(
        jobId,
        ev => {
          setJobs(prev =>
            prev.map(j =>
              j.id === jobId
                ? {
                    ...j,
                    status: ev.status,
                    progress: ev.percent ?? j.progress,
                    phase: ev.phase || j.phase,
                    message: ev.message || j.message,
                    error: ev.error,
                    log: ev.log
                      ? ev.log
                      : ev.logLine
                        ? [...(j.log || []), ev.logLine]
                        : j.log,
                  }
                : j
            )
          )
          if (ev.status === 'success' || ev.status === 'failed') {
            streamUnsubsRef.current.delete(jobId)
            finish(ev.status, ev.error)
          }
        },
        () => {
          getJobStatus(jobId)
            .then(j => {
              setJobs(prev => prev.map(old => (old.id === jobId ? j : old)))
              if (j.status === 'success' || j.status === 'failed') {
                finish(j.status, j.error)
              }
            })
            .catch(() => {})
        }
      )
      streamUnsubsRef.current.set(jobId, unsub)
    },
    [fetchActivity, fetchCommunity, fetchPackages, pushToast]
  )

  const handleInstallOne = async (pkg: PackageItem) => {
    const names = [pkg.name]
    const prevInstalled = pkg.installed
    setBusyNames(prev => new Set(prev).add(pkg.name))
    setPackages(prev =>
      prev.map(p =>
        p.name === pkg.name && p.source === pkg.source
          ? { ...p, installed: true }
          : p
      )
    )

    try {
      const src = pkg.source === 'custom' ? undefined : pkg.source
      const res = await installPackages(names, src)
      trackJob(res.jobId, `Installing ${pkg.name}`, names, () => {
        setPackages(prev =>
          prev.map(p =>
            p.name === pkg.name && p.source === pkg.source
              ? { ...p, installed: prevInstalled }
              : p
          )
        )
      })
    } catch (err: any) {
      setBusyNames(prev => {
        const next = new Set(prev)
        next.delete(pkg.name)
        return next
      })
      setPackages(prev =>
        prev.map(p =>
          p.name === pkg.name && p.source === pkg.source
            ? { ...p, installed: prevInstalled }
            : p
        )
      )
      setErrorNames(prev => new Set(prev).add(pkg.name))
      pushToast({
        type: 'error',
        title: `Failed to install ${pkg.name}`,
        content: err?.data?.error || err?.message || 'Request failed',
      })
    }
  }

  const handleUpdateList = async (names: string[]) => {
    setBusyNames(prev => {
      const next = new Set(prev)
      names.forEach(n => next.add(n))
      return next
    })
    try {
      const res = await updatePackages({ names })
      trackJob(res.jobId, `Updating ${names.join(', ')}`, names)
    } catch (err: any) {
      setBusyNames(prev => {
        const next = new Set(prev)
        names.forEach(n => next.delete(n))
        return next
      })
      pushToast({
        type: 'error',
        title: 'Update failed',
        content: err?.data?.error || err?.message || 'Request failed',
      })
    }
  }

  const handleConfirmRemove = async () => {
    const targets = removeTargets
    if (targets.length === 0) return
    const names = targets.map(tItem => tItem.name)
    const snapshot = packages

    setRemoveTargets([])
    setBusyNames(prev => {
      const next = new Set(prev)
      names.forEach(n => next.add(n))
      return next
    })
    setPackages(prev =>
      prev.map(p => (names.includes(p.name) ? { ...p, installed: false } : p))
    )

    try {
      const uniqueSources = new Set(targets.map(tItem => tItem.source))
      const source = uniqueSources.size === 1 ? targets[0].source : 'auto'
      const res = await removePackages(names, source)
      trackJob(res.jobId, `Removing ${names.join(', ')}`, names, () => {
        setPackages(snapshot)
      })
      setSelectedMap(new Map())
    } catch (err: any) {
      setPackages(snapshot)
      setBusyNames(prev => {
        const next = new Set(prev)
        names.forEach(n => next.delete(n))
        return next
      })
      pushToast({
        type: 'error',
        title: 'Removal blocked or failed',
        content:
          err?.data?.error || err?.message || 'Unable to remove package(s)',
      })
    }
  }

  const toggleSelect = (pkg: PackageItem) => {
    const key = `${pkg.source}:${pkg.name}`
    setSelectedMap(prev => {
      const next = new Map(prev)
      if (next.has(key)) next.delete(key)
      else next.set(key, pkg)
      return next
    })
  }

  const selectedItems = useMemo(
    () => Array.from(selectedMap.values()),
    [selectedMap]
  )

  const handleBulkInstall = async () => {
    const avail = selectedItems.filter(
      p => !p.installed && p.source !== 'community'
    )
    if (avail.length === 0) return
    const names = avail.map(p => p.name)
    try {
      const res = await installPackages(names, avail[0].source)
      setSelectedMap(new Map())
      trackJob(res.jobId, `Bulk installing ${names.length} package(s)`, names)
    } catch (err: any) {
      pushToast({
        type: 'error',
        title: 'Bulk install failed',
        content:
          err?.data?.error || err?.message || 'Failed to enqueue install',
      })
    }
  }

  const activeJobsCount = useMemo(
    () =>
      jobs.filter(j => j.status === 'running' || j.status === 'queued').length,
    [jobs]
  )

  const hasActiveFilter =
    Boolean(debouncedQuery) || statusFilter !== 'all' || sourceTab !== 'all'

  return (
    <OLPageContentCard className="package-hub-page-card">
      <div className="package-hub-header">
        <div>
          <h1 className="package-hub-title">{t('package_hub_title')}</h1>
          <p className="package-hub-subtitle">{t('package_hub_subtitle')}</p>
        </div>

        <div className="package-hub-header-actions">
          <OLButton
            variant="secondary"
            size="sm"
            onClick={() => setShowDrawer(true)}
            leadingIcon="history"
          >
            <span>{t('package_hub_activity_btn')}</span>
            {activeJobsCount > 0 && (
              <span className="package-hub-badge package-hub-badge--custom ms-2">
                {activeJobsCount}
              </span>
            )}
          </OLButton>

          <OLButton
            variant="secondary"
            size="sm"
            onClick={() => setShowAdminModal(true)}
            leadingIcon="tune"
          >
            {t('package_hub_settings_btn')}
          </OLButton>

          {config.canUpload && (
            <OLButton
              variant="primary"
              size="sm"
              onClick={() => setShowUploadModal(true)}
              leadingIcon="add"
            >
              {t('package_hub_upload_btn')}
            </OLButton>
          )}
        </div>
      </div>

      {/* Quick Summary Strip */}
      <div className="package-hub-stats-grid">
        <button
          type="button"
          className={classNames('package-hub-stat-card', {
            'is-active': sourceTab === 'all' && statusFilter === 'all',
          })}
          onClick={() => {
            setSourceTab('all')
            setStatusFilter('all')
            setPage(1)
          }}
        >
          <span className="package-hub-stat-icon">
            <MaterialIcon type="inventory_2" />
          </span>
          <span className="package-hub-stat-body">
            <span className="d-block package-hub-stat-value">
              {counts.all.toLocaleString()}
            </span>
            <span className="d-block package-hub-stat-label">
              {t('package_hub_stat_total_label')}
            </span>
            <span className="d-block package-hub-stat-hint">
              {t('package_hub_stat_total_hint')}
            </span>
          </span>
        </button>

        <button
          type="button"
          className={classNames('package-hub-stat-card', {
            'is-active': sourceTab === 'all' && statusFilter === 'installed',
          })}
          onClick={() => {
            setSourceTab('all')
            setStatusFilter('installed')
            setPage(1)
          }}
        >
          <span className="package-hub-stat-icon">
            <MaterialIcon type="check_circle" />
          </span>
          <span className="package-hub-stat-body">
            <span className="d-block package-hub-stat-value">
              {counts.installed.toLocaleString()}
            </span>
            <span className="d-block package-hub-stat-label">
              {t('package_hub_stat_installed_label')}
            </span>
            <span className="d-block package-hub-stat-hint">
              {t('package_hub_stat_installed_hint')}
            </span>
          </span>
        </button>

        <button
          type="button"
          className={classNames('package-hub-stat-card', {
            'is-active': sourceTab === 'custom',
          })}
          onClick={() => {
            setSourceTab('custom')
            setStatusFilter('all')
            setPage(1)
          }}
        >
          <span className="package-hub-stat-icon">
            <MaterialIcon type="upload_file" />
          </span>
          <span className="package-hub-stat-body">
            <span className="d-block package-hub-stat-value">
              {counts.custom.toLocaleString()}
            </span>
            <span className="d-block package-hub-stat-label">
              {t('package_hub_stat_custom_label')}
            </span>
            <span className="d-block package-hub-stat-hint">
              {t('package_hub_stat_custom_hint')}
            </span>
          </span>
        </button>

        <button
          type="button"
          className={classNames('package-hub-stat-card', {
            'is-active': sourceTab === 'community',
          })}
          onClick={() => {
            setSourceTab('community')
            setPage(1)
          }}
        >
          <span className="package-hub-stat-icon">
            <MaterialIcon type="widgets" />
          </span>
          <span className="package-hub-stat-body">
            <span className="d-block package-hub-stat-value">
              {counts.community.toLocaleString()}
            </span>
            <span className="d-block package-hub-stat-label">
              {t('package_hub_stat_community_label')}
            </span>
            <span className="d-block package-hub-stat-hint">
              {t('package_hub_stat_community_hint')}
            </span>
          </span>
        </button>
      </div>

      {/* Layman How-To Hint */}
      <div className="package-hub-tip-banner">
        <MaterialIcon type="info" />
        <span>{t('package_hub_how_to_use_hint')}</span>
      </div>

      {/* Source Tabs using Overleaf's native .ol-tabs green-underline pattern */}
      <div className="ol-tabs package-hub-tabs">
        <div className="nav-tabs-container">
          <ul className="nav nav-tabs align-left" role="tablist">
            {SOURCE_TABS.map(tab => (
              <li key={tab.id} className="nav-item" role="presentation">
                <button
                  type="button"
                  role="tab"
                  aria-selected={sourceTab === tab.id}
                  className={classNames('nav-link', {
                    active: sourceTab === tab.id,
                  })}
                  onClick={() => {
                    setSourceTab(tab.id)
                    setPage(1)
                  }}
                >
                  {t(tab.key)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {sourceTab === 'community' ? (
        <CommunityPacksView
          manifests={manifests}
          loading={manifestsLoading}
          isAdmin={config.isAdmin}
          canMutate={config.canMutate}
          onJobStarted={(jobId, label) => trackJob(jobId, label)}
          onManifestRegistered={fetchCommunity}
        />
      ) : (
        <>
          {/* Search & Sort bar */}
          <div className="package-hub-controls">
            <div className="package-hub-search">
              <OLFormControl
                type="search"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder={t('package_hub_search_placeholder')}
                aria-label={t('package_hub_search_placeholder')}
                prepend={<MaterialIcon type="search" />}
                append={
                  searchInput ? (
                    <button
                      type="button"
                      className="form-control-search-clear-btn"
                      aria-label={t('clear')}
                      onClick={() => setSearchInput('')}
                    >
                      <MaterialIcon type="close" />
                    </button>
                  ) : null
                }
              />
            </div>

            <div className="package-hub-sort-group">
              <label htmlFor="pkg-sort-select">
                {t('package_hub_sort_label')}
              </label>
              <OLFormSelect
                id="pkg-sort-select"
                size="sm"
                value={sortBy}
                onChange={e => {
                  setSortBy(e.target.value as 'name' | 'size' | 'recent')
                  setPage(1)
                }}
              >
                <option value="name">{t('package_hub_sort_name')}</option>
                <option value="size">{t('package_hub_sort_size')}</option>
                <option value="recent">{t('package_hub_sort_recent')}</option>
              </OLFormSelect>
            </div>
          </div>

          {/* Filter Chips */}
          <div
            className="package-hub-filter-chips"
            role="group"
            aria-label="Filter packages"
          >
            {STATUS_FILTERS.map(chip => {
              const count = counts[chip.id]
              const isActive = statusFilter === chip.id
              return (
                <button
                  key={chip.id}
                  type="button"
                  aria-pressed={isActive}
                  className={classNames('package-hub-chip', {
                    'is-active': isActive,
                  })}
                  onClick={() => {
                    setStatusFilter(chip.id)
                    setPage(1)
                  }}
                >
                  <span>{t(chip.key)}</span>
                  <span className="package-hub-chip-count">
                    {count.toLocaleString()}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Bulk Actions Bar */}
          {selectedItems.length > 0 && (
            <div className="package-hub-bulk-bar">
              <span className="fw-semibold small">
                {t('package_hub_bulk_selected', {
                  count: selectedItems.length,
                })}
              </span>
              <div className="d-flex flex-wrap align-items-center gap-2">
                {selectedItems.some(
                  p => !p.installed && p.source !== 'community'
                ) && (
                  <OLButton
                    size="sm"
                    variant="primary"
                    disabled={!config.canMutate}
                    onClick={handleBulkInstall}
                    leadingIcon="download"
                  >
                    {t('package_hub_bulk_install')}
                  </OLButton>
                )}
                {selectedItems.some(p => p.update_available) && (
                  <OLButton
                    size="sm"
                    variant="secondary"
                    disabled={!config.canMutate}
                    onClick={() =>
                      handleUpdateList(
                        selectedItems
                          .filter(p => p.update_available)
                          .map(p => p.name)
                      )
                    }
                    leadingIcon="sync"
                  >
                    {t('package_hub_bulk_update')}
                  </OLButton>
                )}
                {selectedItems.some(p => p.installed && !p.protected) && (
                  <OLButton
                    size="sm"
                    variant="danger"
                    disabled={!config.canMutate}
                    onClick={() =>
                      setRemoveTargets(
                        selectedItems.filter(p => p.installed && !p.protected)
                      )
                    }
                    leadingIcon="delete"
                  >
                    {t('package_hub_bulk_remove')}
                  </OLButton>
                )}
                <OLButton
                  size="sm"
                  variant="link"
                  onClick={() => setSelectedMap(new Map())}
                >
                  {t('package_hub_bulk_clear')}
                </OLButton>
              </div>
            </div>
          )}

          {listError && (
            <Notification
              type="error"
              content={listError}
              className="mb-4"
              action={
                <OLButton size="sm" variant="secondary" onClick={fetchPackages}>
                  {t('package_hub_action_retry')}
                </OLButton>
              }
            />
          )}

          {/* Package Grid */}
          {loading ? (
            <OLRow className="g-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <OLCol key={idx} md={6} lg={4}>
                  <div
                    className="package-hub-skeleton-card"
                    aria-hidden="true"
                  />
                </OLCol>
              ))}
            </OLRow>
          ) : packages.length === 0 ? (
            <Notification
              type="info"
              title={t('package_hub_empty_title')}
              content={
                sourceTab === 'custom'
                  ? t('package_hub_empty_custom')
                  : t('package_hub_empty_search')
              }
              action={
                sourceTab === 'custom' && config.canUpload ? (
                  <OLButton
                    size="sm"
                    variant="primary"
                    onClick={() => setShowUploadModal(true)}
                  >
                    {t('package_hub_upload_btn')}
                  </OLButton>
                ) : hasActiveFilter ? (
                  <OLButton
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSearchInput('')
                      setDebouncedQuery('')
                      setStatusFilter('all')
                      setSourceTab('all')
                      setPage(1)
                    }}
                  >
                    Reset Filters
                  </OLButton>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="package-hub-results-bar">
                <span>
                  {t('package_hub_showing_count', {
                    shown: packages.length,
                    total: totalCount,
                  })}
                </span>
                {hasActiveFilter && (
                  <OLButton
                    size="sm"
                    variant="link"
                    className="px-0"
                    onClick={() => {
                      setSearchInput('')
                      setDebouncedQuery('')
                      setStatusFilter('all')
                      setSourceTab('all')
                      setPage(1)
                    }}
                  >
                    Reset Filters
                  </OLButton>
                )}
              </div>

              <OLRow className="g-4">
                {packages.map(pkg => (
                  <OLCol key={pkg.id} md={6} lg={4}>
                    <PackageCard
                      pkg={pkg}
                      selected={selectedMap.has(`${pkg.source}:${pkg.name}`)}
                      busy={busyNames.has(pkg.name)}
                      hasError={errorNames.has(pkg.name)}
                      canMutate={config.canMutate}
                      onToggleSelect={toggleSelect}
                      onInstall={handleInstallOne}
                      onUpdate={p => handleUpdateList([p.name])}
                      onRequestRemove={p => setRemoveTargets([p])}
                      onOpenDetails={p => setDetailsPkg(p)}
                    />
                  </OLCol>
                ))}
              </OLRow>

              {totalPages > 1 && (
                <div className="d-flex justify-content-center mt-5">
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    handlePageClick={(
                      event: React.SyntheticEvent,
                      nextPage: number
                    ) => {
                      event.preventDefault()
                      setPage(nextPage)
                    }}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Modals & Drawer */}
      <PackageDetailsModal
        pkg={detailsPkg}
        canMutate={config.canMutate}
        busy={detailsPkg ? busyNames.has(detailsPkg.name) : false}
        onClose={() => setDetailsPkg(null)}
        onInstall={handleInstallOne}
        onUpdate={p => handleUpdateList([p.name])}
        onRequestRemove={p => setRemoveTargets([p])}
      />

      <PackageUploadModal
        show={showUploadModal}
        onHide={() => setShowUploadModal(false)}
        onJobStarted={(jobId, label) => {
          trackJob(jobId, label)
          setShowDrawer(true)
        }}
      />

      <ConfirmRemoveModal
        names={removeTargets.map(tItem => tItem.name)}
        busy={removeTargets.some(tItem => busyNames.has(tItem.name))}
        onCancel={() => setRemoveTargets([])}
        onConfirm={handleConfirmRemove}
      />

      <AdminSettingsModal
        show={showAdminModal}
        onHide={() => setShowAdminModal(false)}
        isAdmin={config.isAdmin}
        onReconciled={() => {
          fetchPackages()
          fetchCommunity()
          fetchActivity()
        }}
      />

      <ActivityDrawer
        show={showDrawer}
        onHide={() => setShowDrawer(false)}
        jobs={jobs}
        auditEntries={auditEntries}
        highlightedJobId={highlightedJobId}
        onRefresh={fetchActivity}
        canMutate={config.canMutate}
        clearingHistory={clearingHistory}
        onClearHistory={handleClearHistory}
      />

      <OLToastContainer
        className="position-fixed bottom-0 end-0 p-3"
        style={{ zIndex: 1080 }}
      >
        {toasts.map(toast => (
          <OLToast
            key={toast.id}
            type={toast.type}
            title={toast.title}
            isDismissible
            autoHide={toast.type !== 'error'}
            delay={5000}
            onDismiss={() => dismissToast(toast.id)}
            content={
              <div>
                <div>{toast.content}</div>
                {toast.jobId && (
                  <OLButton
                    variant="link"
                    size="sm"
                    className="px-0 pt-1"
                    onClick={() => {
                      setHighlightedJobId(toast.jobId!)
                      setShowDrawer(true)
                    }}
                  >
                    {t('package_hub_action_view_log')}
                  </OLButton>
                )}
              </div>
            }
          />
        ))}
      </OLToastContainer>
    </OLPageContentCard>
  )
}
