import { useCallback, useState } from 'react'
import PropTypes from 'prop-types'
import { Button, Col, Row } from 'react-bootstrap'
import { Trans, useTranslation } from 'react-i18next'
import Tooltip from '../../../shared/components/tooltip'
import Icon from '../../../shared/components/icon'
import { useShareProjectContext } from './share-project-modal'
import { setProjectAccessLevel } from '../utils/api'
import CopyLink from '../../../shared/components/copy-link'
import { useProjectContext } from '../../../shared/context/project-context'
import * as eventTracking from '../../../infrastructure/event-tracking'
import { useUserContext } from '../../../shared/context/user-context'
import StartFreeTrialButton from '../../../shared/components/start-free-trial-button'
import { useSplitTestContext } from '../../../shared/context/split-test-context'
import getMeta from '../../../utils/meta'

export default function LinkSharing({ canAddCollaborators }) {
  const [inflight, setInflight] = useState(false)

  const { monitorRequest } = useShareProjectContext()

  const { _id: projectId, publicAccessLevel } = useProjectContext()

  // set the access level of a project
  const setAccessLevel = useCallback(
    newPublicAccessLevel => {
      setInflight(true)
      monitorRequest(() =>
        setProjectAccessLevel(projectId, newPublicAccessLevel)
      )
        .then(() => {
          // NOTE: not calling `updateProject` here as it receives data via
          // project:publicAccessLevel:changed and project:tokens:changed
          // over the websocket connection
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
        <PrivateSharing setAccessLevel={setAccessLevel} inflight={inflight} />
      )

    // Token-based access
    case 'tokenBased':
      return (
        <TokenBasedSharing
          setAccessLevel={setAccessLevel}
          inflight={inflight}
          canAddCollaborators={canAddCollaborators}
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

LinkSharing.propTypes = {
  canAddCollaborators: PropTypes.bool,
}

function PrivateSharing({ setAccessLevel, inflight }) {
  return (
    <Row className="public-access-level">
      <Col xs={12} className="text-center">
        <Trans i18nKey="link_sharing_is_off" />
        <span>&nbsp;&nbsp;</span>
        <Button
          type="button"
          bsStyle="link"
          className="btn-inline-link"
          onClick={() => {
            setAccessLevel('tokenBased')
            eventTracking.sendMB('link-sharing-click')
          }}
          disabled={inflight}
        >
          <Trans i18nKey="turn_on_link_sharing" />
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
}

function TokenBasedSharing({ setAccessLevel, inflight, canAddCollaborators }) {
  const { tokens } = useProjectContext()

  return (
    <Row className="public-access-level">
      <Col xs={12} className="text-center">
        <strong>
          <Trans i18nKey="link_sharing_is_on" />
        </strong>
        <span>&nbsp;&nbsp;</span>
        <Button
          bsStyle="link"
          className="btn-inline-link"
          onClick={() => setAccessLevel('private')}
          disabled={inflight}
        >
          <Trans i18nKey="turn_off_link_sharing" />
        </Button>
        <span>&nbsp;&nbsp;</span>
        <LinkSharingInfo />
      </Col>
      <LinkSharingUpgradePrompt canAddCollaborators={canAddCollaborators} />
      <Col xs={12} className="access-token-display-area">
        <div className="access-token-wrapper">
          <strong>
            <Trans i18nKey="anyone_with_link_can_edit" />
          </strong>
          <AccessToken
            token={tokens?.readAndWrite}
            path="/"
            tooltipId="tooltip-copy-link-rw"
          />
        </div>
        <div className="access-token-wrapper">
          <strong>
            <Trans i18nKey="anyone_with_link_can_view" />
          </strong>
          <AccessToken
            token={tokens?.readOnly}
            path="/read/"
            tooltipId="tooltip-copy-link-ro"
          />
        </div>
      </Col>
    </Row>
  )
}

TokenBasedSharing.propTypes = {
  setAccessLevel: PropTypes.func.isRequired,
  inflight: PropTypes.bool,
  canAddCollaborators: PropTypes.bool,
}

function LegacySharing({ accessLevel, setAccessLevel, inflight }) {
  return (
    <Row className="public-access-level">
      <Col xs={12} className="text-center">
        <strong>
          {accessLevel === 'readAndWrite' && (
            <Trans i18nKey="this_project_is_public" />
          )}
          {accessLevel === 'readOnly' && (
            <Trans i18nKey="this_project_is_public_read_only" />
          )}
        </strong>
        <span>&nbsp;&nbsp;</span>
        <Button
          type="button"
          bsStyle="link"
          className="btn-inline-link"
          onClick={() => setAccessLevel('private')}
          disabled={inflight}
        >
          <Trans i18nKey="make_private" />
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
  const { tokens } = useProjectContext()

  return (
    <Row className="public-access-level">
      <Col xs={12} className="access-token-display-area">
        <div className="access-token-wrapper">
          <strong>
            <Trans i18nKey="anyone_with_link_can_view" />
          </strong>
          <AccessToken
            token={tokens?.readOnly}
            path="/read/"
            tooltipId="tooltip-copy-link-ro"
          />
        </div>
      </Col>
    </Row>
  )
}

function AccessToken({ token, path, tooltipId }) {
  const { isAdmin } = useUserContext()

  if (!token) {
    return (
      <pre className="access-token">
        <span>
          <Trans i18nKey="loading" />…
        </span>
      </pre>
    )
  }

  let origin = window.location.origin
  if (isAdmin) {
    origin = window.ExposedSettings.siteUrl
  }
  const link = `${origin}${path}${token}`

  return (
    <pre className="access-token">
      <span>{link}</span>
      <CopyLink link={link} tooltipId={tooltipId} />
    </pre>
  )
}

AccessToken.propTypes = {
  token: PropTypes.string,
  tooltipId: PropTypes.string.isRequired,
  path: PropTypes.string.isRequired,
}

function LinkSharingInfo() {
  return (
    <Tooltip
      id="link-sharing-info"
      description={<Trans i18nKey="learn_more_about_link_sharing" />}
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

function LinkSharingUpgradePrompt({ canAddCollaborators }) {
  const [startedFreeTrial, setStartedFreeTrial] = useState(false)
  const { t } = useTranslation()
  const { splitTestVariants } = useSplitTestContext()
  const linkSharingUpgradePromptActive =
    splitTestVariants['link-sharing-upgrade-prompt'] === 'active'
  const showUpgradePrompt = getMeta('ol-showUpgradePrompt')

  const showLinkSharingUpgradePrompt =
    linkSharingUpgradePromptActive && showUpgradePrompt && canAddCollaborators

  if (!showLinkSharingUpgradePrompt) {
    return null
  }

  return (
    <>
      <Col xs={12} className="link-sharing-upgrade-prompt">
        <p>
          <Trans
            i18nKey="premium_makes_collab_easier_with_features"
            components={[<b />, <b />, <b />]} // eslint-disable-line react/jsx-key
          />
        </p>
        <StartFreeTrialButton
          buttonProps={{ bsStyle: 'success' }}
          handleClick={() => setStartedFreeTrial(true)}
          source="link-sharing"
        />
      </Col>
      {startedFreeTrial && (
        <p className="small teaser-refresh-label">
          {t('refresh_page_after_starting_free_trial')}
        </p>
      )}
    </>
  )
}

LinkSharingUpgradePrompt.propTypes = {
  canAddCollaborators: PropTypes.bool,
}
