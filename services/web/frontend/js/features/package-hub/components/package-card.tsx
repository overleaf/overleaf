import classNames from 'classnames'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import OLButton from '@/shared/components/ol/ol-button'
import OLCard from '@/shared/components/ol/ol-card'
import OLFormCheckbox from '@/shared/components/ol/ol-form-checkbox'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import type { PackageItem } from '../types'

function copyTextSafe(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => false)
  }
  try {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return Promise.resolve(ok)
  } catch {
    return Promise.resolve(false)
  }
}

export function SourcePill({ source }: { source: PackageItem['source'] }) {
  const { t } = useTranslation()
  const labelMap: Record<PackageItem['source'], string> = {
    texlive: t('package_hub_tab_texlive'),
    ctan: t('package_hub_tab_ctan'),
    custom: t('package_hub_tab_custom'),
    community: t('package_hub_filter_community'),
  }
  return (
    <span className="package-hub-badge package-hub-badge--source">
      {labelMap[source]}
    </span>
  )
}

export function StatusPill({
  pkg,
  hasError,
}: {
  pkg: PackageItem
  hasError?: boolean
}) {
  const { t } = useTranslation()

  if (hasError) {
    return (
      <span className="package-hub-badge package-hub-badge--error">
        <MaterialIcon type="error" />
        <span>{t('package_hub_status_error')}</span>
      </span>
    )
  }

  if (pkg.source === 'custom') {
    return (
      <span className="package-hub-badge package-hub-badge--custom">
        <MaterialIcon type="extension" />
        <span>{t('package_hub_status_custom')}</span>
      </span>
    )
  }

  if (pkg.update_available) {
    return (
      <span className="package-hub-badge package-hub-badge--update">
        <MaterialIcon type="sync" />
        <span>{t('package_hub_status_update')}</span>
      </span>
    )
  }

  if (pkg.installed) {
    return (
      <span className="package-hub-badge package-hub-badge--installed">
        <MaterialIcon type="check_circle" />
        <span>{t('package_hub_status_installed')}</span>
      </span>
    )
  }

  return (
    <span className="package-hub-badge package-hub-badge--available">
      <MaterialIcon type="download" />
      <span>{t('package_hub_status_available')}</span>
    </span>
  )
}

export default function PackageCard({
  pkg,
  selected,
  busy,
  hasError,
  canMutate,
  onToggleSelect,
  onInstall,
  onUpdate,
  onRequestRemove,
  onOpenDetails,
}: {
  pkg: PackageItem
  selected: boolean
  busy: boolean
  hasError: boolean
  canMutate: boolean
  onToggleSelect: (pkg: PackageItem) => void
  onInstall: (pkg: PackageItem) => void
  onUpdate: (pkg: PackageItem) => void
  onRequestRemove: (pkg: PackageItem) => void
  onOpenDetails: (pkg: PackageItem) => void
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current)
    }
  }, [])

  const safeSlug = pkg.name.replace(/[^a-zA-Z0-9_-]/g, '_')
  const tooltipId = `pkg-desc-${pkg.source}-${safeSlug}`
  const cardId = `pkg-card-${pkg.source}-${pkg.name}`
  const usageSnippet = pkg.topics?.includes('class')
    ? `\\documentclass{${pkg.name}}`
    : `\\usepackage{${pkg.name}}`

  const handleCopySnippet = useCallback(() => {
    copyTextSafe(usageSnippet).then(ok => {
      if (!ok) return
      setCopied(true)
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current)
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 1600)
    })
  }, [usageSnippet])

  const removeButton = (
    <OLButton
      size="sm"
      variant="secondary"
      isLoading={busy}
      disabled={!canMutate || Boolean(pkg.protected)}
      onClick={() => onRequestRemove(pkg)}
      leadingIcon="delete_outline"
    >
      {pkg.source === 'custom'
        ? t('package_hub_action_remove')
        : t('package_hub_action_uninstall')}
    </OLButton>
  )

  return (
    <OLCard
      className={classNames('package-hub-card h-100', {
        'package-hub-card-selected': selected,
        'package-hub-card-installed': pkg.installed,
      })}
      data-testid={cardId}
    >
      <div className="package-hub-card-inner">
        <div className="package-hub-card-header">
          <div className="package-hub-card-title-wrap">
            <div className="package-hub-card-select">
              <OLFormCheckbox
                id={`select-${pkg.source}-${safeSlug}`}
                checked={selected}
                onChange={() => onToggleSelect(pkg)}
                aria-label={`Select ${pkg.name}`}
                disabled={busy}
              />
            </div>
            <h3 className="package-hub-pkg-name" title={pkg.name} translate="no">
              {pkg.name}
            </h3>
            {pkg.version && (
              <span className="package-hub-badge package-hub-badge--version">
                v{pkg.version}
              </span>
            )}
          </div>
          <StatusPill pkg={pkg} hasError={hasError} />
        </div>

        <OLTooltip
          id={tooltipId}
          description={pkg.description || pkg.shortdesc || pkg.name}
        >
          <p className="package-hub-card-desc" tabIndex={0}>
            {pkg.shortdesc || pkg.description || 'LaTeX package'}
          </p>
        </OLTooltip>

        <div className="package-hub-card-snippet">
          <code translate="no" title={usageSnippet}>
            {usageSnippet}
          </code>
          <button
            type="button"
            className={classNames('package-hub-copy-btn', {
              'is-copied': copied,
            })}
            onClick={handleCopySnippet}
            aria-label={`Copy ${usageSnippet}`}
          >
            <MaterialIcon type={copied ? 'check' : 'content_copy'} />
            <span>
              {copied
                ? t('package_hub_copied')
                : t('package_hub_copy_command')}
            </span>
          </button>
        </div>

        <div className="package-hub-card-meta">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <SourcePill source={pkg.source} />
            {pkg.protected && (
              <OLTooltip
                id={`pkg-protected-${pkg.source}-${safeSlug}`}
                description={t('package_hub_status_protected_hint')}
              >
                <span className="package-hub-badge package-hub-badge--protected">
                  <MaterialIcon type="lock" />
                  <span>{t('package_hub_status_protected')}</span>
                </span>
              </OLTooltip>
            )}
          </div>
          <div className="package-hub-card-meta-stats">
            <span>{pkg.size_kb ? `${pkg.size_kb} KB` : '-'}</span>
            {pkg.license && pkg.license !== 'unknown' && (
              <span className="text-uppercase">{pkg.license}</span>
            )}
          </div>
        </div>

        <div className="package-hub-card-footer">
          <OLButton
            variant="link"
            size="sm"
            onClick={() => onOpenDetails(pkg)}
            className="px-0"
          >
            {t('package_hub_action_details')}
          </OLButton>

          <div className="d-flex align-items-center gap-2">
            {pkg.update_available && canMutate && (
              <OLButton
                size="sm"
                variant="secondary"
                isLoading={busy}
                onClick={() => onUpdate(pkg)}
                leadingIcon="sync"
              >
                {t('package_hub_action_update')}
              </OLButton>
            )}

            {hasError && canMutate ? (
              <OLButton
                size="sm"
                variant="secondary"
                isLoading={busy}
                onClick={() => onInstall(pkg)}
                leadingIcon="refresh"
              >
                {t('package_hub_action_retry')}
              </OLButton>
            ) : pkg.installed ? (
              pkg.protected ? (
                <OLTooltip
                  id={`pkg-rm-lock-${pkg.source}-${safeSlug}`}
                  description={t('package_hub_status_protected_hint')}
                >
                  <span className="d-inline-block" tabIndex={0}>
                    {removeButton}
                  </span>
                </OLTooltip>
              ) : (
                removeButton
              )
            ) : (
              <OLButton
                size="sm"
                variant="primary"
                isLoading={busy}
                disabled={!canMutate}
                onClick={() => onInstall(pkg)}
                leadingIcon="download"
              >
                {t('package_hub_action_install')}
              </OLButton>
            )}
          </div>
        </div>
      </div>
    </OLCard>
  )
}
