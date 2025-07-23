import OLBadge from '@/features/ui/components/ol/ol-badge'
import MaterialIcon from '@/shared/components/material-icon'
import { useTranslation } from 'react-i18next'

export default function IntegrationCard({
  onClick,
  title,
  description,
  icon,
  showPaywallBadge,
}: {
  onClick: () => void
  title: string
  description: string
  icon: React.ReactNode
  showPaywallBadge: boolean
}) {
  const { t } = useTranslation()

  return (
    <button onClick={onClick} className="integrations-panel-card-button">
      <div className="integrations-panel-card-contents">
        {icon}
        <div className="integrations-panel-card-inner">
          <header className="integrations-panel-card-header">
            <div className="integrations-panel-card-title">{title}</div>
            {showPaywallBadge && (
              <OLBadge
                prepend={<MaterialIcon type="star" />}
                bg="light"
                className="integrations-panel-card-premium-badge"
              >
                {t('premium')}
              </OLBadge>
            )}
          </header>
          <p className="integrations-panel-card-description">{description}</p>
        </div>
      </div>
    </button>
  )
}
