import MaterialIcon from '@/shared/components/material-icon'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import OLButton from '@/shared/components/ol/ol-button'

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
    <OLTooltip
      id={tooltipId}
      description={
        <>
          <div>{label}</div>
          {shortcut && <div>{shortcut}</div>}
        </>
      }
      overlayProps={{ placement: 'bottom' }}
    >
      <OLButton
        variant="ghost"
        className="pdf-toolbar-btn pdfjs-toolbar-button"
        disabled={disabled}
        onClick={onClick}
        aria-label={label}
      >
        <MaterialIcon type={icon} />
      </OLButton>
    </OLTooltip>
  )
}
