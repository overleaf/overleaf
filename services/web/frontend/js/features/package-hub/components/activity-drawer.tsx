import classNames from 'classnames'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Offcanvas, ProgressBar } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import OLButton from '@/shared/components/ol/ol-button'
import { OLOffcanvas } from '@/shared/components/ol/ol-offcanvas'
import type { AuditEntry, JobItem } from '../types'

function JobTerminalLog({
  lines,
  fallback,
}: {
  lines?: string[]
  fallback?: string | null
}) {
  const preRef = useRef<HTMLPreElement | null>(null)

  useEffect(() => {
    const el = preRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [lines?.length])

  return (
    <pre ref={preRef} className="package-hub-terminal-log mt-2 mb-0">
      {lines?.length ? lines.join('\n') : fallback || 'No output logged.'}
    </pre>
  )
}

export default function ActivityDrawer({
  show,
  onHide,
  jobs,
  auditEntries,
  highlightedJobId,
  onRefresh,
  canMutate = true,
  clearingHistory = false,
  onClearHistory,
}: {
  show: boolean
  onHide: () => void
  jobs: JobItem[]
  auditEntries: AuditEntry[]
  highlightedJobId: string | null
  onRefresh: () => void
  canMutate?: boolean
  clearingHistory?: boolean
  onClearHistory?: () => void
}) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'jobs' | 'audit'>('jobs')
  const [expandedJobId, setExpandedJobId] = useState<string | null>(
    highlightedJobId
  )
  const [canScrollDown, setCanScrollDown] = useState(false)
  const [canScrollUp, setCanScrollUp] = useState(false)

  const scrollAreaRef = useRef<HTMLDivElement | null>(null)
  const jobItemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    if (highlightedJobId) {
      setExpandedJobId(highlightedJobId)
      setActiveTab('jobs')
    }
  }, [highlightedJobId])

  const updateScrollState = useCallback(() => {
    const el = scrollAreaRef.current
    if (!el) {
      setCanScrollDown(false)
      setCanScrollUp(false)
      return
    }
    const maxScroll = el.scrollHeight - el.clientHeight
    setCanScrollUp(el.scrollTop > 100)
    setCanScrollDown(maxScroll > 12 && el.scrollTop < maxScroll - 12)
  }, [])

  useEffect(() => {
    if (!show) return
    const rafId = window.requestAnimationFrame(updateScrollState)
    const el = scrollAreaRef.current
    if (!el) return () => window.cancelAnimationFrame(rafId)

    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateScrollState)
      ro.observe(el)
      if (el.firstElementChild) {
        ro.observe(el.firstElementChild)
      }
    }
    return () => {
      window.cancelAnimationFrame(rafId)
      ro?.disconnect()
    }
  }, [
    show,
    activeTab,
    jobs.length,
    auditEntries.length,
    expandedJobId,
    updateScrollState,
  ])

  useEffect(() => {
    if (!show || !highlightedJobId || activeTab !== 'jobs') return
    const target = jobItemRefs.current.get(highlightedJobId)
    if (target) {
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [show, highlightedJobId, activeTab, jobs.length])

  const scrollToBottom = () => {
    const el = scrollAreaRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }

  const scrollToTop = () => {
    const el = scrollAreaRef.current
    if (!el) return
    el.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const hasClearableJobs = jobs.some(
    j => j.status !== 'running' && j.status !== 'queued'
  )
  const hasClearableHistory = hasClearableJobs || auditEntries.length > 0

  return (
    <OLOffcanvas
      show={show}
      onHide={onHide}
      placement="end"
      className="package-hub-drawer"
    >
      <Offcanvas.Header closeButton closeLabel={t('close')}>
        <Offcanvas.Title>{t('package_hub_drawer_title')}</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        <div className="package-hub-drawer-toolbar">
          <div className="ol-tabs package-hub-drawer-tabs flex-grow-1">
            <div className="nav-tabs-container">
              <ul className="nav nav-tabs align-left mb-0" role="tablist">
                <li className="nav-item" role="presentation">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'jobs'}
                    className={classNames('nav-link', {
                      active: activeTab === 'jobs',
                    })}
                    onClick={() => setActiveTab('jobs')}
                  >
                    {t('package_hub_drawer_jobs')} ({jobs.length})
                  </button>
                </li>
                <li className="nav-item" role="presentation">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'audit'}
                    className={classNames('nav-link', {
                      active: activeTab === 'audit',
                    })}
                    onClick={() => setActiveTab('audit')}
                  >
                    {t('package_hub_drawer_audit')} ({auditEntries.length})
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="package-hub-drawer-actions">
            {canMutate && onClearHistory && (
              <OLButton
                variant="danger-ghost"
                size="sm"
                onClick={onClearHistory}
                disabled={!hasClearableHistory || clearingHistory}
                isLoading={clearingHistory}
                loadingLabel={t('package_hub_drawer_clearing')}
                leadingIcon="delete"
              >
                {t('package_hub_drawer_clear_btn')}
              </OLButton>
            )}

            <OLButton
              variant="secondary"
              size="sm"
              onClick={onRefresh}
              leadingIcon="refresh"
            >
              Refresh
            </OLButton>
          </div>
        </div>

        <div className="package-hub-drawer-scroll-wrapper">
          <div
            ref={scrollAreaRef}
            className="package-hub-drawer-scroll-area"
            onScroll={updateScrollState}
          >
            {activeTab === 'jobs' ? (
              jobs.length === 0 ? (
                <p
                  className="small mb-0"
                  style={{ color: 'var(--content-secondary)' }}
                >
                  {t('package_hub_drawer_no_jobs')}
                </p>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {jobs.map(job => {
                    const isOpen = expandedJobId === job.id
                    const pillModifier =
                      job.status === 'success'
                        ? 'package-hub-badge--installed'
                        : job.status === 'failed'
                          ? 'package-hub-badge--error'
                          : job.status === 'running'
                            ? 'package-hub-badge--custom'
                            : 'package-hub-badge--available'
                    return (
                      <div
                        key={job.id}
                        ref={node => {
                          if (node) jobItemRefs.current.set(job.id, node)
                          else jobItemRefs.current.delete(job.id)
                        }}
                        className="package-hub-job-item"
                      >
                        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                          <div className="min-w-0">
                            <div className="fw-semibold text-truncate">
                              {job.message}
                            </div>
                            <div
                              className="small"
                              style={{ color: 'var(--neutral-60)' }}
                            >
                              {job.phase} &bull;{' '}
                              {new Date(job.created_at).toLocaleTimeString()}
                            </div>
                          </div>
                          <span
                            className={classNames(
                              'package-hub-badge',
                              pillModifier
                            )}
                          >
                            {job.status}
                          </span>
                        </div>

                        <ProgressBar
                          now={job.progress}
                          label={`${job.progress}%`}
                          variant={
                            job.status === 'failed'
                              ? 'danger'
                              : job.status === 'success'
                                ? 'success'
                                : undefined
                          }
                          animated={job.status === 'running'}
                          className="my-2"
                        />

                        <div className="d-flex justify-content-between align-items-center gap-2">
                          <OLButton
                            variant="link"
                            size="sm"
                            className="px-0"
                            onClick={() =>
                              setExpandedJobId(isOpen ? null : job.id)
                            }
                          >
                            {isOpen
                              ? 'Hide Log'
                              : t('package_hub_action_view_log')}
                          </OLButton>
                          {job.error && (
                            <span
                              className="small text-truncate d-inline-flex align-items-center gap-1"
                              style={{ color: 'var(--red-60)' }}
                            >
                              <MaterialIcon type="warning" /> {job.error}
                            </span>
                          )}
                        </div>

                        {isOpen && (
                          <JobTerminalLog
                            lines={job.log}
                            fallback={job.error}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            ) : auditEntries.length === 0 ? (
              <p
                className="small mb-0"
                style={{ color: 'var(--content-secondary)' }}
              >
                {t('package_hub_drawer_no_audit')}
              </p>
            ) : (
              <div className="d-flex flex-column gap-3">
                {auditEntries.map((entry, idx) => {
                  const pillModifier =
                    entry.result === 'success'
                      ? 'package-hub-badge--installed'
                      : entry.result === 'blocked'
                        ? 'package-hub-badge--update'
                        : 'package-hub-badge--error'
                  return (
                    <div
                      key={entry.id || entry._id || `${entry.timestamp}-${idx}`}
                      className="package-hub-audit-item"
                    >
                      <div className="d-flex justify-content-between align-items-center gap-2 mb-1">
                        <strong className="font-monospace">
                          {entry.package_name}
                        </strong>
                        <span
                          className={classNames(
                            'package-hub-badge',
                            pillModifier
                          )}
                        >
                          {entry.result}
                        </span>
                      </div>
                      <div
                        className="small"
                        style={{ color: 'var(--content-secondary)' }}
                      >
                        {entry.action} ({entry.source}) &bull;{' '}
                        {entry.user_email || entry.user_id}
                      </div>
                      {entry.details && (
                        <div className="small mt-1">{entry.details}</div>
                      )}
                      <div
                        className="small mt-1"
                        style={{ color: 'var(--neutral-60)' }}
                      >
                        {new Date(entry.timestamp).toLocaleString()}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {(canScrollDown || canScrollUp) && (
            <div className="package-hub-scroll-nav">
              {canScrollDown && (
                <button
                  type="button"
                  className="package-hub-scroll-pill"
                  onClick={scrollToBottom}
                >
                  <MaterialIcon type="arrow_downward" />
                  <span>{t('package_hub_drawer_scroll_bottom')}</span>
                </button>
              )}
              {canScrollUp && (
                <button
                  type="button"
                  className="package-hub-scroll-pill"
                  onClick={scrollToTop}
                >
                  <MaterialIcon type="arrow_upward" />
                  <span>{t('package_hub_drawer_scroll_top')}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </Offcanvas.Body>
    </OLOffcanvas>
  )
}
