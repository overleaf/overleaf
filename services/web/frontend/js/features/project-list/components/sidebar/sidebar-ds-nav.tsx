import { JSXElementConstructor } from 'react'
import { useTranslation } from 'react-i18next'
import classnames from 'classnames'
import { Trash } from '@phosphor-icons/react'
import SidebarFilters from './sidebar-filters'
import AddAffiliation, { useAddAffiliation } from '../add-affiliation'
import { usePersistedResize } from '@/shared/hooks/use-resize'
import { useScrolled } from '@/features/project-list/components/sidebar/use-scroll'
import { SurveyWidgetDsNav } from '@/features/project-list/components/survey-widget-ds-nav'
import { SidebarLowerSection } from '@/shared/components/sidebar/sidebar-lower-section'
import { DsNavOverleafLogo } from '@/shared/components/sidebar/ds-nav-overleaf-logo'
import { useProjectListContext } from '@/features/project-list/context/project-list-context'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'
import { ActivePage } from '../../util/navigation-state'

function SidebarDsNav({
  activePage,
  trashActive = false,
}: {
  activePage: ActivePage

  /**
   * Whether the trash is active. This is only relevant when the active page is
   * "library" as which project page is active is determined by the selected filter.
   */
  trashActive?: boolean
}) {
  const { t } = useTranslation()
  const { show: showAddAffiliationWidget } = useAddAffiliation()
  const { filter, selectedTagId, selectFilter } = useProjectListContext()
  const isTrashActive =
    activePage === 'library'
      ? trashActive
      : selectedTagId === undefined && filter === 'trashed'
  const [dsNavLibraryLinkModule] = importOverleafModules('dsNavLibraryLink')
  const DsNavLibraryLink: JSXElementConstructor<{
    active?: boolean
    inLibrary?: boolean
  }> = dsNavLibraryLinkModule?.import.default
  const { mousePos, getHandleProps, getTargetProps } = usePersistedResize({
    name: 'project-sidebar',
  })
  const { containerRef, scrolledUp } = useScrolled()

  const trashItemClassName = classnames('ds-nav-page-switcher-item', {
    active: isTrashActive,
  })
  const trashItemContent = (
    <>
      <Trash size={20} />
      <span className="ds-nav-page-switcher-item-label">{t('trash')}</span>
    </>
  )

  return (
    <div
      className="project-list-sidebar-wrapper-react d-none d-md-flex"
      {...getTargetProps({
        style: {
          ...(mousePos?.x && { flexBasis: `${mousePos.x}px` }),
        },
      })}
    >
      {(activePage === 'library' || isTrashActive) && <DsNavOverleafLogo />}
      <nav
        className="flex-grow flex-shrink"
        aria-label={t('project_categories_tags')}
      >
        <div
          className="project-list-sidebar-scroll"
          ref={containerRef}
          data-testid="project-list-sidebar-scroll"
        >
          <SidebarFilters activePage={activePage} />
          {showAddAffiliationWidget && <hr />}
          <AddAffiliation />
        </div>
      </nav>
      <div
        className={classnames(
          'ds-nav-sidebar-lower',
          scrolledUp && 'show-shadow'
        )}
      >
        <SidebarLowerSection showThemeToggle>
          {DsNavLibraryLink && (
            <DsNavLibraryLink
              active={activePage === 'library' && !trashActive}
              inLibrary={activePage === 'library'}
            />
          )}
          {/* The trash view defaults to the location the user is navigating from: the
          library trash when on the library, the project trash everywhere else. */}
          {activePage === 'library' ? (
            <a
              href="/library/trashed"
              className={trashItemClassName}
              aria-current={isTrashActive ? 'page' : undefined}
            >
              {trashItemContent}
            </a>
          ) : (
            <button
              type="button"
              className={trashItemClassName}
              aria-current={isTrashActive ? 'page' : undefined}
              onClick={() => selectFilter('trashed')}
            >
              {trashItemContent}
            </button>
          )}
          <div className="project-list-sidebar-survey-wrapper">
            <SurveyWidgetDsNav />
          </div>
        </SidebarLowerSection>
      </div>
      <div
        {...getHandleProps({
          style: {
            position: 'absolute',
            zIndex: 1,
            top: 0,
            right: '-2px',
            height: '100%',
            width: '4px',
          },
        })}
      />
    </div>
  )
}

export default SidebarDsNav
