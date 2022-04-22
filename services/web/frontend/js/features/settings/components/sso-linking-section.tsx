import { useTranslation } from 'react-i18next'
import {
  SSOProvider,
  useSSOContext,
  SSOSubscription,
} from '../context/sso-context'
import { SSOLinkingWidget } from './sso-linking/widget'

function SSOLinkingSection() {
  const { t } = useTranslation()

  return (
    <SSOProvider>
      <h3 className="text-capitalize">{t('linked_accounts')}</h3>
      <p>{t('linked_accounts_explained')}</p>
      <SSOLinkingWidgets />
    </SSOProvider>
  )
}

function SSOLinkingWidgets() {
  const { subscriptions } = useSSOContext()

  return (
    <div className="settings-widgets-container">
      {Object.values(subscriptions).map((subscription, subscriptionIndex) => (
        <SSOLinkingWidgetContainer
          key={subscription.providerId}
          subscription={subscription}
          isLast={subscriptionIndex === Object.keys(subscriptions).length - 1}
        />
      ))}
    </div>
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

  return (
    <>
      <SSOLinkingWidget
        providerId={subscription.providerId}
        title={subscription.provider.name}
        description={t(
          subscription.provider.descriptionKey,
          subscription.provider.descriptionOptions
        )}
        helpPath={subscription.provider.descriptionOptions?.link}
        linked={subscription.linked}
        linkPath={subscription.provider.linkPath}
        onUnlink={() => unlink(subscription.providerId)}
      />
      {isLast ? null : <hr />}
    </>
  )
}

export default SSOLinkingSection
