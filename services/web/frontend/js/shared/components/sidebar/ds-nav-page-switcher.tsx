import { useTranslation } from 'react-i18next'
import { BookBookmark, Folder } from '@phosphor-icons/react'
import { useActiveOverallTheme } from '@/shared/hooks/use-active-overall-theme'
import getMeta from '@/utils/meta'
import overleafLogo from '@/shared/svgs/overleaf-a-ds-solution-mallard.svg'
import overleafLogoDark from '@/shared/svgs/overleaf-a-ds-solution-mallard-dark.svg'

type ActivePage = 'library' | 'projects'

export function DsNavPageSwitcher({
  activePage,
  showLogo = true,
  onLibraryClick,
  onProjectsClick,
}: {
  activePage: ActivePage
  showLogo?: boolean
  onLibraryClick?: React.MouseEventHandler
  onProjectsClick?: React.MouseEventHandler
}) {
  const { t } = useTranslation()
  const appName = getMeta('ol-ExposedSettings')?.appName ?? 'Overleaf'
  const activeOverallTheme = useActiveOverallTheme()

  return (
    <>
      {showLogo && (
        <div className="ds-nav-page-switcher-logo">
          <a href="/" aria-label={appName}>
            <img
              src={
                activeOverallTheme === 'dark' ? overleafLogoDark : overleafLogo
              }
              alt="Overleaf, A Digital Science Solution"
              height="59"
              width="130"
            />
          </a>
        </div>
      )}
      <ul
        className={`list-unstyled ds-nav-page-switcher-items${!showLogo ? ' ds-nav-page-switcher-items--no-logo' : ''}`}
      >
        <li>
          <a
            href="/library"
            className={`ds-nav-page-switcher-item${activePage === 'library' ? ' active' : ''}`}
            aria-current={activePage === 'library' ? 'page' : undefined}
            onClick={
              onLibraryClick
                ? e => {
                    e.preventDefault()
                    onLibraryClick(e)
                  }
                : undefined
            }
          >
            <BookBookmark size={24} />
            <span>{t('library')}</span>
          </a>
        </li>
        <li>
          <a
            href="/project"
            className={`ds-nav-page-switcher-item${activePage === 'projects' ? ' active' : ''}`}
            aria-current={activePage === 'projects' ? 'page' : undefined}
            onClick={
              onProjectsClick
                ? e => {
                    e.preventDefault()
                    onProjectsClick(e)
                  }
                : undefined
            }
          >
            <Folder size={24} />
            <span>{t('projects')}</span>
          </a>
        </li>
      </ul>
    </>
  )
}
