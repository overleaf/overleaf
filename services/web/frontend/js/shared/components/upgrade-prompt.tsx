import OLBadge from '@/features/ui/components/ol/ol-badge'
import OLButton from '@/features/ui/components/ol/ol-button'
import OLCloseButton from '@/features/ui/components/ol/ol-close-button'
import OLCol from '@/features/ui/components/ol/ol-col'
import OLRow from '@/features/ui/components/ol/ol-row'
import MaterialIcon from '@/shared/components/material-icon'
import { PropsWithChildren } from 'react'
import { Container } from 'react-bootstrap-5'
import { Trans, useTranslation } from 'react-i18next'

type IconListItemProps = PropsWithChildren<{
  icon: string
}>

function IconListItem({ icon, children }: IconListItemProps) {
  return (
    <li className="d-flex align-items-center">
      <div className="flex-shrink-0">
        <MaterialIcon type={icon} />
      </div>
      <div className="flex-grow-1 ms-2">{children}</div>
    </li>
  )
}

type PlansLinkProps = {
  itmCampaign: string
  onClick?: React.MouseEventHandler<HTMLAnchorElement>
}
function PlansLink({
  children,
  itmCampaign,
  onClick,
}: PropsWithChildren<PlansLinkProps>) {
  return (
    <a
      key="compare_plans_link"
      href={`/user/subscription/choose-your-plan?itm-campaign=${itmCampaign}`}
      target="_blank"
      rel="noreferrer"
      onClick={onClick}
    >
      {children}
      <MaterialIcon type="open_in_new" />
    </a>
  )
}

type UpgradePromptProps = {
  title: string
  summary: string
  onClose: () => void
  planPricing: { student: string; standard: string }
  itmCampaign: string
  isStudent?: boolean
  onClickInfoLink?: React.MouseEventHandler<HTMLAnchorElement>
  onClickPaywall?: React.MouseEventHandler<HTMLAnchorElement>
}

export function UpgradePrompt({
  title,
  summary,
  onClose,
  planPricing,
  itmCampaign,
  isStudent = false,
  onClickInfoLink,
  onClickPaywall,
}: UpgradePromptProps) {
  const { t } = useTranslation()
  const planPrice = isStudent ? planPricing.student : planPricing.standard
  const planCode = isStudent
    ? 'student_free_trial_7_days'
    : 'collaborator_free_trial_7_days'

  return (
    <Container className="upgrade-prompt">
      <OLRow className="justify-content-end">
        <OLCloseButton onClick={() => onClose()} />
      </OLRow>
      <OLRow className="text-center">
        <h2 className="my-0 upgrade-prompt-title">{title}</h2>
        <p className="upgrade-prompt-summary">{summary}</p>
      </OLRow>
      <OLRow className="g-3">
        <OLCol md={6} className="upgrade-prompt-card-container">
          <div className="g-0 upgrade-prompt-card upgrade-prompt-card-premium">
            <OLRow className="justify-content-between">
              <OLCol>
                <h3>{isStudent ? t('student') : t('standard')}</h3>
              </OLCol>
              <OLCol xs="auto">
                <OLBadge className="badge-premium-gradient">
                  {t('recommended')}
                </OLBadge>
              </OLCol>
            </OLRow>
            <OLRow>
              <p className="upgrade-prompt-price">
                <span className="upgrade-prompt-price-number">{planPrice}</span>{' '}
                {t('per_month')}
              </p>
            </OLRow>
            <OLRow>
              <ul className="upgrade-prompt-list">
                <IconListItem icon="hourglass_top">
                  {t('12x_more_compile_time')}
                </IconListItem>
                <IconListItem icon="group_add">
                  {t('collabs_per_proj', { collabcount: isStudent ? 6 : 10 })}
                </IconListItem>
                <IconListItem icon="history">
                  {t('unlimited_document_history')}
                </IconListItem>
              </ul>
            </OLRow>
            <OLRow className="mt-auto">
              <a
                className="btn btn-premium"
                href={`/user/subscription/new?planCode=${planCode}&itm-campaign=${itmCampaign}`}
                onClick={onClickPaywall}
                target="_blank"
                rel="noreferrer"
              >
                {t('try_for_free')}
              </a>
            </OLRow>
          </div>
        </OLCol>
        <OLCol md={6} className="upgrade-prompt-card-container">
          <div className="g-0 upgrade-prompt-card upgrade-prompt-card-free">
            <OLRow>
              <h3>{t('free')}</h3>
            </OLRow>
            <OLRow>
              <p className="upgrade-prompt-price">
                {/* Invisible span here to hold the correct height to match a card with a price */}
                <span className="upgrade-prompt-price-number invisible" />
                {t('your_current_plan')}
              </p>
            </OLRow>
            <OLRow>
              <ul className="upgrade-prompt-list">
                <IconListItem icon="hourglass_bottom">
                  {t('basic_compile_time')}
                </IconListItem>
                <IconListItem icon="person">
                  {t('collabs_per_proj_single', { collabcount: 1 })}
                </IconListItem>
                <IconListItem icon="history_off">
                  {t('limited_document_history')}
                </IconListItem>
              </ul>
            </OLRow>
            <OLRow className="mt-auto">
              <OLButton variant="secondary" onClick={() => onClose()}>
                {t('continue_with_free_plan')}
              </OLButton>
            </OLRow>
          </div>
        </OLCol>
      </OLRow>
      <OLRow className="text-center">
        <p className="upgrade-prompt-all-plans">
          {/* eslint-disable react/jsx-key */}
          <Trans
            i18nKey="compare_all_plans"
            components={[
              <PlansLink onClick={onClickInfoLink} itmCampaign={itmCampaign} />,
            ]}
          />
          {/* eslint-disable react/jsx-key */}
        </p>
      </OLRow>
    </Container>
  )
}
