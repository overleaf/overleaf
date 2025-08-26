import { FC } from 'react'
import SplitTestBadge from '@/shared/components/split-test-badge'
import MaterialIcon from '@/shared/components/material-icon'
import { useTranslation } from 'react-i18next'
import OLTooltip from '@/shared/components/ol/ol-tooltip'

// TODO ide-redesign-cleanup: Remove this component and only use RailPanelHeader
export const PanelHeading: FC<
  React.PropsWithChildren<{
    title: string
    splitTestName?: string
    children?: React.ReactNode
    handleClose(): void
  }>
> = ({ title, splitTestName, children, handleClose }) => {
  const { t } = useTranslation()

  return (
    <div className="panel-heading">
      <div className="panel-heading-label">
        <span>{title}</span>
        {splitTestName && (
          <SplitTestBadge
            splitTestName={splitTestName}
            displayOnVariants={['enabled']}
          />
        )}
      </div>

      {children}
      <OLTooltip
        id="close-panel"
        description={t('close')}
        overlayProps={{ placement: 'bottom' }}
      >
        <button
          type="button"
          className="btn panel-heading-close-button"
          aria-label={t('close')}
          onClick={handleClose}
        >
          <MaterialIcon type="close" />
        </button>
      </OLTooltip>
    </div>
  )
}
