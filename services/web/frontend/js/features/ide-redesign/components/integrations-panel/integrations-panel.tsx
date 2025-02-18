import { ElementType } from 'react'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'
import MaterialIcon from '@/shared/components/material-icon'
import OlButton from '@/features/ui/components/ol/ol-button'
import { useRailContext } from '../../contexts/rail-context'

const integrationPanelComponents = importOverleafModules(
  'integrationPanelComponents'
) as { import: { default: ElementType }; path: string }[]

export default function IntegrationsPanel() {
  const { handlePaneCollapse } = useRailContext()

  return (
    <div className="integrations-panel">
      <header className="integrations-panel-header">
        <h4 className="integrations-panel-title">Integrations</h4>
        <OlButton onClick={handlePaneCollapse} variant="ghost" size="sm">
          <MaterialIcon type="close" />
        </OlButton>
      </header>
      {integrationPanelComponents.map(
        ({ import: { default: Component }, path }) => (
          <Component key={path} />
        )
      )}
    </div>
  )
}
