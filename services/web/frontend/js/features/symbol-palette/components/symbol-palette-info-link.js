import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'

export default function SymbolPaletteInfoLink() {
  const { t } = useTranslation()

  return (
    <OverlayTrigger
      placement="top"
      trigger={['hover', 'focus']}
      overlay={
        <Tooltip id="tooltip-symbol-palette-info">
          {t('find_out_more_about_latex_symbols')}
        </Tooltip>
      }
    >
      <Button
        bsStyle="link"
        bsSize="small"
        className="symbol-palette-info-link"
        href="https://www.overleaf.com/learn/latex/List_of_Greek_letters_and_math_symbols"
        target="_blank"
        rel="noopener noreferer"
      >
        <span className="info-badge" />
      </Button>
    </OverlayTrigger>
  )
}
