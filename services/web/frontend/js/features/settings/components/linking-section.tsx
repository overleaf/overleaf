import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'
import { useSSOContext, SSOSubscription } from '../context/sso-context'
import { SSOLinkingWidget } from './linking/sso-widget'
import getMeta from '../../../utils/meta'

function LinkingSection() {
  const { t } = useTranslation()
  const { subscriptions } = useSSOContext()

  const [integrationLinkingWidgets] = useState(
    () =>
      getMeta('integrationLinkingWidgets') ||
      importOverleafModules('integrationLinkingWidgets')
  )
  const [referenceLinkingWidgets] = useState(
    () =>
      getMeta('referenceLinkingWidgets') ||
      importOverleafModules('referenceLinkingWidgets')
  )

  const hasIntegrationLinkingSection = integrationLinkingWidgets.length
  const hasReferencesLinkingSection = referenceLinkingWidgets.length
  const hasSSOLinkingSection = Object.keys(subscriptions).length > 0

  if (
    !hasIntegrationLinkingSection &&
    !hasReferencesLinkingSection &&
    !hasSSOLinkingSection
  ) {
    return null
  }

  return (
    <>
      <h3>{t('integrations')}</h3>
      <p className="small">{t('linked_accounts_explained')}</p>
      {hasIntegrationLinkingSection ? (
        <>
          <h3 id="project-sync" className="text-capitalize">
            {t('sync_dropbox_github')}
          </h3>
          <div className="settings-widgets-container">
            {integrationLinkingWidgets.map(
              ({ import: importObject, path }, widgetIndex) => (
                <ModuleLinkingWidget
                  key={Object.keys(importObject)[0]}
                  ModuleComponent={Object.values(importObject)[0]}
                  isLast={widgetIndex === integrationLinkingWidgets.length - 1}
                />
              )
            )}
          </div>
        </>
      ) : null}
      {hasReferencesLinkingSection ? (
        <>
          <h3 id="references" className="text-capitalize">
            {t('reference_sync')}
          </h3>
          <div className="settings-widgets-container">
            {referenceLinkingWidgets.map(
              ({ import: importObject, path }, widgetIndex) => (
                <ModuleLinkingWidget
                  key={Object.keys(importObject)[0]}
                  ModuleComponent={Object.values(importObject)[0]}
                  isLast={widgetIndex === referenceLinkingWidgets.length - 1}
                />
              )
            )}
          </div>
        </>
      ) : null}
      {hasSSOLinkingSection ? (
        <>
          <h3 id="linked-accounts" className="text-capitalize">
            {t('linked_accounts')}
          </h3>
          <div className="settings-widgets-container">
            {Object.values(subscriptions).map(
              (subscription, subscriptionIndex) => (
                <SSOLinkingWidgetContainer
                  key={subscription.providerId}
                  subscription={subscription}
                  isLast={
                    subscriptionIndex === Object.keys(subscriptions).length - 1
                  }
                />
              )
            )}
          </div>
        </>
      ) : null}
      {hasIntegrationLinkingSection ||
      hasReferencesLinkingSection ||
      hasSSOLinkingSection ? (
        <hr />
      ) : null}
    </>
  )
}

type LinkingWidgetProps = {
  ModuleComponent: any
  isLast: boolean
}

function ModuleLinkingWidget({ ModuleComponent, isLast }: LinkingWidgetProps) {
  return (
    <>
      <ModuleComponent />
      {isLast ? null : <hr />}
    </>
  )
}

type SSOLinkingWidgetContainerProps = {
  subscription: SSOSubscription
  isLast: boolean
}

function SSOLinkingWidgetContainer({
  subscription,
  isLast,
}: SSOLinkingWidgetContainerProps) {
  const { t } = useTranslation()
  const { unlink } = useSSOContext()

  let description = null
  switch (subscription.providerId) {
    case 'collabratec':
      description = t('linked_collabratec_description')
      break
    case 'google':
    case 'twitter':
      description = t('login_with_service', {
        service: subscription.provider.name,
      })
      break
    case 'orcid':
      description = t('oauth_orcid_description')
      break
  }

  return (
    <>
      <SSOLinkingWidget
        providerId={subscription.providerId}
        title={subscription.provider.name}
        description={description}
        helpPath={subscription.provider.descriptionOptions?.link}
        linked={subscription.linked}
        linkPath={subscription.provider.linkPath}
        onUnlink={() => unlink(subscription.providerId)}
      />
      {isLast ? null : <hr />}
    </>
  )
}

export default LinkingSection
