import { useProjectListContext } from '../context/project-list-context'
import { useTranslation } from 'react-i18next'
import CurrentPlanWidget from './current-plan-widget/current-plan-widget'
import NewProjectButton from './new-project-button'
import ProjectListTable from './table/project-list-table'
import UserNotifications from './notifications/user-notifications'
import SearchForm from './search-form'
import ProjectsDropdown from './dropdown/projects-dropdown'
import SortByDropdown from './dropdown/sort-by-dropdown'
import ProjectTools from './table/project-tools/project-tools'
import ProjectListTitle from './title/project-list-title'
import LoadMore from './load-more'
import OLCol from '@/features/ui/components/ol/ol-col'
import OLRow from '@/features/ui/components/ol/ol-row'
import { TableContainer } from '@/features/ui/components/bootstrap-5/table'
import DashApiError from '@/features/project-list/components/dash-api-error'
import getMeta from '@/utils/meta'
import DefaultNavbar from '@/features/ui/components/bootstrap-5/navbar/default-navbar'
import FatFooter from '@/features/ui/components/bootstrap-5/footer/fat-footer'
import SidebarDsNav from '@/features/project-list/components/sidebar/sidebar-ds-nav'
import SystemMessages from '@/shared/components/system-messages'

export function ProjectListDsNav() {
  const navbarProps = getMeta('ol-navbar')
  const { t } = useTranslation()
  const {
    error,
    searchText,
    setSearchText,
    selectedProjects,
    filter,
    tags,
    selectedTagId,
  } = useProjectListContext()

  const selectedTag = tags.find(tag => tag._id === selectedTagId)

  const tableTopArea = (
    <div className="pt-2 pb-3 d-md-none d-flex gap-2">
      <NewProjectButton
        id="new-project-button-projects-table"
        showAddAffiliationWidget
      />
      <SearchForm
        inputValue={searchText}
        setInputValue={setSearchText}
        filter={filter}
        selectedTag={selectedTag}
        className="overflow-hidden flex-grow-1"
      />
    </div>
  )

  return (
    <div className="project-ds-nav-page website-redesign">
      <DefaultNavbar
        {...navbarProps}
        customLogo="/img/ol-brand/overleaf-a-ds-solution-mallard.svg"
        showCloseIcon
      />
      <main className="project-list-wrapper">
        <SidebarDsNav />
        <div className="project-ds-nav-content-and-messages">
          <div className="project-ds-nav-content">
            <div className="project-ds-nav-main">
              {error ? <DashApiError /> : ''}
              <UserNotifications />
              <div className="project-list-header-row">
                <ProjectListTitle
                  filter={filter}
                  selectedTag={selectedTag}
                  selectedTagId={selectedTagId}
                  className="text-truncate d-none d-md-block"
                />
                <div className="project-tools">
                  <div className="d-none d-md-block">
                    {selectedProjects.length === 0 ? (
                      <CurrentPlanWidget />
                    ) : (
                      <ProjectTools />
                    )}
                  </div>
                  <div className="d-md-none">
                    <CurrentPlanWidget />
                  </div>
                </div>
              </div>
              <div className="project-ds-nav-project-list">
                <OLRow className="d-none d-md-block">
                  <OLCol lg={7}>
                    <SearchForm
                      inputValue={searchText}
                      setInputValue={setSearchText}
                      filter={filter}
                      selectedTag={selectedTag}
                    />
                  </OLCol>
                </OLRow>
                <div className="project-list-sidebar-survey-wrapper d-md-none">
                  {/* Omit the survey card in mobile view for now */}
                </div>
                <div className="mt-1 d-md-none">
                  <div
                    role="toolbar"
                    className="projects-toolbar"
                    aria-label={t('projects')}
                  >
                    <ProjectsDropdown />
                    <SortByDropdown />
                  </div>
                </div>
                <div className="mt-3">
                  <TableContainer bordered>
                    {tableTopArea}
                    <ProjectListTable />
                  </TableContainer>
                </div>
                <div className="mt-3">
                  <LoadMore />
                </div>
              </div>
            </div>
            <FatFooter />
          </div>
          <div>
            <SystemMessages />
          </div>
        </div>
      </main>
    </div>
  )
}
