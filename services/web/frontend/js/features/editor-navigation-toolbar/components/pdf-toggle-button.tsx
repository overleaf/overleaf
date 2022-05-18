import classNames from 'classnames'
import Tooltip from '../../../shared/components/tooltip'
import Icon from '../../../shared/components/icon'

type PdfToggleButtonProps = {
  onClick: () => void
  pdfViewIsOpen?: boolean
}

function PdfToggleButton({ onClick, pdfViewIsOpen }: PdfToggleButtonProps) {
  const classes = classNames(
    'btn',
    'btn-full-height',
    'btn-full-height-no-border',
    {
      active: pdfViewIsOpen,
    }
  )

  return (
    <Tooltip
      id="online-user"
      description="PDF"
      overlayProps={{ placement: 'bottom', trigger: ['hover', 'focus'] }}
    >
      {/* eslint-disable-next-line jsx-a11y/anchor-is-valid,jsx-a11y/click-events-have-key-events,jsx-a11y/interactive-supports-focus */}
      <a role="button" className={classes} onClick={onClick}>
        <Icon type="file-pdf-o" fw accessibilityLabel="PDF" />
      </a>
    </Tooltip>
  )
}

export default PdfToggleButton
