import { useTranslation } from 'react-i18next'
import classnames from 'classnames'

export type TrashTab = 'projects' | 'references'

function TrashPageTabs({ activeTab }: { activeTab: TrashTab }) {
  const { t } = useTranslation()

  const tabs: { key: TrashTab; label: string; href: string }[] = [
    { key: 'projects', label: t('projects'), href: '/project/trashed' },
    { key: 'references', label: t('references'), href: '/library/trashed' },
  ]

  return (
    <nav className="trash-page-tabs" aria-label={t('trash')}>
      {tabs.map(tab => {
        const active = tab.key === activeTab
        return (
          <a
            key={tab.key}
            href={tab.href}
            className={classnames('trash-page-tab', { active })}
            aria-current={active ? 'page' : undefined}
          >
            {tab.label}
          </a>
        )
      })}
    </nav>
  )
}

export default TrashPageTabs
