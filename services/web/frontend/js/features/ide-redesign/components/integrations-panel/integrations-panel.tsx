import { ElementType } from 'react'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'
import { useTranslation } from 'react-i18next'
import RailPanelHeader from '../rail/rail-panel-header'

const integrationPanelComponents = importOverleafModules(
  'integrationPanelComponents'
) as { import: { default: ElementType }; path: string }[]

export default function IntegrationsPanel() {
  const { t } = useTranslation()

  return (
    <div className="integrations-panel">
      <RailPanelHeader title={t('integrations')} />
      {integrationPanelComponents.map(
        ({ import: { default: Component }, path }) => (
          <Component key={path} />
        )
      )}
    </div>
  )
}
