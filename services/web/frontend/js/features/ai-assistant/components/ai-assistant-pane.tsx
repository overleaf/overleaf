import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import RailPanelHeader from '@/features/ide-react/components/rail/rail-panel-header'
import { useProjectContext } from '@/shared/context/project-context'
import { deleteJSON, postJSON, getJSON } from '@/infrastructure/fetch-json'
import { FullSizeLoadingSpinner } from '@/shared/components/loading-spinner'
import MaterialIcon from '@/shared/components/material-icon'
import OLIconButton from '@/shared/components/ol/ol-icon-button'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import withErrorBoundary from '@/infrastructure/error-boundary'

type SessionStatus =
  | { active: false }
  | {
      active: true
      healthy: boolean
      sessionId: string
      iframeUrl: string
      createdAt: number
      heartbeatAgeMs: number
    }

type StartSessionResponse = {
  sessionId: string
  iframeUrl: string
  createdAt: number
}

const STATUS_POLL_MS = 5000

export const AiAssistantPane = () => {
  const { t } = useTranslation()
  const { projectId } = useProjectContext()

  const [status, setStatus] = useState<SessionStatus | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshStatus = useCallback(async () => {
    try {
      const s = await getJSON<SessionStatus>(
        `/project/${projectId}/ai/session/status`
      )
      setStatus(s)
    } catch (err) {
      // Status endpoint failure is non-fatal; the panel will retry.
    }
  }, [projectId])

  useEffect(() => {
    refreshStatus()
    const t = setInterval(refreshStatus, STATUS_POLL_MS)
    return () => clearInterval(t)
  }, [refreshStatus])

  const startSession = useCallback(async () => {
    setStarting(true)
    setError(null)
    try {
      const res = await postJSON<StartSessionResponse>(
        `/project/${projectId}/ai/session`
      )
      setStatus({
        active: true,
        healthy: true,
        sessionId: res.sessionId,
        iframeUrl: res.iframeUrl,
        createdAt: res.createdAt,
        heartbeatAgeMs: 0,
      })
    } catch (err: any) {
      setError(err?.message || String(err))
    } finally {
      setStarting(false)
    }
  }, [projectId])

  const stopSession = useCallback(async () => {
    try {
      await deleteJSON(`/project/${projectId}/ai/session`)
      setStatus({ active: false })
    } catch (err: any) {
      setError(err?.message || String(err))
    }
  }, [projectId])

  return (
    <div className="ai-assistant-panel">
      <RailPanelHeader
        title={t('ai_assistant')}
        actions={
          status?.active ? (
            <OLTooltip
              id="ai-assistant-stop"
              description={t('ai_assistant_stop_session')}
              overlayProps={{ placement: 'bottom' }}
            >
              <OLIconButton
                onClick={stopSession}
                className="rail-panel-header-button-subdued"
                icon="stop_circle"
                accessibilityLabel={t('ai_assistant_stop_session')}
                size="sm"
              />
            </OLTooltip>
          ) : undefined
        }
      />

      {!status && <FullSizeLoadingSpinner delay={300} />}

      {status && !status.active && (
        <StartCard
          starting={starting}
          error={error}
          onStart={startSession}
        />
      )}

      {status?.active && (
        <>
          {!status.healthy && (
            <div className="ai-assistant-banner ai-assistant-banner--warning">
              <MaterialIcon type="warning" />
              <span>{t('ai_assistant_unhealthy')}</span>
            </div>
          )}
          <iframe
            title="Claude Code"
            src={status.iframeUrl}
            className="ai-assistant-iframe"
            // code-server needs clipboard, downloads, and storage access; allow
            // the subset it actually uses.
            allow="clipboard-read; clipboard-write; downloads"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-clipboard-read allow-clipboard-write"
          />
        </>
      )}
    </div>
  )
}

function StartCard({
  starting,
  error,
  onStart,
}: {
  starting: boolean
  error: string | null
  onStart: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="ai-assistant-start">
      <MaterialIcon type="smart_toy" className="ai-assistant-start-icon" />
      <h3>{t('ai_assistant_title')}</h3>
      <p>{t('ai_assistant_intro')}</p>
      <button
        type="button"
        className="btn btn-primary"
        onClick={onStart}
        disabled={starting}
      >
        {starting ? t('ai_assistant_starting') : t('ai_assistant_start')}
      </button>
      {error && <div className="ai-assistant-error">{error}</div>}
    </div>
  )
}

export default withErrorBoundary(AiAssistantPane, () => (
  <div className="ai-assistant-error">Failed to load AI assistant</div>
))
