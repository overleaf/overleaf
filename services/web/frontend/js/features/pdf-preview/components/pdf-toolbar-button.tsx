import Button from 'react-bootstrap/lib/Button'
import MaterialIcon from '@/shared/components/material-icon'
import Tooltip from '@/shared/components/tooltip'

type PDFToolbarButtonProps = {
  tooltipId: string
  icon: string
  label: string
  onClick: () => void
  shortcut?: string
  disabled?: boolean
}

export default function PDFToolbarButton({
  tooltipId,
  disabled,
  label,
  icon,
  onClick,
  shortcut,
}: PDFToolbarButtonProps) {
  return (
    <Tooltip
      id={tooltipId}
      description={
        <>
          <div>{label}</div>
          {shortcut && <div>{shortcut}</div>}
        </>
      }
      overlayProps={{ placement: 'bottom' }}
    >
      <Button
        aria-label={label}
        bsSize="large"
        bsStyle={null}
        className="pdf-toolbar-btn pdfjs-toolbar-button"
        disabled={disabled}
        onClick={onClick}
      >
        <MaterialIcon type={icon} />
      </Button>
    </Tooltip>
  )
}
