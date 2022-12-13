import { useCallback, useEffect, useMemo } from 'react'
import Notification from './notification'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import getMeta from '../../../../utils/meta'
import customLocalStorage from '../../../../infrastructure/local-storage'
import { useProjectListContext } from '../../context/project-list-context'
import { Trans, useTranslation } from 'react-i18next'

type GroupsAndEnterpriseBannerVariant =
  | 'default'
  | 'empower'
  | 'save'
  | 'did-you-know'

export default function GroupsAndEnterpriseBanner() {
  const { t } = useTranslation()
  const { totalProjectsCount } = useProjectListContext()
  const showGroupsAndEnterpriseBanner = getMeta(
    'ol-showGroupsAndEnterpriseBanner'
  ) as boolean
  const groupsAndEnterpriseBannerVariant = getMeta(
    'ol-groupsAndEnterpriseBannerVariant'
  ) as GroupsAndEnterpriseBannerVariant

  const eventTrackingSegmentation = useMemo(
    () => ({
      location: 'dashboard-banner-react',
      variant: groupsAndEnterpriseBannerVariant,
      page: '/project',
    }),
    [groupsAndEnterpriseBannerVariant]
  )

  const hasDismissedGroupsAndEnterpriseBanner = customLocalStorage.getItem(
    'has_dismissed_groups_and_enterprise_banner'
  )

  const handleClose = useCallback(() => {
    customLocalStorage.setItem(
      'has_dismissed_groups_and_enterprise_banner',
      true
    )
  }, [])

  const handleClickContact = useCallback(() => {
    eventTracking.sendMB(
      'groups-and-enterprise-banner-click',
      eventTrackingSegmentation
    )
  }, [eventTrackingSegmentation])

  useEffect(() => {
    eventTracking.sendMB(
      'groups-and-enterprise-banner-prompt',
      eventTrackingSegmentation
    )
  }, [eventTrackingSegmentation])

  if (
    totalProjectsCount === 0 ||
    hasDismissedGroupsAndEnterpriseBanner ||
    !showGroupsAndEnterpriseBanner
  ) {
    return null
  }

  // `getText` function has no default switch case since the whole notification
  // should not be rendered if the `groupsAndEnterpriseBannerVariant` is not valid
  if (!isVariantValid(groupsAndEnterpriseBannerVariant)) {
    return null
  }

  // this shouldn't ever happens since the value of `showGroupsAndEnterpriseBanner` should be false
  // if `groupsAndEnterpriseBannerVariant` is 'default'
  // but just adding this check as an extra measure
  if (groupsAndEnterpriseBannerVariant === 'default') {
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
          href="/for/contact-sales"
          target="_blank"
          onClick={handleClickContact}
        >
          {t('contact_sales')}
        </a>
      </Notification.Action>
    </Notification>
  )
}

function isVariantValid(variant: GroupsAndEnterpriseBannerVariant) {
  return (
    variant === 'empower' || variant === 'save' || variant === 'did-you-know'
  )
}

function getText(variant: GroupsAndEnterpriseBannerVariant) {
  switch (variant) {
    case 'empower':
      return <Trans i18nKey="empower_your_organization_to_work_in_overleaf" />
    case 'save':
      return (
        <Trans
          i18nKey="save_money_groups_companies_research_organizations_can_save_money"
          components={
            /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
            [<strong />]
          }
        />
      )
    case 'did-you-know':
      return <Trans i18nKey="did_you_know_that_overleaf_offers" />
  }
}
