import React, { useCallback, useState } from 'react'
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap'
import PropTypes from 'prop-types'
import { Trans } from 'react-i18next'
import Icon from './icon'

export default function CopyLink({ link, tooltipId }) {
  const [copied, setCopied] = useState(false)

  const handleClick = useCallback(() => {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      window.setTimeout(() => {
        setCopied(false)
      }, 1500)
    })
  }, [link])

  if (!navigator.clipboard?.writeText) {
    return null
  }

  return (
    <OverlayTrigger
      placement="top"
      delayHide={copied ? 1000 : 250}
      shouldUpdatePosition
      overlay={
        <Tooltip id={tooltipId}>
          {copied ? 'Copied!' : <Trans i18nKey="copy" />}
        </Tooltip>
      }
    >
      <Button
        onClick={handleClick}
        bsSize="xsmall"
        bsStyle="link"
        className="copy-button"
        aria-label="Copy"
      >
        {copied ? <Icon type="check" /> : <Icon type="clipboard" />}
      </Button>
    </OverlayTrigger>
  )
}
CopyLink.propTypes = {
  link: PropTypes.string.isRequired,
  tooltipId: PropTypes.string.isRequired
}
