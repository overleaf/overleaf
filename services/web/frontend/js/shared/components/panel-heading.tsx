import { FC } from 'react'
import SplitTestBadge from '@/shared/components/split-test-badge'
import MaterialIcon from '@/shared/components/material-icon'
import { useTranslation } from 'react-i18next'

export const PanelHeading: FC<{
  title: string
  splitTestName?: string
  children?: React.ReactNode
  handleClose(): void
}> = ({ title, splitTestName, children, handleClose }) => {
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

      <button
        type="button"
        className="btn panel-heading-close-button"
        aria-label={t('close')}
        onClick={handleClose}
      >
        <MaterialIcon type="close" />
      </button>
    </div>
  )
}
