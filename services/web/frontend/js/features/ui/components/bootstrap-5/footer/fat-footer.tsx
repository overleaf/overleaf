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
        { href: 'https://digitalscience.pinpointhq.com/', label: t('careers') },
        { href: '/blog', label: t('blog') },
      ],
    },
    {
      title: t('Solutions'),
      links: [
        { href: '/for/enterprises', label: t('for_business') },
        { href: '/for/universities', label: t('for_universities') },
        { href: '/for/government', label: t('for_government') },
        { href: '/for/publishers', label: t('for_publishers') },
        { href: '/about/customer-stories', label: t('customer_stories') },
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
      title: t('Pricing'),
      links: [
        {
          href: '/user/subscription/plans?itm_referrer=footer-for-indv',
          label: t('for_individuals'),
        },
        {
          href: '/user/subscription/plans?plan=group&itm_referrer=footer-for-groups',
          label: t('for_groups_and_organizations'),
        },
        {
          href: '/user/subscription/plans?itm_referrer=footer-for-students#student-annual',
          label: t('for_students'),
        },
      ],
    },
    {
      title: t('Get Involved'),
      links: [
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
        { href: '/learn', label: t('Documentation') },
        { href: '/contact', label: t('footer_contact_us') },
        { href: 'https://status.overleaf.com/', label: t('website_status') },
      ],
    },
  ]

  return (
    <footer className="fat-footer hidden-print">
      <div className="fat-footer-container">
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
