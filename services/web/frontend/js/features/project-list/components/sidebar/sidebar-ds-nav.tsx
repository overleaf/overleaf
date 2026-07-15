import { useTranslation } from 'react-i18next'
import classnames from 'classnames'
import { Trash } from '@phosphor-icons/react'
import NewProjectButton from '../new-project-button'
import SidebarFilters from './sidebar-filters'
import AddAffiliation, { useAddAffiliation } from '../add-affiliation'
import { usePersistedResize } from '@/shared/hooks/use-resize'
import { useScrolled } from '@/features/project-list/components/sidebar/use-scroll'
import { SurveyWidgetDsNav } from '@/features/project-list/components/survey-widget-ds-nav'
import { SidebarLowerSection } from '@/shared/components/sidebar/sidebar-lower-section'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'
import { DsNavPageSwitcher } from '@/shared/components/sidebar/ds-nav-page-switcher'
import { useProjectListContext } from '@/features/project-list/context/project-list-context'

function SidebarDsNav() {
  const { t } = useTranslation()
  const { show: showAddAffiliationWidget } = useAddAffiliation()
  const isLibraryEnabled = isSplitTestEnabled('overleaf-library')
  const { filter, selectedTagId, selectFilter } = useProjectListContext()
  const isTrashActive = selectedTagId === undefined && filter === 'trashed'
  const { mousePos, getHandleProps, getTargetProps } = usePersistedResize({
    name: 'project-sidebar',
  })
  const { containerRef, scrolledUp, scrolledDown } = useScrolled()

  return (
    <div
      className="project-list-sidebar-wrapper-react d-none d-md-flex"
      {...getTargetProps({
        style: {
          ...(mousePos?.x && { flexBasis: `${mousePos.x}px` }),
        },
      })}
    >
      {isLibraryEnabled && (
        <>
          <DsNavPageSwitcher
            activePage={isTrashActive ? undefined : 'projects'}
            showLogo={false}
            onProjectsClick={() => selectFilter('all')}
          />
          <hr className="ds-nav-page-switcher-divider" />
        </>
      )}
      <nav
        className="flex-grow flex-shrink"
        aria-label={t('project_categories_tags')}
      >
        {!isLibraryEnabled && (
          <NewProjectButton
            id="new-project-button-sidebar"
            className={scrolledDown ? 'show-shadow' : undefined}
          />
        )}
        <div
          className="project-list-sidebar-scroll"
          ref={containerRef}
          data-testid="project-list-sidebar-scroll"
        >
          <SidebarFilters />
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
          {isLibraryEnabled && (
            <button
              type="button"
              className={classnames('ds-nav-page-switcher-item', {
                active: isTrashActive,
              })}
              aria-current={isTrashActive ? 'page' : undefined}
              onClick={() => selectFilter('trashed')}
            >
              <Trash size={24} />
              <span>{t('trash')}</span>
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
