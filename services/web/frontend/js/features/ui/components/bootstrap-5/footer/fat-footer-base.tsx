import React from 'react'
import { useTranslation } from 'react-i18next'
import LanguagePicker from '../language-picker'
import Icon from '@/shared/components/icon'

type FooterLinkProps = {
  href: string
  children: React.ReactNode
}

type SocialMediaLinkProps = {
  href: string
  icon: string
  accessibilityLabel: string
}

function FatFooterBase() {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()

  return (
    <footer className="fat-footer-base">
      <div className="fat-footer-base-section fat-footer-base-meta">
        <div className="fat-footer-base-item">
          <div className="fat-footer-base-copyright">
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
            href="https://twitter.com/overleaf"
            icon="twitter-square"
            accessibilityLabel={t('app_on_x', { social: 'Twitter' })}
          />
          <SocialMediaLink
            href="https://www.facebook.com/overleaf.editor"
            icon="facebook-square"
            accessibilityLabel={t('app_on_x', { social: 'Facebook' })}
          />
          <SocialMediaLink
            href="https://www.linkedin.com/company/writelatex-limited"
            icon="linkedin-square"
            accessibilityLabel={t('app_on_x', { social: 'LinkedIn' })}
          />
        </div>
      </div>
    </footer>
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
  accessibilityLabel,
}: SocialMediaLinkProps) {
  return (
    <a className="fat-footer-social" href={href}>
      <Icon
        type={icon}
        className="fa"
        accessibilityLabel={accessibilityLabel}
      />
    </a>
  )
}

export default FatFooterBase
