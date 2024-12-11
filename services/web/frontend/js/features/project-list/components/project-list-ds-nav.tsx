import getMeta from '@/utils/meta'
import DefaultNavbar from '@/features/ui/components/bootstrap-5/navbar/default-navbar'
import FatFooter from '@/features/ui/components/bootstrap-5/footer/fat-footer'
import NewProjectButton from '@/features/project-list/components/new-project-button'
import CurrentPlanWidget from '@/features/project-list/components/current-plan-widget/current-plan-widget'
import ProjectTools from '@/features/project-list/components/table/project-tools/project-tools'
import { useProjectListContext } from '@/features/project-list/context/project-list-context'
import SearchForm from '@/features/project-list/components/search-form'
import { TableContainer } from '@/features/ui/components/bootstrap-5/table'
import ProjectListTable from '@/features/project-list/components/table/project-list-table'
import SidebarDsNav from '@/features/project-list/components/sidebar/sidebar-ds-nav'

export function ProjectListDsNav() {
  const navbarProps = getMeta('ol-navbar')
  const footerProps = getMeta('ol-footer')
  const {
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
        items={navbarProps.items.filter(item => item.text !== 'help')}
        customLogo="/img/ol-brand/overleaf-a-ds-solution-mallard.svg"
        showAccountButtons={false}
      />
      <main className="project-ds-nav-sidebar-and-content">
        <SidebarDsNav />
        <div className="project-ds-nav-content">
          <div>Notifications and search and stuff</div>
          <div className="project-ds-nav-project-list">
            {selectedProjects.length === 0 ? (
              <CurrentPlanWidget />
            ) : (
              <ProjectTools />
            )}

            <SearchForm
              inputValue={searchText}
              setInputValue={setSearchText}
              filter={filter}
              selectedTag={selectedTag}
              className="overflow-hidden flex-grow-1"
            />

            <TableContainer bordered>
              {tableTopArea}
              <ProjectListTable />
            </TableContainer>
          </div>
          <FatFooter {...footerProps} />
        </div>
      </main>
    </div>
  )
}
