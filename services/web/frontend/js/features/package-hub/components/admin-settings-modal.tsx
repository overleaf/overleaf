import classNames from 'classnames'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Notification from '@/shared/components/notification'
import OLButton from '@/shared/components/ol/ol-button'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import type { SourceHealth } from '../types'
import {
  getSources,
  reconcilePackages,
  setTexliveMirror,
  snapshotEnvironment,
} from '../util/api'

const PRESET_MIRRORS = [
  'https://mirror.ctan.org/systems/texlive/tlnet',
  'https://ctan.math.utah.edu/ctan/tex-archive/systems/texlive/tlnet',
  'https://mirror.ox.ac.uk/sites/ctan.org/systems/texlive/tlnet',
  'https://mirrors.tuna.tsinghua.edu.cn/CTAN/systems/texlive/tlnet',
]

export default function AdminSettingsModal({
  show,
  onHide,
  isAdmin,
  onReconciled,
}: {
  show: boolean
  onHide: () => void
  isAdmin: boolean
  onReconciled: () => void
}) {
  const { t } = useTranslation()
  const [sources, setSources] = useState<SourceHealth[]>([])
  const [mirrorUrl, setMirrorUrl] = useState(PRESET_MIRRORS[0])
  const [savingMirror, setSavingMirror] = useState(false)
  const [reconciling, setReconciling] = useState(false)
  const [snapshotting, setSnapshotting] = useState(false)
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    msg: string
  } | null>(null)

  useEffect(() => {
    if (!show) return
    setFeedback(null)
    getSources()
      .then(list => {
        setSources(list)
        const tl = list.find(s => s.id === 'texlive')
        if (tl?.mirrorUrl) setMirrorUrl(tl.mirrorUrl)
      })
      .catch(() => {})
  }, [show])

  const handleSaveMirror = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingMirror(true)
    setFeedback(null)
    try {
      const res = await setTexliveMirror(mirrorUrl.trim())
      setFeedback({
        type: 'success',
        msg: `TeX Live mirror updated to ${res.mirrorUrl}`,
      })
      const updated = await getSources()
      setSources(updated)
    } catch (err: any) {
      setFeedback({
        type: 'error',
        msg: err?.data?.error || err?.message || 'Mirror update failed',
      })
    } finally {
      setSavingMirror(false)
    }
  }

  const handleReconcile = async () => {
    setReconciling(true)
    setFeedback(null)
    try {
      const res = await reconcilePackages()
      setFeedback({
        type: 'success',
        msg: `Reconciled texmf-local & TLPDB cleanly (custom +${res.report?.discoveredCustom?.length || 0}, repaired +${res.report?.repairedTexlive?.length || 0}).`,
      })
      onReconciled()
    } catch (err: any) {
      setFeedback({
        type: 'error',
        msg: err?.data?.error || err?.message || 'Reconciliation failed',
      })
    } finally {
      setReconciling(false)
    }
  }

  const handleSnapshot = async () => {
    setSnapshotting(true)
    setFeedback(null)
    try {
      const res = await snapshotEnvironment()
      setFeedback({ type: 'success', msg: res.message })
    } catch (err: any) {
      setFeedback({
        type: 'error',
        msg: err?.data?.error || err?.message || 'Snapshot failed',
      })
    } finally {
      setSnapshotting(false)
    }
  }

  return (
    <OLModal
      show={show}
      onHide={onHide}
      size="lg"
      id="package-hub-admin-modal"
    >
      <OLModalHeader>
        <OLModalTitle>{t('package_hub_settings_btn')}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody>
        {feedback && (
          <Notification
            type={feedback.type}
            content={feedback.msg}
            className="mb-4"
            isDismissible
            onDismiss={() => setFeedback(null)}
          />
        )}

        <h3 className="package-hub-modal-section-title">
          Configured Package Sources
        </h3>
        <div className="d-flex flex-column gap-2 mb-4">
          {sources.map(src => (
            <div
              key={src.id}
              className="d-flex justify-content-between align-items-center p-3 border rounded"
              style={{
                backgroundColor: 'var(--neutral-05)',
                borderColor: 'var(--border-divider)',
              }}
            >
              <div className="min-w-0 me-3">
                <div
                  className="fw-semibold"
                  style={{ color: 'var(--content-primary)' }}
                >
                  {src.name}
                </div>
                <div
                  className="small text-truncate"
                  style={{ color: 'var(--content-secondary)' }}
                >
                  {src.mirrorUrl ||
                    src.endpoint ||
                    src.texmfDir ||
                    'Manifest registry'}
                </div>
              </div>
              <span
                className={classNames(
                  'package-hub-badge',
                  src.healthy
                    ? 'package-hub-badge--installed'
                    : 'package-hub-badge--error'
                )}
              >
                {src.healthy ? 'Healthy' : 'Offline'}
              </span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSaveMirror} className="mb-4">
          <OLFormGroup className="mb-2">
            <OLFormLabel htmlFor="tlmgr-mirror-input">
              {t('package_hub_admin_mirror_label')}
            </OLFormLabel>
            <OLFormControl
              id="tlmgr-mirror-input"
              type="url"
              value={mirrorUrl}
              onChange={e => setMirrorUrl(e.target.value)}
              disabled={!isAdmin}
            />
          </OLFormGroup>
          <div className="d-flex flex-wrap gap-2 mb-3">
            {PRESET_MIRRORS.map(m => (
              <OLButton
                key={m}
                size="sm"
                variant="link"
                type="button"
                className="px-0 me-2"
                disabled={!isAdmin}
                onClick={() => setMirrorUrl(m)}
              >
                {new URL(m).hostname}
              </OLButton>
            ))}
          </div>
          <OLButton
            variant="primary"
            size="sm"
            type="submit"
            disabled={!isAdmin}
            isLoading={savingMirror}
          >
            {t('package_hub_admin_save_mirror')}
          </OLButton>
        </form>

        <hr />

        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div className="d-flex flex-wrap gap-2">
            <OLButton
              variant="secondary"
              size="sm"
              isLoading={reconciling}
              onClick={handleReconcile}
              leadingIcon="sync"
            >
              {t('package_hub_admin_reconcile_btn')}
            </OLButton>
            {isAdmin && (
              <OLButton
                variant="secondary"
                size="sm"
                isLoading={snapshotting}
                onClick={handleSnapshot}
                leadingIcon="save"
              >
                {t('package_hub_admin_snapshot_btn')}
              </OLButton>
            )}
          </div>
          <a
            href="/api/packages/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="small"
          >
            {t('package_hub_admin_openapi_link')}
          </a>
        </div>
      </OLModalBody>

      <OLModalFooter>
        <OLButton variant="secondary" onClick={onHide}>
          {t('close')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
