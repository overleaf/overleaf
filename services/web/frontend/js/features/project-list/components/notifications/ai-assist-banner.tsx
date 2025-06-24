import { memo, useCallback, useEffect } from 'react'
import Notification from './notification'
import { useTranslation } from 'react-i18next'
import OLButton from '@/features/ui/components/ol/ol-button'
import { sendMB } from '@/infrastructure/event-tracking'
import sparkle from '@/shared/svgs/sparkle-2-stars.svg'
import { useSplitTest } from '@/shared/context/split-test-context'
import { useProjectListContext } from '../../context/project-list-context'
import getMeta from '@/utils/meta'
import usePersistedState from '@/shared/hooks/use-persisted-state'

function AiAssistBanner() {
  const { title, description, cta } = useTitleDescription()
  const { totalProjectsCount } = useProjectListContext()
  const [dismissed, setDismissed] = usePersistedState(
    'ai-assist-notification-banner-dismissed',
    false
  )
  const { variant } = useSplitTest('ai-assist-notification')
  const { t } = useTranslation()

  useEffect(() => {
    if (!dismissed) {
      sendMB('promo-prompt', {
        location: 'dashboard-banner',
        name: 'ai-assist',
        variant,
      })
    }
  }, [dismissed, variant])

  const handleClose = useCallback(() => {
    sendMB('promo-dismiss', {
      location: 'dashboard-banner',
      name: 'ai-assist',
      variant,
    })
    setDismissed(true)
  }, [setDismissed, variant])

  const handleUpgradeClick = useCallback(() => {
    sendMB('promo-click', {
      location: 'dashboard-banner',
      name: 'ai-assist',
      variant,
      type: 'click-upgrade',
    })
  }, [variant])

  const handleLearnMoreClick = useCallback(() => {
    sendMB('promo-click', {
      location: 'dashboard-banner',
      name: 'ai-assist',
      type: 'click-learn-more',
      variant,
    })
  }, [variant])

  if (
    !title ||
    dismissed ||
    totalProjectsCount === 0 ||
    !getMeta('ol-showAiAssistNotification')
  ) {
    return null
  }

  return (
    <Notification
      type="offer"
      customIcon={<img aria-hidden="true" alt="" src={sparkle} width={32} />}
      iconPlacement="center"
      title={title}
      onDismiss={handleClose}
      content={
        <p>
          {description}{' '}
          <a onClick={handleLearnMoreClick} href="/about/ai-features">
            {t('learn_more')}
          </a>
          .
        </p>
      }
      action={
        <OLButton
          variant="secondary"
          href="/user/subscription/plans#ai-assist"
          onClick={handleUpgradeClick}
        >
          {cta}
        </OLButton>
      }
    />
  )
}

function useTitleDescription() {
  const { variant } = useSplitTest('ai-assist-notification')
  const { t } = useTranslation()

  switch (variant) {
    case 'work-smarter':
      return {
        title: t('work_smarter_with_ai_assist'),
        description: t('work_smarter_with_ai_assist_description'),
        cta: t('add_ai_assist'),
      }
    case 'discover-toolkit':
      return {
        title: t('discover_research_writing_toolkit'),
        description: t('discover_research_writing_toolkit_description'),
        cta: t('add_ai_assist'),
      }
    case 'write-smarter':
      return {
        title: t('write_smarter_right_now'),
        description: t('write_smarter_right_now_description'),
        cta: t('add_ai_assist'),
      }
    default:
      return {
        title: null,
        description: null,
        cta: null,
      }
  }
}
export default memo(AiAssistBanner)
