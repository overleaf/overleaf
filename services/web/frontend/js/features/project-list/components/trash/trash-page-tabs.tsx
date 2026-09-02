import { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import classnames from 'classnames'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'

export type TrashTab = 'projects' | 'references'

export type TrashPageTab = { key: TrashTab; label: string; href: string }

type TrashPageTabModule = {
  import: { default: (t: TFunction) => TrashPageTab }
  path: string
}

const trashPageTabModules: TrashPageTabModule[] =
  importOverleafModules('trashPageTabs')

function TrashPageTabs({ activeTab }: { activeTab: TrashTab }) {
  const { t } = useTranslation()

  const tabs: TrashPageTab[] = [
    { key: 'projects', label: t('projects'), href: '/project/trashed' },
    ...trashPageTabModules.map(({ import: getTab }) => getTab.default(t)),
  ]

  if (tabs.length < 2) {
    return null
  }

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
