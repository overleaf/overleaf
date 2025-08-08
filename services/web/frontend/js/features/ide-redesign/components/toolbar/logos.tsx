import OLTooltip from '@/shared/components/ol/ol-tooltip'
import MaterialIcon from '@/shared/components/material-icon'
import { useTranslation } from 'react-i18next'
import { Cobranding } from '../../../../../../types/cobranding'

type ToolbarLogosProps = {
  cobranding?: Cobranding
}

export const ToolbarLogos = ({ cobranding }: ToolbarLogosProps) => {
  const { t } = useTranslation()

  return (
    <div className="ide-redesign-toolbar-logos">
      <OLTooltip
        id="tooltip-home-button"
        description={t('back_to_your_projects')}
        overlayProps={{ delay: 0, placement: 'bottom' }}
      >
        <div className="ide-redesign-toolbar-home-button">
          <a href="/project" className="ide-redesign-toolbar-home-link">
            <span className="toolbar-ol-logo" aria-label={t('overleaf_logo')} />
            <MaterialIcon type="home" className="toolbar-ol-home-button" />
          </a>
        </div>
      </OLTooltip>
      {cobranding && cobranding.logoImgUrl && (
        <>
          <span className="ide-redesign-toolbar-cobranding-separator" />
          <a
            className="ide-redesign-toolbar-cobranding-link"
            href={cobranding.brandVariationHomeUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            <img
              src={cobranding.logoImgUrl}
              className="ide-redesign-toolbar-cobranding-logo"
              alt={cobranding.brandVariationName}
            />
          </a>
        </>
      )}
    </div>
  )
}
