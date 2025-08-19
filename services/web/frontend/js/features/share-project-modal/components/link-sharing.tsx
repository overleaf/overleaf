import { useCallback, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useShareProjectContext } from './share-project-modal'
import { setPublicAccessLevel } from '../utils/api'
import { CopyToClipboard } from '@/shared/components/copy-to-clipboard'
import { useProjectContext } from '@/shared/context/project-context'
import * as eventTracking from '../../../infrastructure/event-tracking'
import { useUserContext } from '@/shared/context/user-context'
import { sendMB } from '../../../infrastructure/event-tracking'
import { getJSON } from '../../../infrastructure/fetch-json'
import useAbortController from '@/shared/hooks/use-abort-controller'
import { debugConsole } from '@/utils/debugging'
import getMeta from '@/utils/meta'
import OLRow from '@/shared/components/ol/ol-row'
import OLCol from '@/shared/components/ol/ol-col'
import OLButton from '@/shared/components/ol/ol-button'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import MaterialIcon from '@/shared/components/material-icon'

type Tokens = {
  readAndWrite: string
  readAndWriteHashPrefix: string
  readAndWritePrefix: string
  readOnly: string
  readOnlyHashPrefix: string
}

type AccessLevel = 'private' | 'tokenBased' | 'readAndWrite' | 'readOnly'

export default function LinkSharing() {
  const [inflight, setInflight] = useState(false)
  const [showLinks, setShowLinks] = useState(true)
  const linkSharingEnabled =
    getMeta('ol-capabilities')?.includes('link-sharing')

  const { monitorRequest } = useShareProjectContext()

  const { projectId, project } = useProjectContext()
  const { publicAccessLevel } = project || {}

  // set the access level of a project
  const setAccessLevel = useCallback(
    (newPublicAccessLevel: string) => {
      setInflight(true)
      sendMB('link-sharing-click-off', {
        project_id: projectId,
      })
      monitorRequest(() =>
        setPublicAccessLevel(projectId, newPublicAccessLevel)
      )
        .then(() => {
          // NOTE: not calling `updateProject` here as it receives data via
          // project:publicAccessLevel:changed over the websocket connection
          // TODO: eventTracking.sendMB('project-make-token-based') when newPublicAccessLevel is 'tokenBased'
        })
        .finally(() => {
          setInflight(false)
        })
    },
    [monitorRequest, projectId]
  )

  if (!linkSharingEnabled) {
    return null
  }

  switch (publicAccessLevel) {
    // Private (with token-access available)
    case 'private':
      return (
        <PrivateSharing
          setAccessLevel={setAccessLevel}
          inflight={inflight}
          projectId={projectId}
          setShowLinks={setShowLinks}
        />
      )

    // Token-based access
    case 'tokenBased':
      return (
        <TokenBasedSharing
          setAccessLevel={setAccessLevel}
          inflight={inflight}
          setShowLinks={setShowLinks}
          showLinks={showLinks}
        />
      )

    // Legacy public-access
    case 'readAndWrite':
    case 'readOnly':
      return (
        // TODO: do we even need this anymore?
        <LegacySharing
          setAccessLevel={setAccessLevel}
          accessLevel={publicAccessLevel}
          inflight={inflight}
        />
      )

    default:
      return null
  }
}

function PrivateSharing({
  setAccessLevel,
  inflight,
  projectId,
  setShowLinks,
}: {
  setAccessLevel: (level: AccessLevel) => void
  inflight: boolean
  projectId: string
  setShowLinks: (show: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <OLRow className="public-access-level">
      <OLCol xs={12} className="text-center">
        <strong>{t('link_sharing_is_off_short')}</strong>
        <span>&nbsp;&nbsp;</span>
        <OLButton
          variant="link"
          className="btn-inline-link"
          onClick={() => {
            setAccessLevel('tokenBased')
            eventTracking.sendMB('link-sharing-click', { projectId })
            setShowLinks(true)
          }}
          disabled={inflight}
        >
          {t('turn_on_link_sharing')}
        </OLButton>
        <span>&nbsp;&nbsp;</span>
        <LinkSharingInfo />
      </OLCol>
    </OLRow>
  )
}

function TokenBasedSharing({
  setAccessLevel,
  inflight,
  setShowLinks,
  showLinks,
}: {
  setAccessLevel: (level: AccessLevel) => void
  inflight: boolean
  setShowLinks: (show: boolean) => void
  showLinks: boolean
}) {
  const { t } = useTranslation()
  const { projectId } = useProjectContext()

  const [tokens, setTokens] = useState<Tokens | null>(null)

  const { signal } = useAbortController()

  useEffect(() => {
    getJSON(`/project/${projectId}/tokens`, { signal })
      .then(data => setTokens(data))
      .catch(debugConsole.error)
  }, [projectId, signal])

  return (
    <OLRow className="public-access-level">
      <OLCol xs={12} className="text-center">
        <strong>{t('link_sharing_is_on')}</strong>
        <span>&nbsp;&nbsp;</span>
        <OLButton
          variant="link"
          className="btn-inline-link"
          onClick={() => setAccessLevel('private')}
          disabled={inflight}
        >
          {t('turn_off_link_sharing')}
        </OLButton>
        <span>&nbsp;&nbsp;</span>
        <LinkSharingInfo />
        <OLButton
          variant="link"
          className="btn-chevron align-middle"
          onClick={() => setShowLinks(!showLinks)}
        >
          <MaterialIcon
            type={showLinks ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
          />
        </OLButton>
      </OLCol>
      {showLinks && (
        <OLCol xs={12} className="access-token-display-area">
          <div className="access-token-wrapper">
            <strong>{t('anyone_with_link_can_edit')}</strong>
            <AccessToken
              token={tokens?.readAndWrite}
              tokenHashPrefix={tokens?.readAndWriteHashPrefix}
              path="/"
              tooltipId="tooltip-copy-link-rw"
            />
          </div>
          <div className="access-token-wrapper">
            <strong>{t('anyone_with_link_can_view')}</strong>
            <AccessToken
              token={tokens?.readOnly}
              tokenHashPrefix={tokens?.readOnlyHashPrefix}
              path="/read/"
              tooltipId="tooltip-copy-link-ro"
            />
          </div>
        </OLCol>
      )}
    </OLRow>
  )
}

function LegacySharing({
  accessLevel,
  setAccessLevel,
  inflight,
}: {
  accessLevel: AccessLevel
  setAccessLevel: (level: AccessLevel) => void
  inflight: boolean
}) {
  const { t } = useTranslation()

  return (
    <OLRow className="public-access-level">
      <OLCol xs={12} className="text-center">
        <strong>
          {accessLevel === 'readAndWrite' && t('this_project_is_public')}
          {accessLevel === 'readOnly' && t('this_project_is_public_read_only')}
        </strong>
        <span>&nbsp;&nbsp;</span>
        <OLButton
          variant="link"
          className="btn-inline-link"
          onClick={() => setAccessLevel('private')}
          disabled={inflight}
        >
          {t('make_private')}
        </OLButton>
        <span>&nbsp;&nbsp;</span>
        <LinkSharingInfo />
      </OLCol>
    </OLRow>
  )
}

export function ReadOnlyTokenLink() {
  const { t } = useTranslation()
  const { projectId } = useProjectContext()

  const [tokens, setTokens] = useState<Tokens | null>(null)

  const { signal } = useAbortController()

  useEffect(() => {
    getJSON(`/project/${projectId}/tokens`, { signal })
      .then(data => setTokens(data))
      .catch(debugConsole.error)
  }, [projectId, signal])

  return (
    <OLRow className="public-access-level">
      <OLCol className="access-token-display-area">
        <div className="access-token-wrapper">
          <strong>{t('anyone_with_link_can_view')}</strong>
          <AccessToken
            token={tokens?.readOnly}
            tokenHashPrefix={tokens?.readOnlyHashPrefix}
            path="/read/"
            tooltipId="tooltip-copy-link-ro"
          />
        </div>
      </OLCol>
    </OLRow>
  )
}

function AccessToken({
  token,
  tokenHashPrefix,
  path,
  tooltipId,
}: {
  token?: string
  tokenHashPrefix?: string
  path: string
  tooltipId: string
}) {
  const { t } = useTranslation()
  const { isAdmin } = useUserContext()

  if (!token) {
    return (
      <pre className="access-token">
        <span>{t('loading')}…</span>
      </pre>
    )
  }

  let origin = window.location.origin
  if (isAdmin) {
    origin = getMeta('ol-ExposedSettings').siteUrl
  }
  const link = `${origin}${path}${token}${
    tokenHashPrefix ? `#${tokenHashPrefix}` : ''
  }`

  return (
    <div className="access-token">
      <code>{link}</code>
      <CopyToClipboard content={link} tooltipId={tooltipId} />
    </div>
  )
}

function LinkSharingInfo() {
  const { t } = useTranslation()

  return (
    <OLTooltip
      id="link-sharing-info"
      description={t('learn_more_about_link_sharing')}
    >
      <a
        href="/learn/how-to/What_is_Link_Sharing%3F"
        target="_blank"
        rel="noopener"
      >
        <MaterialIcon type="help" className="align-middle" />
      </a>
    </OLTooltip>
  )
}
