import { useTranslation } from 'react-i18next'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'
const integrationLinkingWidgets = importOverleafModules(
  'integrationLinkingWidgets'
)

function IntegrationLinkingSection() {
  const { t } = useTranslation()

  return (
    <>
      <h3>{t('integrations')}</h3>
      <p>{t('linked_accounts_explained')}</p>
      <div className="settings-widgets-container">
        {integrationLinkingWidgets.map(
          ({ import: importObject, path }, widgetIndex) => (
            <IntegrationLinkingWidget
              key={Object.keys(importObject)[0]}
              ModuleComponent={Object.values(importObject)[0]}
              isLast={widgetIndex === integrationLinkingWidgets.length - 1}
            />
          )
        )}
      </div>
    </>
  )
}

type IntegrationLinkingWidgetProps = {
  ModuleComponent: any
  isLast: boolean
}

function IntegrationLinkingWidget({
  ModuleComponent,
  isLast,
}: IntegrationLinkingWidgetProps) {
  return (
    <>
      <ModuleComponent />
      {isLast ? null : <hr />}
    </>
  )
}

export default IntegrationLinkingSection
