import { useCallback, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  postJSON,
  deleteJSON,
  getJSON,
} from '../../../../../frontend/js/infrastructure/fetch-json'
import OLButton from '@/shared/components/ol/ol-button'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLNotification from '@/shared/components/ol/ol-notification'
import GithubLogo from '@/shared/svgs/github-logo'

type GitHubStatus = {
  connected: boolean
  username?: string
}

export default function GitHubSyncWidget() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<GitHubStatus>({ connected: false })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [showDisconnectModal, setShowDisconnectModal] = useState(false)
  const [pat, setPat] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const data = await getJSON<GitHubStatus>('/user/github-sync/status')
      setStatus(data)
      setError('')
    } catch (err: any) {
      setError(err.message || 'Failed to fetch GitHub status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const handleConnect = useCallback(async () => {
    if (!pat.trim()) {
      setError('Please enter a Personal Access Token')
      return
    }

    setConnecting(true)
    setError('')

    try {
      const data = await postJSON<{ success: boolean; username: string }>(
        '/user/github-sync/connect',
        { body: { pat: pat.trim() } }
      )
      setStatus({ connected: true, username: data.username })
      setShowConnectModal(false)
      setPat('')
    } catch (err: any) {
      setError(err.message || 'Failed to connect GitHub account')
    } finally {
      setConnecting(false)
    }
  }, [pat])

  const handleDisconnect = useCallback(async () => {
    setDisconnecting(true)
    setError('')

    try {
      await deleteJSON('/user/github-sync/disconnect')
      setStatus({ connected: false })
      setShowDisconnectModal(false)
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect GitHub account')
    } finally {
      setDisconnecting(false)
    }
  }, [])

  if (loading) {
    return (
      <div className="settings-widget-container">
        <div>
          <GithubLogo />
        </div>
        <div className="description-container">
          <div className="title-row">
            <h4>GitHub</h4>
          </div>
          <p className="small">{t('loading')}...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="settings-widget-container">
        <div>
          <GithubLogo size={32} />
        </div>
        <div className="description-container">
          <div className="title-row">
            <h4 id="github-sync">GitHub</h4>
          </div>
          <p className="small">
            {t('github_sync_description', {
              defaultValue:
                'Sync your Overleaf projects with GitHub repositories.',
            })}
          </p>
          {status.connected && status.username && (
            <p className="small">
              <strong>{t('connected_as')}:</strong> {status.username}
            </p>
          )}
          {error && <OLNotification type="error" content={error} />}
        </div>
        <div>
          {status.connected ? (
            <OLButton
              variant="danger-ghost"
              onClick={() => setShowDisconnectModal(true)}
              disabled={disconnecting}
            >
              {disconnecting ? t('unlinking') : t('unlink')}
            </OLButton>
          ) : (
            <OLButton
              variant="secondary"
              onClick={() => setShowConnectModal(true)}
            >
              {t('link')}
            </OLButton>
          )}
        </div>
      </div>

      {/* Connect Modal */}
      <OLModal
        show={showConnectModal}
        onHide={() => setShowConnectModal(false)}
      >
        <OLModalHeader>
          <OLModalTitle>{t('connect_github')}</OLModalTitle>
        </OLModalHeader>
        <OLModalBody>
          <p>
            {t('github_pat_instructions', {
              defaultValue:
                'Enter a GitHub Personal Access Token (classic) with repo scope to connect your account.',
            })}
          </p>
          <p className="small">
            <a
              href="https://github.com/settings/tokens/new?scopes=repo&description=Overleaf%20Sync"
              target="_blank"
              rel="noreferrer"
            >
              {t('create_token_on_github', {
                defaultValue: 'Create a token on GitHub',
              })}
            </a>
          </p>
          <OLFormGroup>
            <OLFormLabel htmlFor="github-pat">
              {t('personal_access_token')}
            </OLFormLabel>
            <OLFormControl
              id="github-pat"
              type="password"
              value={pat}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setPat(e.target.value)
              }
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              autoComplete="off"
            />
          </OLFormGroup>
          {error && <OLNotification type="error" content={error} />}
        </OLModalBody>
        <OLModalFooter>
          <OLButton
            variant="secondary"
            onClick={() => setShowConnectModal(false)}
          >
            {t('cancel')}
          </OLButton>
          <OLButton
            variant="primary"
            onClick={handleConnect}
            disabled={connecting || !pat.trim()}
          >
            {connecting ? t('connecting') : t('connect')}
          </OLButton>
        </OLModalFooter>
      </OLModal>

      {/* Disconnect Confirmation Modal */}
      <OLModal
        show={showDisconnectModal}
        onHide={() => setShowDisconnectModal(false)}
      >
        <OLModalHeader>
          <OLModalTitle>
            {t('unlink_provider_account_title', { provider: 'GitHub' })}
          </OLModalTitle>
        </OLModalHeader>
        <OLModalBody>
          <p>{t('unlink_provider_account_warning', { provider: 'GitHub' })}</p>
        </OLModalBody>
        <OLModalFooter>
          <OLButton
            variant="secondary"
            onClick={() => setShowDisconnectModal(false)}
          >
            {t('cancel')}
          </OLButton>
          <OLButton
            variant="danger-ghost"
            onClick={handleDisconnect}
            disabled={disconnecting}
          >
            {disconnecting ? t('unlinking') : t('unlink')}
          </OLButton>
        </OLModalFooter>
      </OLModal>
    </>
  )
}
