import { ElementType } from 'react'
import { useTranslation } from 'react-i18next'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'
import { useSSOContext, SSOSubscription } from '../context/sso-context'
import { SSOLinkingWidget } from './linking/sso-widget'
import getMeta from '../../../utils/meta'
import { useBroadcastUser } from '@/shared/hooks/user-channel/use-broadcast-user'
import OLNotification from '@/features/ui/components/ol/ol-notification'

const availableIntegrationLinkingWidgets = importOverleafModules(
  'integrationLinkingWidgets'
) as any[]
const availableReferenceLinkingWidgets = importOverleafModules(
  'referenceLinkingWidgets'
) as any[]
const availableLangFeedbackLinkingWidgets = importOverleafModules(
  'langFeedbackLinkingWidgets'
) as any[]

function LinkingSection() {
  useBroadcastUser()
  const { t } = useTranslation()
  const { subscriptions } = useSSOContext()
  const ssoErrorMessage = getMeta('ol-ssoErrorMessage')
  const cannotUseAi = getMeta('ol-cannot-use-ai')
  const projectSyncSuccessMessage = getMeta('ol-projectSyncSuccessMessage')

  // hide linking widgets in CI
  const integrationLinkingWidgets = getMeta('ol-hideLinkingWidgets')
    ? []
    : availableIntegrationLinkingWidgets
  const referenceLinkingWidgets = getMeta('ol-hideLinkingWidgets')
    ? []
    : availableReferenceLinkingWidgets
  const langFeedbackLinkingWidgets = getMeta('ol-hideLinkingWidgets')
    ? []
    : availableLangFeedbackLinkingWidgets

  const oauth2ServerComponents = importOverleafModules('oauth2Server') as {
    import: { default: ElementType }
    path: string
  }[]

  const renderSyncSection =
    getMeta('ol-isSaas') || getMeta('ol-gitBridgeEnabled')

  const allIntegrationLinkingWidgets = integrationLinkingWidgets.concat(
    oauth2ServerComponents
  )

  // since we only have Writefull here currently, we should hide the whole section if they cant use ai
  const haslangFeedbackLinkingWidgets =
    langFeedbackLinkingWidgets.length && !cannotUseAi
  const hasIntegrationLinkingSection =
    renderSyncSection && allIntegrationLinkingWidgets.length
  const hasReferencesLinkingSection = referenceLinkingWidgets.length

  // Filter out SSO providers that are not allowed to be linked by
  // managed users. Allow unlinking them if they are already linked.
  const hideGoogleSSO = getMeta('ol-cannot-link-google-sso')
  const hideOtherThirdPartySSO = getMeta('ol-cannot-link-other-third-party-sso')

  for (const providerId in subscriptions) {
    const isLinked = subscriptions[providerId].linked
    if (providerId === 'google') {
      if (hideGoogleSSO && !isLinked) {
        delete subscriptions[providerId]
      }
    } else {
      if (hideOtherThirdPartySSO && !isLinked) {
        delete subscriptions[providerId]
      }
    }
  }

  const hasSSOLinkingSection = Object.keys(subscriptions).length > 0

  if (
    !haslangFeedbackLinkingWidgets &&
    !hasIntegrationLinkingSection &&
    !hasReferencesLinkingSection &&
    !hasSSOLinkingSection
  ) {
    return null
  }

  return (
    <>
      <h3 id="integrations">{t('integrations')}</h3>
      <p className="small">{t('linked_accounts_explained')}</p>
      {haslangFeedbackLinkingWidgets ? (
        <>
          <h3 id="language-feedback" className="text-capitalize">
            {t('ai_features')}
          </h3>
          <div className="settings-widgets-container">
            {langFeedbackLinkingWidgets.map(
              ({ import: { default: widget }, path }, widgetIndex) => (
                <ModuleLinkingWidget
                  key={path}
                  ModuleComponent={widget}
                  isLast={widgetIndex === langFeedbackLinkingWidgets.length - 1}
                />
              )
            )}
          </div>
        </>
      ) : null}
      {hasIntegrationLinkingSection ? (
        <>
          <h3 id="project-sync" className="text-capitalize">
            {t('project_synchronisation')}
          </h3>
          {projectSyncSuccessMessage ? (
            <OLNotification
              type="success"
              content={projectSyncSuccessMessage}
            />
          ) : null}
          <div className="settings-widgets-container">
            {allIntegrationLinkingWidgets.map(
              ({ import: importObject, path }, widgetIndex) => (
                <ModuleLinkingWidget
                  key={Object.keys(importObject)[0]}
                  ModuleComponent={Object.values(importObject)[0]}
                  isLast={
                    widgetIndex === allIntegrationLinkingWidgets.length - 1
                  }
                />
              )
            )}
          </div>
        </>
      ) : null}
      {hasReferencesLinkingSection ? (
        <>
          <h3 id="references" className="text-capitalize">
            {t('reference_managers')}
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
          {ssoErrorMessage ? (
            <OLNotification
              type="error"
              content={`${t('sso_link_error')}: ${ssoErrorMessage}`}
            />
          ) : null}
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
      {haslangFeedbackLinkingWidgets ||
      hasIntegrationLinkingSection ||
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

  let description = ''
  switch (subscription.providerId) {
    case 'collabratec':
      description = t('linked_collabratec_description')
      break
    case 'google':
      description = `${t('login_with_service', {
        service: subscription.provider.name,
      })}.`
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
