import { useCallback, useEffect } from 'react'
import Notification from './notification'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import getMeta from '../../../../utils/meta'
import customLocalStorage from '../../../../infrastructure/local-storage'
import { useProjectListContext } from '../../context/project-list-context'
import { Trans, useTranslation } from 'react-i18next'

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
    <Notification bsStyle="info" onDismiss={handleClose}>
      <Notification.Body>
        <span>{getText(groupsAndEnterpriseBannerVariant)}</span>
      </Notification.Body>
      <Notification.Action>
        <a
          className="pull-right btn btn-info btn-sm"
          href={contactSalesUrl}
          target="_blank"
          rel="noreferrer"
          onClick={handleClickContact}
        >
          {t('contact_sales')}
        </a>
      </Notification.Action>
    </Notification>
  )
}

function isVariantValid(variant: GroupsAndEnterpriseBannerVariant) {
  return variants.includes(variant)
}

function getText(variant: GroupsAndEnterpriseBannerVariant) {
  switch (variant) {
    case 'did-you-know':
      return <Trans i18nKey="did_you_know_that_overleaf_offers" />
    case 'on-premise':
      return 'Overleaf On-Premises: Does your company want to keep its data within its firewall? Overleaf offers Server Pro, an on-premises solution for companies. Get in touch to learn more.'
    case 'people':
      return 'Other people at your company may already be using Overleaf. Save money with Overleaf group and company-wide subscriptions. Request more information.'
    case 'FOMO':
      return 'Why do Fortune 500 companies and top research institutions trust Overleaf to streamline their collaboration? Get in touch to learn more.'
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
