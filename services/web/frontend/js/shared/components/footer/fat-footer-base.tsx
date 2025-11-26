import React from 'react'
import { useTranslation } from 'react-i18next'
import LanguagePicker from '../language-picker'

type FooterLinkProps = {
  href: string
  children: React.ReactNode
}

function FatFooterBase() {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()

  return (
    <div className="fat-footer-base">
      <div className="fat-footer-base-section fat-footer-base-meta">
        <div className="fat-footer-base-item">
          <div className="fat-footer-base-copyright" translate="no">
            © {currentYear} Lemma
          </div>
          <FooterBaseLink href="/legal">
            {t('privacy_and_terms')}
          </FooterBaseLink>
        </div>
        <div className="fat-footer-base-item fat-footer-base-language">
          <LanguagePicker showHeader={false} />
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

export default FatFooterBase
