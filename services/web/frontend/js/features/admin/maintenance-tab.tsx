import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { getUserFacingMessage } from '@/infrastructure/fetch-json'
import Notification from '@/shared/components/notification'
import OLButton from '@/shared/components/ol/ol-button'
import OLForm from '@/shared/components/ol/ol-form'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import OLFormSelect from '@/shared/components/ol/ol-form-select'
import overleafGreenLogo from '@/shared/svgs/overleaf-green.svg'
import overleafWhiteLogo from '@/shared/svgs/overleaf-white.svg'
import {
  AdminBranding,
  AdminSystemMessage,
  clearSystemMessages,
  createSystemMessage,
  deleteSystemMessage,
  disconnectAllUsers,
  getAdminBranding,
  resetAdminBranding,
  setEditorStatus,
  updateAdminBranding,
} from './api'

const MAX_LOGO_BYTES = 512 * 1024
const ACCEPTED_LOGO_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
])

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Failed to read selected logo file'))
    reader.readAsDataURL(file)
  })
}

function applyNavbarLogoPreview(logoUrl: string | null) {
  if (typeof document === 'undefined') return
  const logoEl = document.querySelector<HTMLElement>(
    '.navbar-brand .navbar-logo'
  )
  if (!logoEl) return
  logoEl.style.backgroundImage = `url("${logoUrl || overleafGreenLogo}")`
}

type MaintenanceTabProps = {
  editorOpen: boolean
  messages: AdminSystemMessage[]
  onEditorChange: (isOpen: boolean) => void
  onMessagesChange: (messages: AdminSystemMessage[]) => void
}

export default function MaintenanceTab({
  editorOpen,
  messages,
  onEditorChange,
  onMessagesChange,
}: MaintenanceTabProps) {
  const [newMessage, setNewMessage] = useState('')
  const [messageBusy, setMessageBusy] = useState(false)
  const [editorBusy, setEditorBusy] = useState(false)
  const [disconnectDelay, setDisconnectDelay] = useState('10')
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [disconnectBusy, setDisconnectBusy] = useState(false)
  const [branding, setBranding] = useState<AdminBranding | null>(null)
  const [organizationName, setOrganizationName] = useState('')
  const [pendingLogoDataUrl, setPendingLogoDataUrl] = useState<string | null>(
    null
  )
  const [pendingDarkLogoDataUrl, setPendingDarkLogoDataUrl] = useState<
    string | null
  >(null)
  const [clearDarkLogo, setClearDarkLogo] = useState(false)
  const [brandingBusy, setBrandingBusy] = useState(false)
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  useEffect(() => {
    getAdminBranding()
      .then(res => {
        setBranding(res.branding)
        setOrganizationName(res.branding.organizationName || '')
      })
      .catch(() => {})
  }, [])

  const handleSelectLogo = async (
    e: ChangeEvent<HTMLInputElement>,
    variant: 'light' | 'dark'
  ) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!ACCEPTED_LOGO_TYPES.has(file.type)) {
      setFeedback({
        type: 'error',
        text: 'Please upload a PNG, SVG, JPEG, or WebP logo file.',
      })
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setFeedback({
        type: 'error',
        text: 'Logo file must be 512 KB or smaller.',
      })
      return
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setFeedback(null)
      if (variant === 'light') {
        setPendingLogoDataUrl(dataUrl)
      } else {
        setPendingDarkLogoDataUrl(dataUrl)
        setClearDarkLogo(false)
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: String(getUserFacingMessage(err as Error)),
      })
    }
  }

  const handleSaveBranding = async (e: FormEvent) => {
    e.preventDefault()
    setBrandingBusy(true)
    setFeedback(null)
    try {
      const res = await updateAdminBranding({
        organizationName,
        ...(pendingLogoDataUrl ? { logoDataUrl: pendingLogoDataUrl } : {}),
        ...(pendingDarkLogoDataUrl
          ? { logoDarkDataUrl: pendingDarkLogoDataUrl }
          : {}),
        ...(clearDarkLogo ? { clearLogoDark: true } : {}),
      })
      setBranding(res.branding)
      setOrganizationName(res.branding.organizationName || '')
      setPendingLogoDataUrl(null)
      setPendingDarkLogoDataUrl(null)
      setClearDarkLogo(false)
      applyNavbarLogoPreview(res.branding.logoUrl)
      setFeedback({
        type: 'success',
        text: 'Organization logo updated for all workspace users.',
      })
    } catch (err) {
      setFeedback({
        type: 'error',
        text: String(getUserFacingMessage(err as Error)),
      })
    } finally {
      setBrandingBusy(false)
    }
  }

  const handleResetBranding = async () => {
    setBrandingBusy(true)
    setFeedback(null)
    try {
      const res = await resetAdminBranding()
      setBranding(res.branding)
      setOrganizationName('')
      setPendingLogoDataUrl(null)
      setPendingDarkLogoDataUrl(null)
      setClearDarkLogo(false)
      applyNavbarLogoPreview(null)
      setFeedback({
        type: 'success',
        text: 'Restored default Overleaf logo across the workspace.',
      })
    } catch (err) {
      setFeedback({
        type: 'error',
        text: String(getUserFacingMessage(err as Error)),
      })
    } finally {
      setBrandingBusy(false)
    }
  }

  const lightPreviewSrc =
    pendingLogoDataUrl || branding?.logoUrl || overleafGreenLogo
  const darkPreviewSrc = clearDarkLogo
    ? pendingLogoDataUrl || branding?.logoUrl || overleafWhiteLogo
    : pendingDarkLogoDataUrl ||
      pendingLogoDataUrl ||
      branding?.logoDarkUrl ||
      branding?.logoUrl ||
      overleafWhiteLogo
  const hasBrandingChanges = Boolean(
    pendingLogoDataUrl ||
      pendingDarkLogoDataUrl ||
      clearDarkLogo ||
      organizationName.trim() !== (branding?.organizationName || '').trim()
  )
  const hasAnyCustomBranding = Boolean(
    branding?.hasCustomLogo ||
      branding?.hasCustomLogoDark ||
      branding?.organizationName ||
      pendingLogoDataUrl ||
      pendingDarkLogoDataUrl
  )

  const handleToggleEditor = async () => {
    setEditorBusy(true)
    setFeedback(null)
    try {
      const res = await setEditorStatus(!editorOpen)
      onEditorChange(res.isOpen)
      setFeedback({
        type: 'success',
        text: res.isOpen
          ? 'Editor reopened for all users.'
          : 'Editor placed into maintenance mode.',
      })
    } catch (err) {
      setFeedback({ type: 'error', text: String(getUserFacingMessage(err as Error)) })
    } finally {
      setEditorBusy(false)
    }
  }

  const handleDisconnectUsers = async () => {
    setDisconnectBusy(true)
    setFeedback(null)
    try {
      const res = await disconnectAllUsers(Number(disconnectDelay) || 10)
      setConfirmDisconnect(false)
      setFeedback({
        type: 'success',
        text: `Disconnect notice broadcast to active editor sessions (grace period: ${res.delay}s).`,
      })
    } catch (err) {
      setFeedback({ type: 'error', text: String(getUserFacingMessage(err as Error)) })
    } finally {
      setDisconnectBusy(false)
    }
  }

  const handlePostMessage = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = newMessage.trim()
    if (!trimmed) return
    setMessageBusy(true)
    setFeedback(null)
    try {
      const res = await createSystemMessage(trimmed)
      onMessagesChange(res.systemMessages)
      setNewMessage('')
      setFeedback({ type: 'success', text: 'Announcement published.' })
    } catch (err) {
      setFeedback({ type: 'error', text: String(getUserFacingMessage(err as Error)) })
    } finally {
      setMessageBusy(false)
    }
  }

  const handleDeleteOne = async (id: string) => {
    setMessageBusy(true)
    setFeedback(null)
    try {
      const res = await deleteSystemMessage(id)
      onMessagesChange(res.systemMessages)
    } catch (err) {
      setFeedback({ type: 'error', text: String(getUserFacingMessage(err as Error)) })
    } finally {
      setMessageBusy(false)
    }
  }

  const handleClearAll = async () => {
    setMessageBusy(true)
    setFeedback(null)
    try {
      const res = await clearSystemMessages()
      onMessagesChange(res.systemMessages)
      setFeedback({ type: 'success', text: 'All announcements cleared.' })
    } catch (err) {
      setFeedback({ type: 'error', text: String(getUserFacingMessage(err as Error)) })
    } finally {
      setMessageBusy(false)
    }
  }

  return (
    <>
      {feedback && (
        <div className="notification-list mb-3">
          <Notification type={feedback.type} content={feedback.text} />
        </div>
      )}

      <section
        className="ol-admin-panel mb-4"
        aria-labelledby="admin-branding-heading"
      >
        <div className="ol-admin-panel-header">
          <h2 id="admin-branding-heading" className="ol-admin-panel-title">
            Organization Logo
          </h2>
          {branding?.hasCustomLogo ? (
            <span className="ol-admin-status">
              <span
                className="ol-admin-status-dot is-healthy"
                aria-hidden="true"
              />
              <span>Custom logo active</span>
            </span>
          ) : (
            <span className="ol-admin-muted">Default Overleaf logo</span>
          )}
        </div>

        <div className="ol-admin-panel-body">
          <p className="ol-admin-muted mb-3">
            Replace the default Overleaf logo across the workspace for all users
            on your network.
          </p>

          <div className="ol-admin-branding-previews">
            <div className="ol-admin-branding-preview-card">
              <span className="ol-admin-branding-preview-label">
                Light header preview
              </span>
              <img
                src={lightPreviewSrc}
                alt={organizationName.trim() || 'Workspace logo light preview'}
                className="ol-admin-branding-preview-img"
              />
            </div>
            <div className="ol-admin-branding-preview-card is-dark">
              <span className="ol-admin-branding-preview-label">
                Dark header preview
              </span>
              <img
                src={darkPreviewSrc}
                alt={organizationName.trim() || 'Workspace logo dark preview'}
                className="ol-admin-branding-preview-img"
              />
            </div>
          </div>

          <OLForm onSubmit={handleSaveBranding}>
            <div className="ol-admin-branding-grid">
              <OLFormGroup controlId="admin-branding-light-file">
                <OLFormLabel>Main logo (PNG, SVG, JPEG, WebP)</OLFormLabel>
                <OLFormControl
                  type="file"
                  accept="image/png,image/svg+xml,image/jpeg,image/webp"
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    handleSelectLogo(e, 'light')
                  }
                  disabled={brandingBusy}
                />
              </OLFormGroup>

              <OLFormGroup controlId="admin-branding-dark-file">
                <OLFormLabel>Dark theme logo (optional)</OLFormLabel>
                <OLFormControl
                  type="file"
                  accept="image/png,image/svg+xml,image/jpeg,image/webp"
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    handleSelectLogo(e, 'dark')
                  }
                  disabled={brandingBusy}
                />
                {(branding?.hasCustomLogoDark || pendingDarkLogoDataUrl) &&
                  !clearDarkLogo && (
                    <div className="mt-2">
                      <OLButton
                        variant="ghost"
                        size="sm"
                        type="button"
                        disabled={brandingBusy}
                        onClick={() => {
                          setPendingDarkLogoDataUrl(null)
                          setClearDarkLogo(true)
                        }}
                      >
                        Use main logo on dark headers
                      </OLButton>
                    </div>
                  )}
              </OLFormGroup>

              <OLFormGroup controlId="admin-branding-org-name">
                <OLFormLabel>Organization name (optional)</OLFormLabel>
                <OLFormControl
                  type="text"
                  maxLength={120}
                  value={organizationName}
                  onChange={e => setOrganizationName(e.target.value)}
                  placeholder="Used as logo label"
                  disabled={brandingBusy}
                />
              </OLFormGroup>
            </div>

            <div className="d-flex align-items-center gap-2 flex-wrap">
              <OLButton
                variant="primary"
                type="submit"
                disabled={brandingBusy || !hasBrandingChanges}
                isLoading={brandingBusy}
                loadingLabel="Saving..."
              >
                Save logo
              </OLButton>
              <OLButton
                variant="secondary"
                type="button"
                disabled={brandingBusy || !hasAnyCustomBranding}
                onClick={handleResetBranding}
              >
                Reset to Overleaf logo
              </OLButton>
            </div>
          </OLForm>
        </div>
      </section>

      <div className="ol-admin-section-grid ol-admin-section-grid--equal">
        <section
          className="ol-admin-panel"
          aria-labelledby="admin-maintenance-heading"
        >
          <div className="ol-admin-panel-header">
            <h2
              id="admin-maintenance-heading"
              className="ol-admin-panel-title"
            >
              Editor maintenance
            </h2>
            {editorOpen ? (
              <span className="ol-admin-status">
                <span
                  className="ol-admin-status-dot is-healthy"
                  aria-hidden="true"
                />
                <span>Editor open</span>
              </span>
            ) : (
              <span className="ol-admin-tag ol-admin-tag--warning">
                Maintenance mode
              </span>
            )}
          </div>

          <div className="ol-admin-panel-body">
            <h3 className="ol-admin-subsection-title">Editor access</h3>
            <p className="ol-admin-muted mb-3">
              Closing the editor prevents new project sessions from opening
              while keeping the rest of the portal available.
            </p>
            <OLButton
              variant={editorOpen ? 'danger' : 'primary'}
              type="button"
              isLoading={editorBusy}
              loadingLabel="Updating…"
              onClick={handleToggleEditor}
            >
              {editorOpen ? 'Close editor for maintenance' : 'Reopen editor'}
            </OLButton>

            <hr className="ol-admin-divider" />

            <h3 className="ol-admin-subsection-title">
              Disconnect active sessions
            </h3>
            <p className="ol-admin-muted mb-3">
              Broadcasts a maintenance disconnect notice to open real-time
              editor clients after the selected grace delay.
            </p>

            <div className="ol-admin-inline-row">
              <OLFormGroup controlId="admin-disconnect-delay">
                <OLFormLabel>Grace delay</OLFormLabel>
                <OLFormSelect
                  value={disconnectDelay}
                  onChange={e => setDisconnectDelay(e.target.value)}
                  disabled={disconnectBusy}
                >
                  <option value="5">5 seconds</option>
                  <option value="10">10 seconds</option>
                  <option value="30">30 seconds</option>
                  <option value="60">60 seconds</option>
                </OLFormSelect>
              </OLFormGroup>

              {!confirmDisconnect && (
                <OLButton
                  variant="secondary"
                  type="button"
                  disabled={disconnectBusy}
                  onClick={() => setConfirmDisconnect(true)}
                >
                  Disconnect active users…
                </OLButton>
              )}
            </div>

            {confirmDisconnect && (
              <div className="ol-admin-confirm-box" role="alert">
                <p>
                  Broadcast a maintenance disconnect notice to all open editors
                  ({disconnectDelay}s grace period)?
                </p>
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <OLButton
                    variant="danger"
                    size="sm"
                    type="button"
                    isLoading={disconnectBusy}
                    loadingLabel="Broadcasting…"
                    onClick={handleDisconnectUsers}
                  >
                    Confirm disconnect
                  </OLButton>
                  <OLButton
                    variant="secondary"
                    size="sm"
                    type="button"
                    disabled={disconnectBusy}
                    onClick={() => setConfirmDisconnect(false)}
                  >
                    Cancel
                  </OLButton>
                </div>
              </div>
            )}
          </div>
        </section>

        <section
          className="ol-admin-panel"
          aria-labelledby="admin-announcements-heading"
        >
          <div className="ol-admin-panel-header">
            <h2
              id="admin-announcements-heading"
              className="ol-admin-panel-title"
            >
              System announcements
              {messages.length > 0 ? ` (${messages.length})` : ''}
            </h2>
            {messages.length > 0 && (
              <OLButton
                variant="danger-ghost"
                size="sm"
                type="button"
                disabled={messageBusy}
                onClick={handleClearAll}
              >
                Clear all
              </OLButton>
            )}
          </div>

          <div className="ol-admin-panel-body">
            {messages.length === 0 ? (
              <div className="ol-admin-empty-box">
                No active workspace announcements.
              </div>
            ) : (
              <div className="ol-admin-announcement-list">
                {messages.map(msg => (
                  <div key={msg.id} className="ol-admin-announcement-item">
                    <span className="ol-admin-announcement-text">
                      {msg.content}
                    </span>
                    <OLButton
                      variant="ghost"
                      size="sm"
                      type="button"
                      disabled={messageBusy}
                      onClick={() => handleDeleteOne(msg.id)}
                    >
                      Remove
                    </OLButton>
                  </div>
                ))}
              </div>
            )}

            <hr className="ol-admin-divider" />

            <OLForm onSubmit={handlePostMessage}>
              <OLFormGroup controlId="admin-new-announcement" className="mb-3">
                <OLFormLabel>New workspace banner</OLFormLabel>
                <OLFormControl
                  as="textarea"
                  rows={3}
                  required
                  maxLength={500}
                  className="ol-admin-textarea"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="e.g. Scheduled maintenance tonight at 22:00 UTC"
                  disabled={messageBusy}
                />
              </OLFormGroup>
              <div className="ol-admin-composer-footer">
                <span className="ol-admin-char-count">
                  {newMessage.length} / 500 characters
                </span>
                <OLButton
                  variant="primary"
                  type="submit"
                  disabled={!newMessage.trim()}
                  isLoading={messageBusy}
                  loadingLabel="Publishing…"
                >
                  Publish announcement
                </OLButton>
              </div>
            </OLForm>
          </div>
        </section>
      </div>
    </>
  )
}
