import { useCallback, useEffect } from 'react'
import Notification from './notification'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import getMeta from '../../../../utils/meta'
import customLocalStorage from '../../../../infrastructure/local-storage'
import { useProjectListContext } from '../../context/project-list-context'
import { useTranslation } from 'react-i18next'
import {
  GroupsAndEnterpriseBannerVariant,
  GroupsAndEnterpriseBannerVariants,
} from '../../../../../../types/project/dashboard/notification'
import OLButton from '@/shared/components/ol/ol-button'
import { postJSON } from '@/infrastructure/fetch-json'
import moment from 'moment'
import { debugConsole } from '@/utils/debugging'

type urlForVariantsType = {
  [key in GroupsAndEnterpriseBannerVariant]: string // eslint-disable-line no-unused-vars
}

const urlForVariants: urlForVariantsType = {
  'on-premise': '/for/contact-sales-2',
  FOMO: '/for/contact-sales-4',
}

const INITIAL_TUTORIAL_KEY = 'groups-enterprise-banner'
const REPEAT_TUTORIAL_KEY = 'groups-enterprise-banner-repeat'

let viewEventSent = false

export default function GroupsAndEnterpriseBanner() {
  const { t } = useTranslation()
  const { totalProjectsCount } = useProjectListContext()

  const showGroupsAndEnterpriseBanner = getMeta(
    'ol-showGroupsAndEnterpriseBanner'
  )
  const groupsAndEnterpriseBannerVariant = getMeta(
    'ol-groupsAndEnterpriseBannerVariant'
  )
  const inactiveTutorials = getMeta('ol-inactiveTutorials')

  const locallyDismissedBanner = hasLocallyDismissedBanner()
  const contactSalesUrl = urlForVariants[groupsAndEnterpriseBannerVariant]

  const shouldRenderBanner =
    showGroupsAndEnterpriseBanner &&
    totalProjectsCount !== 0 &&
    !inactiveTutorials.includes(REPEAT_TUTORIAL_KEY) &&
    !locallyDismissedBanner &&
    isVariantValid(groupsAndEnterpriseBannerVariant)

  const handleClose = useCallback(async () => {
    if (!inactiveTutorials.includes(INITIAL_TUTORIAL_KEY)) {
      await postJSON(`/tutorial/${REPEAT_TUTORIAL_KEY}/postpone`, {
        body: {
          postponedUntil: moment().add(60, 'days').toISOString(),
        },
      }).catch(debugConsole.error)

      await postJSON(`/tutorial/${INITIAL_TUTORIAL_KEY}/complete`).catch(
        debugConsole.error
      )
    } else {
      await postJSON(`/tutorial/${REPEAT_TUTORIAL_KEY}/complete`).catch(
        debugConsole.error
      )
    }
  }, [inactiveTutorials])

  const handleClickContact = useCallback(() => {
    eventTracking.sendMB('groups-and-enterprise-banner-click', {
      location: 'dashboard-banner-react',
      variant: groupsAndEnterpriseBannerVariant,
    })
  }, [groupsAndEnterpriseBannerVariant])

  useEffect(() => {
    if (!viewEventSent && shouldRenderBanner) {
      eventTracking.sendMB('groups-and-enterprise-banner-prompt', {
        location: 'dashboard-banner-react',
        variant: groupsAndEnterpriseBannerVariant,
      })
      viewEventSent = true
    }
  }, [shouldRenderBanner, groupsAndEnterpriseBannerVariant])

  useEffect(() => {
    // Persist local dismissal status from previous banner versions to the backend
    if (
      locallyDismissedBanner &&
      !inactiveTutorials.includes(REPEAT_TUTORIAL_KEY)
    ) {
      handleClose()
    }
  }, [handleClose, locallyDismissedBanner, inactiveTutorials])

  if (!shouldRenderBanner) {
    return null
  }

  return (
    <Notification
      type="info"
      onDismiss={handleClose}
      content={<BannerContent variant={groupsAndEnterpriseBannerVariant} />}
      action={
        <OLButton
          variant="secondary"
          href={contactSalesUrl}
          target="_blank"
          rel="noreferrer"
          onClick={handleClickContact}
        >
          {t('contact_sales')}
        </OLButton>
      }
    />
  )
}

function isVariantValid(variant: GroupsAndEnterpriseBannerVariant) {
  return GroupsAndEnterpriseBannerVariants.includes(variant)
}

function BannerContent({
  variant,
}: {
  variant: GroupsAndEnterpriseBannerVariant
}) {
  switch (variant) {
    case 'on-premise':
      return (
        <span>
          Overleaf On-Premises: Does your company want to keep its data within
          its firewall? Overleaf offers Server Pro, an on-premises solution for
          companies. Get in touch to learn more.
        </span>
      )
    case 'FOMO':
      return (
        <span>
          Why do Fortune 500 companies and top research institutions trust
          Overleaf to streamline their collaboration? Get in touch to learn
          more.
        </span>
      )
  }
}

function hasLocallyDismissedBanner() {
  const dismissed = customLocalStorage.getItem(
    'has_dismissed_groups_and_enterprise_banner'
  )
  // previous banner set this to 'true', which shouldn't hide the new banner
  if (!dismissed || dismissed === 'true') {
    return false
  }

  const dismissedDate = new Date(dismissed)
  const recentlyDismissedCutoff = new Date()
  recentlyDismissedCutoff.setDate(recentlyDismissedCutoff.getDate() - 30) // 30 days

  // once the dismissedDate passes the cut off mark, banner will be shown again
  return dismissedDate > recentlyDismissedCutoff
}
