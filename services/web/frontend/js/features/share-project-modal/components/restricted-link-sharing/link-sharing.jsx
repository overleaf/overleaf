import { useCallback, useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { Button, Col, Row } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import Tooltip from '@/shared/components/tooltip'
import Icon from '@/shared/components/icon'
import { useShareProjectContext } from './share-project-modal'
import { setProjectAccessLevel } from '../../utils/api'
import { CopyToClipboard } from '@/shared/components/copy-to-clipboard'
import { useProjectContext } from '@/shared/context/project-context'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import { useUserContext } from '@/shared/context/user-context'
import { sendMB } from '../../../../infrastructure/event-tracking'
import { getJSON } from '../../../../infrastructure/fetch-json'
import useAbortController from '@/shared/hooks/use-abort-controller'
import { debugConsole } from '@/utils/debugging'
import getMeta from '@/utils/meta'

export default function LinkSharing() {
  const [inflight, setInflight] = useState(false)
  const [showLinks, setShowLinks] = useState(true)

  const { monitorRequest } = useShareProjectContext()

  const { _id: projectId, publicAccessLevel } = useProjectContext()

  // set the access level of a project
  const setAccessLevel = useCallback(
    newPublicAccessLevel => {
      setInflight(true)
      sendMB('link-sharing-click-off', {
        project_id: projectId,
      })
      monitorRequest(() =>
        setProjectAccessLevel(projectId, newPublicAccessLevel)
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

function PrivateSharing({ setAccessLevel, inflight, projectId, setShowLinks }) {
  const { t } = useTranslation()
  return (
    <Row className="public-access-level">
      <Col xs={12} className="text-center">
        <strong>{t('link_sharing_is_off_short')}</strong>
        <span>&nbsp;&nbsp;</span>
        <Button
          type="button"
          bsStyle="link"
          className="btn-inline-link"
          onClick={() => {
            setAccessLevel('tokenBased')
            eventTracking.sendMB('link-sharing-click', { projectId })
            setShowLinks(true)
          }}
          disabled={inflight}
        >
          {t('turn_on_link_sharing')}
        </Button>
        <span>&nbsp;&nbsp;</span>
        <LinkSharingInfo />
      </Col>
    </Row>
  )
}

PrivateSharing.propTypes = {
  setAccessLevel: PropTypes.func.isRequired,
  inflight: PropTypes.bool,
  projectId: PropTypes.string,
  setShowLinks: PropTypes.func.isRequired,
}

function TokenBasedSharing({
  setAccessLevel,
  inflight,
  setShowLinks,
  showLinks,
}) {
  const { t } = useTranslation()
  const { _id: projectId } = useProjectContext()

  const [tokens, setTokens] = useState(null)

  const { signal } = useAbortController()

  useEffect(() => {
    getJSON(`/project/${projectId}/tokens`, { signal })
      .then(data => setTokens(data))
      .catch(debugConsole.error)
  }, [projectId, signal])

  return (
    <Row className="public-access-level">
      <Col xs={12} className="text-center">
        <strong>{t('link_sharing_is_on')}</strong>
        <span>&nbsp;&nbsp;</span>
        <Button
          bsStyle="link"
          className="btn-inline-link"
          onClick={() => setAccessLevel('private')}
          disabled={inflight}
        >
          {t('turn_off_link_sharing')}
        </Button>
        <span>&nbsp;&nbsp;</span>
        <LinkSharingInfo />
        <Button
          bsStyle="link"
          className="btn-chevron"
          onClick={() => setShowLinks(!showLinks)}
        >
          <Icon type={showLinks ? 'chevron-up' : 'chevron-down'} fw />
        </Button>
      </Col>
      {showLinks && (
        <>
          <Col xs={12} className="access-token-display-area">
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
          </Col>
        </>
      )}
    </Row>
  )
}

TokenBasedSharing.propTypes = {
  setAccessLevel: PropTypes.func.isRequired,
  inflight: PropTypes.bool,
  setShowLinks: PropTypes.func.isRequired,
  showLinks: PropTypes.bool,
}

function LegacySharing({ accessLevel, setAccessLevel, inflight }) {
  const { t } = useTranslation()

  return (
    <Row className="public-access-level">
      <Col xs={12} className="text-center">
        <strong>
          {accessLevel === 'readAndWrite' && t('this_project_is_public')}
          {accessLevel === 'readOnly' && t('this_project_is_public_read_only')}
        </strong>
        <span>&nbsp;&nbsp;</span>
        <Button
          type="button"
          bsStyle="link"
          className="btn-inline-link"
          onClick={() => setAccessLevel('private')}
          disabled={inflight}
        >
          {t('make_private')}
        </Button>
        <span>&nbsp;&nbsp;</span>
        <LinkSharingInfo />
      </Col>
    </Row>
  )
}

LegacySharing.propTypes = {
  accessLevel: PropTypes.string.isRequired,
  setAccessLevel: PropTypes.func.isRequired,
  inflight: PropTypes.bool,
}

export function ReadOnlyTokenLink() {
  const { t } = useTranslation()
  const { _id: projectId } = useProjectContext()

  const [tokens, setTokens] = useState(null)

  const { signal } = useAbortController()

  useEffect(() => {
    getJSON(`/project/${projectId}/tokens`, { signal })
      .then(data => setTokens(data))
      .catch(debugConsole.error)
  }, [projectId, signal])

  return (
    <Row className="public-access-level">
      <Col xs={12} className="access-token-display-area">
        <div className="access-token-wrapper">
          <strong>{t('anyone_with_link_can_view')}</strong>
          <AccessToken
            token={tokens?.readOnly}
            tokenHashPrefix={tokens?.readOnlyHashPrefix}
            path="/read/"
            tooltipId="tooltip-copy-link-ro"
          />
        </div>
      </Col>
    </Row>
  )
}

function AccessToken({ token, tokenHashPrefix, path, tooltipId }) {
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

AccessToken.propTypes = {
  token: PropTypes.string,
  tokenHashPrefix: PropTypes.string,
  tooltipId: PropTypes.string.isRequired,
  path: PropTypes.string.isRequired,
}

function LinkSharingInfo() {
  const { t } = useTranslation()

  return (
    <Tooltip
      id="link-sharing-info"
      description={t('learn_more_about_link_sharing')}
    >
      <a
        href="/learn/how-to/What_is_Link_Sharing%3F"
        target="_blank"
        rel="noopener"
      >
        <Icon type="question-circle" />
      </a>
    </Tooltip>
  )
}
