import React from 'react'
import { useTranslation } from 'react-i18next'
import LanguagePicker from '../language-picker'
import FacebookLogo from '@/shared/svgs/facebook-logo'
import LinkedInLogo from '@/shared/svgs/linkedin-logo'
import XLogo from '@/shared/svgs/x-logo'
import classNames from 'classnames'

type FooterLinkProps = {
  href: string
  children: React.ReactNode
}

type SocialMediaLinkProps = {
  href: string
  icon: React.ReactNode
  className: string
  accessibilityLabel: string
}

function FatFooterBase() {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()

  return (
    <div className="fat-footer-base">
      <div className="fat-footer-base-section fat-footer-base-meta">
        <div className="fat-footer-base-item">
          <div className="fat-footer-base-copyright" translate="no">
            © {currentYear} Overleaf
          </div>
          <FooterBaseLink href="/legal">
            {t('privacy_and_terms')}
          </FooterBaseLink>
          <FooterBaseLink href="https://www.digital-science.com/security-certifications/">
            {t('compliance')}
          </FooterBaseLink>
        </div>
        <div className="fat-footer-base-item fat-footer-base-language">
          <LanguagePicker showHeader={false} />
        </div>
      </div>
      <div className="fat-footer-base-section fat-footer-base-social">
        <div className="fat-footer-base-item">
          <SocialMediaLink
            href="https://x.com/overleaf"
            icon={<XLogo />}
            className="x-logo"
            accessibilityLabel={t('app_on_x', { social: 'X' })}
          />
          <SocialMediaLink
            href="https://www.facebook.com/overleaf.editor"
            icon={<FacebookLogo />}
            className="facebook-logo"
            accessibilityLabel={t('app_on_x', { social: 'Facebook' })}
          />
          <SocialMediaLink
            href="https://www.linkedin.com/company/writelatex-limited"
            icon={<LinkedInLogo />}
            className="linkedin-logo"
            accessibilityLabel={t('app_on_x', { social: 'LinkedIn' })}
          />
        </div>
      </div>
    </div>
  )
}

function FooterBaseLink({ href, children }: FooterLinkProps) {
  return (
    <a className="fat-footer-link" href={href}>
      {children}
    </a>
  )
}

function SocialMediaLink({
  href,
  icon,
  className,
  accessibilityLabel,
}: SocialMediaLinkProps) {
  return (
    <a className={classNames('fat-footer-social', className)} href={href}>
      {icon}
      <span className="visually-hidden">{accessibilityLabel}</span>
    </a>
  )
}

export default FatFooterBase
