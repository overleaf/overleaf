import classNames from 'classnames'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import Notification from '@/shared/components/notification'
import OLButton from '@/shared/components/ol/ol-button'
import OLCard from '@/shared/components/ol/ol-card'
import OLCol from '@/shared/components/ol/ol-col'
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
import OLRow from '@/shared/components/ol/ol-row'
import type { CommunityManifest } from '../types'
import { installPackages, registerCommunityManifest } from '../util/api'

export default function CommunityPacksView({
  manifests,
  loading,
  isAdmin,
  canMutate,
  onJobStarted,
  onManifestRegistered,
}: {
  manifests: CommunityManifest[]
  loading: boolean
  isAdmin: boolean
  canMutate: boolean
  onJobStarted: (jobId: string, label: string) => void
  onManifestRegistered: () => void
}) {
  const { t } = useTranslation()
  const [busyPack, setBusyPack] = useState<string | null>(null)
  const [showRegister, setShowRegister] = useState(false)
  const [manifestUrl, setManifestUrl] = useState('')
  const [manifestJson, setManifestJson] = useState('')
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleInstallPack = async (pack: CommunityManifest) => {
    setBusyPack(pack.name)
    setError(null)
    try {
      const res = await installPackages([pack.name], 'community')
      onJobStarted(res.jobId, `Installing starter pack ${pack.name}`)
    } catch (err: any) {
      setError(
        err?.data?.error ||
          err?.message ||
          'Failed to queue community pack install'
      )
    } finally {
      setBusyPack(null)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegistering(true)
    setError(null)
    try {
      const payload: {
        manifestUrl?: string
        manifest?: Record<string, any>
      } = {}
      if (manifestUrl.trim()) {
        payload.manifestUrl = manifestUrl.trim()
      }
      if (manifestJson.trim()) {
        payload.manifest = JSON.parse(manifestJson.trim())
      }
      await registerCommunityManifest(payload)
      setManifestUrl('')
      setManifestJson('')
      setShowRegister(false)
      onManifestRegistered()
    } catch (err: any) {
      setError(
        err?.data?.error || err?.message || 'Failed to register manifest'
      )
    } finally {
      setRegistering(false)
    }
  }

  return (
    <div>
      {error && (
        <Notification
          type="error"
          content={error}
          className="mb-4"
          isDismissible
          onDismiss={() => setError(null)}
        />
      )}

      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <p className="mb-0" style={{ color: 'var(--content-secondary)' }}>
          One-click curated bundles of essential LaTeX packages for papers,
          theses, diagrams, and IEEE templates.
        </p>
        {isAdmin && (
          <OLButton
            variant="secondary"
            size="sm"
            onClick={() => setShowRegister(true)}
            leadingIcon="add_circle_outline"
          >
            {t('package_hub_community_register_btn')}
          </OLButton>
        )}
      </div>

      {!loading && manifests.length === 0 ? (
        <Notification
          type="info"
          content="No community starter packs registered yet."
        />
      ) : (
        <OLRow className="g-4">
          {manifests.map(pack => (
            <OLCol key={pack.name} md={6}>
              <OLCard
                className={classNames('package-hub-card h-100', {
                  'package-hub-card-installed': Boolean(pack.allInstalled),
                })}
              >
                <div className="package-hub-card-inner">
                  <div className="package-hub-card-header">
                    <div className="min-w-0 flex-grow-1">
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <h3
                          className="package-hub-pkg-name"
                          translate="no"
                        >
                          {pack.name}
                        </h3>
                        <span className="package-hub-badge package-hub-badge--version">
                          v{pack.version}
                        </span>
                      </div>
                    </div>

                    {pack.allInstalled ? (
                      <span className="package-hub-badge package-hub-badge--installed">
                        <MaterialIcon type="check_circle" />
                        <span>{t('package_hub_community_installed')}</span>
                      </span>
                    ) : (
                      <span className="package-hub-badge package-hub-badge--available">
                        {pack.installedCount ?? 0}/
                        {pack.totalCount ?? pack.packages.length} installed
                      </span>
                    )}
                  </div>

                  <p className="package-hub-card-desc">{pack.description}</p>

                  <div className="d-flex flex-wrap gap-2 mb-4">
                    {pack.packages.map(pkgName => {
                      const st = pack.packageStatuses?.find(
                        s => s.name === pkgName
                      )
                      return (
                        <span
                          key={pkgName}
                          className={classNames(
                            'package-hub-badge package-hub-badge--mono',
                            st?.installed
                              ? 'package-hub-badge--installed'
                              : 'package-hub-badge--available'
                          )}
                        >
                          {st?.installed && <MaterialIcon type="check" />}
                          <span>{pkgName}</span>
                        </span>
                      )
                    })}
                  </div>

                  <div className="package-hub-card-footer mt-auto">
                    <span
                      className="small"
                      style={{ color: 'var(--neutral-60)' }}
                    >
                      By {pack.author}
                    </span>
                    <OLButton
                      size="sm"
                      variant={pack.allInstalled ? 'secondary' : 'primary'}
                      disabled={!canMutate}
                      isLoading={busyPack === pack.name}
                      onClick={() => handleInstallPack(pack)}
                      leadingIcon={pack.allInstalled ? 'refresh' : 'download'}
                    >
                      {t('package_hub_community_install_pack')}
                    </OLButton>
                  </div>
                </div>
              </OLCard>
            </OLCol>
          ))}
        </OLRow>
      )}

      <OLModal
        show={showRegister}
        onHide={() => setShowRegister(false)}
        id="register-community-pack-modal"
      >
        <form onSubmit={handleRegister}>
          <OLModalHeader>
            <OLModalTitle>
              {t('package_hub_community_register_title')}
            </OLModalTitle>
          </OLModalHeader>
          <OLModalBody>
            <OLFormGroup className="mb-3">
              <OLFormLabel htmlFor="community-manifest-url">
                {t('package_hub_community_url_label')}
              </OLFormLabel>
              <OLFormControl
                id="community-manifest-url"
                type="url"
                value={manifestUrl}
                onChange={e => setManifestUrl(e.target.value)}
                placeholder="https://raw.githubusercontent.com/.../pack.json"
              />
            </OLFormGroup>

            <OLFormGroup>
              <OLFormLabel htmlFor="community-manifest-json">
                Or Paste Manifest JSON directly
              </OLFormLabel>
              <OLFormControl
                as="textarea"
                rows={6}
                id="community-manifest-json"
                value={manifestJson}
                onChange={e => setManifestJson(e.target.value)}
                placeholder={
                  '{\n  "name": "my-lab-pack",\n  "version": "1.0.0",\n  "description": "Lab standard packages",\n  "author": "COSL",\n  "packages": ["enumitem", "booktabs"]\n}'
                }
              />
            </OLFormGroup>
          </OLModalBody>
          <OLModalFooter>
            <OLButton
              variant="secondary"
              type="button"
              onClick={() => setShowRegister(false)}
            >
              {t('cancel')}
            </OLButton>
            <OLButton
              variant="primary"
              type="submit"
              isLoading={registering}
              disabled={!manifestUrl.trim() && !manifestJson.trim()}
            >
              {t('package_hub_community_register_btn')}
            </OLButton>
          </OLModalFooter>
        </form>
      </OLModal>
    </div>
  )
}
