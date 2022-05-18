import { useCallback, useState } from 'react'
import { Button } from 'react-bootstrap'
import { Trans, useTranslation } from 'react-i18next'
import Tooltip from './tooltip'
import Icon from './icon'

type CopyLinkProps = {
  link: string
  tooltipId: string
}

function CopyLink({ link, tooltipId }: CopyLinkProps) {
  const { t } = useTranslation()

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
    <Tooltip
      id={tooltipId}
      description={copied ? 'Copied!' : <Trans i18nKey="copy" />}
      overlayProps={{
        delayHide: copied ? 1000 : 250,
        shouldUpdatePosition: true,
      }}
    >
      <Button
        onClick={handleClick}
        bsSize="xsmall"
        bsStyle="link"
        className="copy-button"
        aria-label={t('copy')}
      >
        {copied ? <Icon type="check" /> : <Icon type="clipboard" />}
      </Button>
    </Tooltip>
  )
}

export default CopyLink
