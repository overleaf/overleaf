import { useCallback, useEffect } from 'react'
import Notification from './notification'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import getMeta from '../../../../utils/meta'
import customLocalStorage from '../../../../infrastructure/local-storage'
import { useProjectListContext } from '../../context/project-list-context'
import { useTranslation } from 'react-i18next'

const variants = ['did-you-know', 'on-premise', 'people', 'FOMO'] as const
type GroupsAndEnterpriseBannerVariant = typeof variants[number]

let viewEventSent = false

export default function GroupsAndEnterpriseBanner() {
  const { t } = useTranslation()
  const { totalProjectsCount } = useProjectListContext()

  const showGroupsAndEnterpriseBanner: boolean = getMeta(
    'ol-showGroupsAndEnterpriseBanner'
  )
  const groupsAndEnterpriseBannerVariant: GroupsAndEnterpriseBannerVariant =
    getMeta('ol-groupsAndEnterpriseBannerVariant')
  const newNotificationStyle = getMeta(
    'ol-newNotificationStyle',
    false
  ) as boolean

  const hasDismissedGroupsAndEnterpriseBanner = hasRecentlyDismissedBanner()

  const contactSalesUrl = `/for/contact-sales-${
    variants.indexOf(groupsAndEnterpriseBannerVariant) + 1
  }`

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
      bsStyle="info"
      onDismiss={handleClose}
      body={<BannerContent variant={groupsAndEnterpriseBannerVariant} />}
      action={
        <a
          className={
            newNotificationStyle
              ? 'btn btn-secondary btn-sm'
              : 'pull-right btn btn-info btn-sm'
          }
          href={contactSalesUrl}
          target="_blank"
          rel="noreferrer"
          onClick={handleClickContact}
        >
          {t('contact_sales')}
        </a>
      }
    />
  )
}

function isVariantValid(variant: GroupsAndEnterpriseBannerVariant) {
  return variants.includes(variant)
}

function BannerContent({
  variant,
}: {
  variant: GroupsAndEnterpriseBannerVariant
}) {
  const { t } = useTranslation()

  switch (variant) {
    case 'did-you-know':
      return <span>{t('did_you_know_that_overleaf_offers')}</span>
    case 'on-premise':
      return (
        <span>
          Overleaf On-Premises: Does your company want to keep its data within
          its firewall? Overleaf offers Server Pro, an on-premises solution for
          companies. Get in touch to learn more.
        </span>
      )
    case 'people':
      return (
        <span>
          Other people at your company may already be using Overleaf. Save money
          with Overleaf group and company-wide subscriptions. Request more
          information.
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
