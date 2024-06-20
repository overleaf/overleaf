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
import OLButton from '@/features/ui/components/ol/ol-button'

type urlForVariantsType = {
  [key in GroupsAndEnterpriseBannerVariant]: string // eslint-disable-line no-unused-vars
}

const urlForVariants: urlForVariantsType = {
  'on-premise': '/for/contact-sales-2',
  FOMO: '/for/contact-sales-4',
}

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

  const hasDismissedGroupsAndEnterpriseBanner = hasRecentlyDismissedBanner()

  const contactSalesUrl = urlForVariants[groupsAndEnterpriseBannerVariant]

  const shouldRenderBanner =
    showGroupsAndEnterpriseBanner &&
    totalProjectsCount !== 0 &&
    !hasDismissedGroupsAndEnterpriseBanner &&
    isVariantValid(groupsAndEnterpriseBannerVariant)

  const handleClose = useCallback(() => {
    customLocalStorage.setItem(
      'has_dismissed_groups_and_enterprise_banner',
      new Date()
    )
  }, [])

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

function hasRecentlyDismissedBanner() {
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
