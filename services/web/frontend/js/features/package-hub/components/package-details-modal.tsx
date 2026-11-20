import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyToClipboard } from '@/shared/components/copy-to-clipboard'
import MaterialIcon from '@/shared/components/material-icon'
import OLButton from '@/shared/components/ol/ol-button'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLSpinner from '@/shared/components/ol/ol-spinner'
import type { PackageItem } from '../types'
import { getPackageDetail } from '../util/api'

export default function PackageDetailsModal({
  pkg,
  canMutate,
  busy,
  onClose,
  onInstall,
  onUpdate,
  onRequestRemove,
}: {
  pkg: PackageItem | null
  canMutate: boolean
  busy: boolean
  onClose: () => void
  onInstall: (pkg: PackageItem) => void
  onUpdate: (pkg: PackageItem) => void
  onRequestRemove: (pkg: PackageItem) => void
}) {
  const { t } = useTranslation()
  const [detail, setDetail] = useState<PackageItem | null>(pkg)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setDetail(pkg)
    if (!pkg) return
    let active = true
    setLoading(true)
    getPackageDetail(pkg.name)
      .then(full => {
        if (active && full) setDetail(full)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [pkg])

  const activePkg = detail || pkg
  if (!activePkg) return null

  const usageSnippet =
    activePkg.topics?.includes('class')
      ? `\\documentclass{${activePkg.name}}`
      : `\\usepackage{${activePkg.name}}`

  return (
    <OLModal
      show={Boolean(pkg)}
      onHide={onClose}
      size="lg"
      id="package-details-modal"
    >
      <OLModalHeader>
        <OLModalTitle className="d-flex align-items-center gap-2 flex-wrap">
          <span className="font-monospace" translate="no">
            {activePkg.name}
          </span>
          {activePkg.version && (
            <span className="package-hub-badge package-hub-badge--version">
              v{activePkg.version}
            </span>
          )}
          {activePkg.installed ? (
            <span className="package-hub-badge package-hub-badge--installed">
              <MaterialIcon type="check_circle" />
              <span>{t('package_hub_status_installed')}</span>
            </span>
          ) : (
            <span className="package-hub-badge package-hub-badge--available">
              <MaterialIcon type="download" />
              <span>{t('package_hub_status_available')}</span>
            </span>
          )}
        </OLModalTitle>
      </OLModalHeader>

      <OLModalBody>
        {loading && (
          <div
            className="d-flex align-items-center gap-2 mb-3 small"
            style={{ color: 'var(--content-secondary)' }}
          >
            <OLSpinner size="sm" />
            <span>Loading full package metadata...</span>
          </div>
        )}

        <p className="mb-4" style={{ color: 'var(--content-primary)' }}>
          {activePkg.longdesc || activePkg.description || 'LaTeX package'}
        </p>

        <div className="package-hub-usage-box mb-4">
          <div className="package-hub-meta-label">
            {t('package_hub_details_usage')}
          </div>
          <div className="d-flex align-items-center justify-content-between gap-2">
            <code translate="no">{usageSnippet}</code>
            <CopyToClipboard
              content={usageSnippet}
              tooltipId="copy-pkg-usage"
              kind="button"
            />
          </div>
        </div>

        <div className="row g-3 mb-4">
          <div className="col-sm-6">
            <div className="package-hub-meta-label">
              {t('package_hub_details_source')}
            </div>
            <div className="package-hub-meta-value text-uppercase">
              {activePkg.source}
            </div>
          </div>
          <div className="col-sm-6">
            <div className="package-hub-meta-label">
              {t('package_hub_details_version')}
            </div>
            <div className="package-hub-meta-value">
              {activePkg.version || '-'}
              {activePkg.installed_version &&
                ` (installed: ${activePkg.installed_version})`}
            </div>
          </div>
          <div className="col-sm-6">
            <div className="package-hub-meta-label">
              {t('package_hub_details_license')}
            </div>
            <div className="package-hub-meta-value">
              {activePkg.license || 'unknown'}
            </div>
          </div>
          <div className="col-sm-6">
            <div className="package-hub-meta-label">
              {t('package_hub_details_size')}
            </div>
            <div className="package-hub-meta-value">
              {activePkg.size_kb ? `${activePkg.size_kb} KB` : '-'}
            </div>
          </div>
          {activePkg.author && (
            <div className="col-sm-6">
              <div className="package-hub-meta-label">
                {t('package_hub_details_author')}
              </div>
              <div className="package-hub-meta-value">{activePkg.author}</div>
            </div>
          )}
          {activePkg.homepage && (
            <div className="col-sm-6">
              <div className="package-hub-meta-label">
                {t('package_hub_details_homepage')}
              </div>
              <div className="package-hub-meta-value text-truncate">
                <a
                  href={activePkg.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {activePkg.homepage}
                </a>
              </div>
            </div>
          )}
        </div>

        {activePkg.dependencies && activePkg.dependencies.length > 0 && (
          <div className="mb-4">
            <div className="package-hub-meta-label mb-2">
              {t('package_hub_details_dependencies')} (
              {activePkg.dependencies.length})
            </div>
            <div className="d-flex flex-wrap gap-2">
              {activePkg.dependencies.map(dep => (
                <span
                  key={dep}
                  className="package-hub-badge package-hub-badge--available package-hub-badge--mono"
                >
                  {dep}
                </span>
              ))}
            </div>
          </div>
        )}

        {activePkg.runfiles && activePkg.runfiles.length > 0 && (
          <div>
            <div className="package-hub-meta-label mb-2">
              {t('package_hub_details_files')} ({activePkg.runfiles.length})
            </div>
            <pre className="package-hub-terminal-log mb-0">
              {activePkg.runfiles.slice(0, 40).join('\n')}
            </pre>
          </div>
        )}
      </OLModalBody>

      <OLModalFooter>
        <OLButton variant="secondary" onClick={onClose}>
          {t('close')}
        </OLButton>
        {activePkg.update_available && canMutate && (
          <OLButton
            variant="secondary"
            isLoading={busy}
            onClick={() => onUpdate(activePkg)}
            leadingIcon="sync"
          >
            {t('package_hub_action_update')}
          </OLButton>
        )}
        {activePkg.installed ? (
          <OLButton
            variant="danger"
            isLoading={busy}
            disabled={!canMutate || Boolean(activePkg.protected)}
            onClick={() => {
              onClose()
              onRequestRemove(activePkg)
            }}
            leadingIcon="delete"
          >
            {activePkg.source === 'custom'
              ? t('package_hub_action_remove')
              : t('package_hub_action_uninstall')}
          </OLButton>
        ) : (
          <OLButton
            variant="primary"
            isLoading={busy}
            disabled={!canMutate}
            onClick={() => onInstall(activePkg)}
            leadingIcon="download"
          >
            {t('package_hub_action_install')}
          </OLButton>
        )}
      </OLModalFooter>
    </OLModal>
  )
}
