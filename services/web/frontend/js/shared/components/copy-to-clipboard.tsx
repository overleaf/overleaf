import { FC, memo, MouseEventHandler, useCallback, useState } from 'react'
import { Button } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import Tooltip from './tooltip'
import Icon from './icon'

export const CopyToClipboard = memo<{
  content: string
  tooltipId: string
  kind?: 'text' | 'icon'
}>(({ content, tooltipId, kind = 'icon' }) => {
  const { t } = useTranslation()

  const [copied, setCopied] = useState(false)

  const handleClick = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      window.setTimeout(() => {
        setCopied(false)
      }, 1500)
    })
  }, [content])

  if (!navigator.clipboard?.writeText) {
    return null
  }

  return (
    <Tooltip
      id={tooltipId}
      description={copied ? `${t('copied')}!` : t('copy')}
      overlayProps={{
        delayHide: copied ? 1000 : 250,
        shouldUpdatePosition: true,
      }}
    >
      <span>
        {kind === 'text' ? (
          <TextButton handleClick={handleClick} />
        ) : (
          <IconButton handleClick={handleClick} copied={copied} />
        )}
      </span>
    </Tooltip>
  )
})
CopyToClipboard.displayName = 'CopyToClipboard'

const TextButton: FC<{
  handleClick: MouseEventHandler<Button>
}> = ({ handleClick }) => {
  const { t } = useTranslation()

  return (
    <Button
      onClick={handleClick}
      bsSize="xsmall"
      bsStyle={null}
      className="copy-button btn-secondary"
    >
      {t('copy')}
    </Button>
  )
}

const IconButton: FC<{
  handleClick: MouseEventHandler<Button>
  copied: boolean
}> = ({ handleClick, copied }) => {
  const { t } = useTranslation()

  return (
    <Button
      onClick={handleClick}
      bsSize="xsmall"
      bsStyle="link"
      className="copy-button"
      aria-label={t('copy')}
    >
      <Icon type={copied ? 'check' : 'clipboard'} />
    </Button>
  )
}
