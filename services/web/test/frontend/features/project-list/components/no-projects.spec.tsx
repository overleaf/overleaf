import NoProjects from '@/features/project-list/components/no-projects'
import {
  Filter,
  ProjectListProvider,
} from '@/features/project-list/context/project-list-context'
import { SplitTestProvider } from '@/shared/context/split-test-context'

describe('<NoProjects />', function () {
  beforeEach(function () {
    cy.intercept('post', '/api/project', {
      body: { projects: [], totalSize: 0 },
    })

    cy.window().then(win => {
      win.metaAttributesCache.set('ol-ExposedSettings', {
        isOverleaf: true,
        templateLinks: [],
      })
    })
  })

  const setGroupPlan = () =>
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-usersBestSubscription', {
        type: 'group',
      })
    })

  const setIndividualPlan = () =>
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-usersBestSubscription', {
        type: 'individual',
      })
    })

  const mountNoProjects = (
    activeSection: Filter,
    showNewProjectButton = false
  ) =>
    cy.mount(
      <SplitTestProvider>
        <ProjectListProvider>
          <NoProjects
            activeSection={activeSection}
            showNewProjectButton={showNewProjectButton}
          />
        </ProjectListProvider>
      </SplitTestProvider>
    )

  describe('all projects', function () {
    it('shows the generic empty state', function () {
      mountNoProjects('all')

      cy.findByText('No projects yet').should('be.visible')
      cy.findByText(
        'Projects you own or have access to will appear here.'
      ).should('be.visible')
    })
  })

  describe('your projects', function () {
    it('shows the non-group copy when the user is not on a group plan', function () {
      setIndividualPlan()
      mountNoProjects('owned')

      cy.findByText('No projects yet').should('be.visible')
      cy.findByText('Projects you create will appear here.').should(
        'be.visible'
      )
      cy.findByText(
        'Projects you create across all your workspaces will appear here.'
      ).should('not.exist')
    })

    it('shows the workspaces copy when the user is on a group plan', function () {
      setGroupPlan()
      mountNoProjects('owned')

      cy.findByText('No projects yet').should('be.visible')
      cy.findByText(
        'Projects you create across all your workspaces will appear here.'
      ).should('be.visible')
      cy.findByText('Projects you create will appear here.').should('not.exist')
    })
  })

  describe('shared with you', function () {
    it('shows the non-group copy when the user is not on a group plan', function () {
      setIndividualPlan()
      mountNoProjects('shared')

      cy.findByText('Nothing shared with you yet').should('be.visible')
      cy.findByText(
        'Projects shared with you directly will appear here.'
      ).should('be.visible')
      cy.findByText(
        'Projects shared with you directly, or ones you’ve joined in a shared workspace, will appear here.'
      ).should('not.exist')
    })

    it('shows the workspaces copy when the user is on a group plan', function () {
      setGroupPlan()
      mountNoProjects('shared')

      cy.findByText('Nothing shared with you yet').should('be.visible')
      cy.findByText(
        'Projects shared with you directly, or ones you’ve joined in a shared workspace, will appear here.'
      ).should('be.visible')
      cy.findByText(
        'Projects shared with you directly will appear here.'
      ).should('not.exist')
    })
  })

  describe('archived projects', function () {
    it('shows the archived empty state', function () {
      mountNoProjects('archived')

      cy.findByText('No archived projects').should('be.visible')
      cy.findByText(
        'Projects you archive will appear here. Archiving won’t affect anyone else working on the project.'
      ).should('be.visible')
    })
  })

  describe('trashed projects', function () {
    it('shows the trashed empty state with the restore hint', function () {
      mountNoProjects('trashed')

      cy.findByText('No trashed projects').should('be.visible')
      cy.findByText(/projects you trash will appear here/i).should('be.visible')
      cy.findByText(
        /you can restore or permanently delete them at any time/i
      ).should('be.visible')
    })
  })

  describe('new project button', function () {
    it('shows the button when showNewProjectButton is true', function () {
      mountNoProjects('all', true)

      cy.findByRole('button', { name: 'New project' }).should('be.visible')
    })

    it('hides the button when showNewProjectButton is false', function () {
      mountNoProjects('all', false)

      cy.findByText('No projects yet').should('be.visible')
      cy.findByRole('button', { name: 'New project' }).should('not.exist')
    })
  })
})
