import React from 'react'
import { useTranslation } from 'react-i18next'
import FatFooterBase from './fat-footer-base'

type FooterLinkProps = {
  href: string
  label: string
}

type FooterSectionProps = {
  title: string
  links: FooterLinkProps[]
}

function FatFooter() {
  const { t } = useTranslation()
  const hideFatFooter = false

  const sections = [
    {
      title: t('About'),
      links: [
        { href: '/about', label: t('footer_about_us') },
        { href: '/about/values', label: t('our_values') },
        { href: '/about/careers', label: t('careers') },
        { href: '/for/press', label: t('press_and_awards') },
        { href: '/blog', label: t('blog') },
      ],
    },
    {
      title: t('Learn'),
      links: [
        {
          href: '/learn/latex/Learn_LaTeX_in_30_minutes',
          label: t('latex_in_thirty_minutes'),
        },
        { href: '/latex/templates', label: t('templates') },
        { href: '/events/webinars', label: t('webinars') },
        { href: '/learn/latex/Tutorials', label: t('tutorials') },
        {
          href: '/learn/latex/Inserting_Images',
          label: t('how_to_insert_images'),
        },
        { href: '/learn/latex/Tables', label: t('how_to_create_tables') },
      ],
    },
    {
      title: t('Plans and Pricing'),
      links: [
        {
          href: '/learn/how-to/Overleaf_premium_features',
          label: t('premium_features'),
        },
        {
          href: '/user/subscription/plans?itm_referrer=footer-for-indv-groups',
          label: t('for_individuals_and_groups'),
        },
        { href: '/for/enterprises', label: t('for_enterprise') },
        { href: '/for/universities', label: t('for_universities') },
        {
          href: '/user/subscription/plans?itm_referrer=footer-for-students#student-annual',
          label: t('for_students'),
        },
        { href: '/for/government', label: t('for_government') },
      ],
    },
    {
      title: t('Get Involved'),
      links: [
        { href: '/for/community/advisors', label: t('become_an_advisor') },
        {
          href: 'https://forms.gle/67PSpN1bLnjGCmPQ9',
          label: t('let_us_know_what_you_think'),
        },
        { href: '/beta/participate', label: t('join_beta_program') },
      ],
    },
    {
      title: t('Help'),
      links: [
        { href: '/about/why-latex', label: t('why_latex') },
        { href: '/learn', label: t('Documentation') },
        { href: '/contact', label: t('footer_contact_us') },
        { href: 'https://status.overleaf.com/', label: t('website_status') },
      ],
    },
  ]

  return (
    <footer className="fat-footer hidden-print">
      <div
        role="navigation"
        aria-label={t('footer_navigation')}
        className="fat-footer-container"
      >
        <div className={`fat-footer-sections ${hideFatFooter ? 'hidden' : ''}`}>
          <div className="footer-section" id="footer-brand">
            <a href="/" aria-label={t('overleaf')} className="footer-brand">
              <span className="visually-hidden">{t('overleaf')}</span>
            </a>
          </div>

          {sections.map(section => (
            <div className="footer-section" key={section.title}>
              <FooterSection title={section.title} links={section.links} />
            </div>
          ))}
        </div>

        <FatFooterBase />
      </div>
    </footer>
  )
}

function FooterSection({ title, links }: FooterSectionProps) {
  const { t } = useTranslation()

  return (
    <>
      <h2 className="footer-section-heading">{t(title)}</h2>
      <ul className="list-unstyled">
        {links.map(link => (
          <li key={link.href}>
            <a href={link.href}>{t(link.label)}</a>
          </li>
        ))}
      </ul>
    </>
  )
}

export default FatFooter
