import { isExcludedBySharding, startWith } from './helpers/config'
import {
  activateUser,
  createMongoUser,
  ensureUserExists,
  login,
} from './helpers/login'
import { v4 as uuid } from 'uuid'
import { createProject } from './helpers/project'
import { beforeWithReRunOnTestRetry } from './helpers/beforeWithReRunOnTestRetry'
import { openEmail } from './helpers/email'

describe('admin panel', function () {
  function registrationTests() {
    it('via GUI and opening URL manually', function () {
      const user = `${uuid()}@example.com`
      cy.findByLabelText('Emails to register new users').type(user + '{enter}')

      cy.findByRole('cell', { name: /\/user\/activate/ }).then($td => {
        const url = $td.text().trim()
        activateUser(url)
      })
    })

    it('via GUI and email', function () {
      const user = `${uuid()}@example.com`
      cy.findByLabelText('Emails to register new users').type(user + '{enter}')

      let url: string
      cy.findByRole('cell', { name: /\/user\/activate/ }).then($td => {
        url = $td.text().trim()
      })

      cy.then(() => {
        openEmail(
          'Activate your E2E test Account',
          (frame, { url }) => {
            frame.contains('a', 'Set password').then(el => {
              expect(el.attr('href')!).to.equal(url)
            })
          },
          { url }
        )
        // Run activateUser in the main origin instead of inside openEmail. See docs on openEmail.
        activateUser(url)
      })
    })
    it('via script and opening URL manually', function () {
      const user = `${uuid()}@example.com`
      let url: string
      cy.then(async () => {
        ;({ url } = await createMongoUser({ email: user }))
      })
      cy.then(() => {
        activateUser(url)
      })
    })
    it('via script and email', function () {
      const user = `${uuid()}@example.com`
      let url: string
      cy.then(async () => {
        ;({ url } = await createMongoUser({ email: user }))
      })
      cy.then(() => {
        openEmail(
          'Activate your E2E test Account',
          (frame, { url }) => {
            frame.contains('a', 'Set password').then(el => {
              expect(el.attr('href')!).to.equal(url)
            })
          },
          { url }
        )
        // Run activateUser in the main origin instead of inside openEmail. See docs on openEmail.
        activateUser(url)
      })
    })
  }

  describe('in CE', function () {
    if (isExcludedBySharding('CE_DEFAULT')) return
    startWith({ pro: false, version: 'latest' })
    const admin = 'admin@example.com'
    const user = `user+${uuid()}@example.com`
    ensureUserExists({ email: admin, isAdmin: true })
    ensureUserExists({ email: user })

    describe('create users', function () {
      beforeEach(function () {
        login(admin)
        cy.visit('/project')
        cy.findByRole('menuitem', { name: 'Admin' }).click()
        cy.findByRole('menuitem', { name: 'Manage Users' }).click()
      })
      registrationTests()
    })
  })

  describe('in server pro', function () {
    const admin = 'admin@example.com'
    const user1 = 'user@example.com'
    const user2 = 'user2@example.com'

    let testProjectName = ''
    let testProjectId = ''
    let deletedProjectName = ''
    let projectToDeleteId = ''

    const findProjectRow = (projectName: string) => {
      cy.log('find project row')
      return cy.findByText(projectName).parent().parent()
    }

    if (isExcludedBySharding('PRO_DEFAULT_2')) return
    startWith({
      pro: true,
    })
    ensureUserExists({ email: admin, isAdmin: true })
    ensureUserExists({ email: user1 })
    ensureUserExists({ email: user2 })

    beforeWithReRunOnTestRetry(() => {
      testProjectName = `project-${uuid()}`
      deletedProjectName = `deleted-project-${uuid()}`
      login(user1)
      createProject(testProjectName, { open: false }).then(
        id => (testProjectId = id)
      )
      createProject(deletedProjectName, { open: false }).then(
        id => (projectToDeleteId = id)
      )
    })

    describe('admin menu items', function () {
      beforeEach(function () {
        login(admin)
        cy.visit('/project')
      })

      it('displays expected admin menu items', function () {
        const menuitems = ['Manage Site', 'Manage Users', 'Project URL Lookup']
        menuitems.forEach(name => {
          cy.findByRole('menuitem', { name: 'Admin' }).click()
          cy.findByRole('menu')
            .findAllByRole('menuitem')
            .should('have.length', menuitems.length)
          cy.findByRole('menu').findByRole('menuitem', { name }).click()
        })
      })
    })

    describe('manage site', function () {
      beforeEach(function () {
        login(admin)
        cy.visit('/project')
        cy.findByRole('menuitem', { name: 'Admin' }).click()
        cy.findByRole('menuitem', { name: 'Manage Site' }).click()
      })

      it('publish and clear admin messages', function () {
        const message = 'Admin Message ' + uuid()

        cy.log('create system message')
        cy.findByRole('tab', { name: 'System Messages' }).click()
        cy.findByLabelText('Message').type(message)
        cy.findByRole('button', { name: 'Post Message' }).click()
        cy.findByText(message)

        login(user1)
        cy.visit('/project')
        cy.findByText(message)

        cy.log('clear system messages')
        login(admin)
        cy.visit('/project')
        cy.findByRole('menuitem', { name: 'Admin' }).click()
        cy.findByRole('menuitem', { name: 'Manage Site' }).click()
        cy.findByRole('tab', { name: 'System Messages' }).click()
        cy.findByRole('button', { name: 'Clear all messages' }).click()

        cy.log('verify system messages are no longer displayed')
        login(user1)
        cy.visit('/project')
        cy.findByText(message).should('not.exist')
      })
    })

    describe('manage users', function () {
      beforeEach(function () {
        login(admin)
        cy.visit('/project')
        cy.findByRole('menuitem', { name: 'Admin' }).click()
        cy.findByRole('menuitem', { name: 'Manage Users' }).click()
      })

      it('displays expected tabs', function () {
        const tabs = ['Users', 'License Usage']
        cy.findAllByRole('tab').should('have.length', tabs.length)
        tabs.forEach(tabName => {
          cy.findByRole('tab', { name: tabName }).click()
        })
      })

      it('license usage tab', function () {
        cy.findByRole('tab', { name: 'License Usage' }).click()
        cy.findByText(
          'An active user is one who has opened a project in this Server Pro instance in the last 12 months.'
        )
      })

      describe('create users', function () {
        beforeEach(function () {
          cy.findByRole('link', { name: 'New User' }).click()
        })
        registrationTests()
      })

      it('user list RegExp search', function () {
        cy.findByLabelText('RegExp').click()
        cy.findByPlaceholderText('Search users by email or id…').type(
          'user[0-9]{enter}'
        )
        cy.findByRole('link', { name: user2 })
        cy.findByRole('link', { name: user1 }).should('not.exist')
      })
    })

    describe('user page', function () {
      beforeEach(function () {
        login(admin)
        cy.visit('/project')
        cy.findByRole('menuitem', { name: 'Admin' }).click()
        cy.findByRole('menuitem', { name: 'Manage Users' }).click()
        cy.findByPlaceholderText('Search users by email or id…').type(
          user1 + '{enter}'
        )
        cy.findByRole('link', { name: user1 }).click()
        cy.url().should('match', /\/admin\/user\/[a-fA-F0-9]{24}/)
      })

      it('displays expected tabs', function () {
        const tabs = [
          'User Info',
          'Projects',
          'Deleted Projects',
          'Audit Log',
          'Sessions',
        ]
        cy.findAllByRole('tab').should('have.length', tabs.length)
        tabs.forEach(tabName => {
          cy.findByRole('tab', { name: tabName }).click()
        })
      })

      describe('user info tab', function () {
        beforeEach(function () {
          cy.findByRole('tab', { name: 'User Info' }).click()
        })

        it('displays required sections', function () {
          // not exhaustive list, checks the tab content is rendered
          cy.findByRole('heading', { name: 'Profile' })
          cy.findByRole('heading', { name: 'Editor Settings' })
        })

        it('should not display SaaS-only sections', function () {
          cy.findByLabelText('Referred User Count').should('not.exist')
          cy.findByRole('heading', { name: /Split Test Assignments/ }).should(
            'not.exist'
          )
          cy.findByRole('heading', { name: 'Experimental Features' }).should(
            'not.exist'
          )
          cy.findByRole('heading', { name: 'Service Integration' }).should(
            'not.exist'
          )
          cy.findByRole('heading', { name: 'SSO Integrations' }).should(
            'not.exist'
          )
          cy.findByRole('heading', { name: 'Security' }).should('not.exist')
        })
      })

      it('transfer project ownership', function () {
        cy.log("access project admin through owners' project list")
        cy.findByRole('tablist').within(() => {
          cy.findByRole('tab', { name: 'Projects' }).click()
        })
        cy.findByRole('link', { name: testProjectName })
          .parent()
          .parent()
          .within(() => {
            cy.findByRole('link', { name: 'Project information' }).click()
          })

        cy.findByRole('button', { name: 'Transfer Ownership' }).click()
        cy.findByRole('dialog').within(() => {
          cy.findByRole('heading', { name: 'Transfer Ownership of Project' })
          cy.findByRole('button', { name: 'Find' }).should('be.disabled')
          cy.findByRole('button', { name: 'Confirm' }).should('be.disabled')
          cy.findByPlaceholderText('User ID or Email').type(user2)
          cy.findByRole('button', { name: 'Find' }).should('not.be.disabled')
          cy.findByRole('button', { name: 'Find' }).click()
          cy.findByText('Transfer project to this user?')
          cy.findByRole('cell', { name: 'ID' })
          cy.findByRole('cell', { name: 'Name' })
          cy.findByRole('cell', { name: 'Email' })
          cy.findByRole('cell', { name: user2 })
          cy.findByRole('button', { name: 'Confirm' }).should('not.be.disabled')
          cy.findByRole('button', { name: 'Confirm' }).click()
        })

        cy.log('check the project is displayed in the new owner projects tab')
        cy.findByPlaceholderText('Search users by email or id…').type(
          user2 + '{enter}'
        )
        cy.findByRole('link', { name: user2 }).click()
        cy.findByRole('tablist').within(() => {
          cy.findByRole('tab', { name: 'Projects' }).click()
        })
        cy.findByRole('link', { name: testProjectName })
          .parent()
          .parent()
          .within(() => {
            cy.findByRole('link', { name: 'Project information' }).click()
          })
      })
    })

    describe('project page', function () {
      beforeEach(function () {
        login(admin)
        cy.visit(`/admin/project/${testProjectId}`)
      })

      it('displays expected tabs', function () {
        const tabs = ['Project Info', 'Deleted Docs', 'Audit Log']
        cy.findAllByRole('tab').should('have.length', tabs.length)
        tabs.forEach(tabName => {
          cy.findByRole('tab', { name: tabName }).click()
        })
      })
    })

    it('restore deleted projects', function () {
      login(user1)
      cy.visit('/project')

      cy.log('select project to delete')
      findProjectRow(deletedProjectName).within(() =>
        cy
          .findByRole('checkbox', { name: `Select ${deletedProjectName}` })
          .first()
          .check()
      )
      cy.log('delete project')
      findProjectRow(deletedProjectName).within(() =>
        cy.findByRole('button', { name: 'Trash' }).click()
      )
      cy.findByRole('button', { name: 'Confirm' }).click()
      cy.findByRole('link', { name: deletedProjectName }).should('not.exist')

      cy.log('navigate to thrashed projects and delete the project')
      cy.findByRole('navigation', {
        name: 'Project categories and tags',
      })
        .findByRole('button', { name: 'Trashed projects' })
        .click()
      findProjectRow(deletedProjectName).within(() =>
        cy.findByRole('button', { name: 'Delete' }).click()
      )
      cy.findByRole('button', { name: 'Confirm' }).click()
      cy.findByRole('link', { name: deletedProjectName }).should('not.exist')

      cy.log('login as an admin and navigate to the deleted project')
      login(admin)
      cy.visit('/admin/user')
      cy.findByPlaceholderText('Search users by email or id…').type(
        user1 + '{enter}'
      )
      cy.findByRole('link', { name: user1 }).click()
      cy.findByRole('tab', { name: 'Deleted Projects' }).click()
      cy.findByRole('link', { name: deletedProjectName }).click()

      cy.log('undelete the project')
      cy.findByRole('button', { name: 'Undelete' }).click()
      cy.findByRole('button', { name: 'Undelete' }).should('not.exist')
      cy.url().should('contain', `/admin/project/${projectToDeleteId}`)

      cy.log('login as the user and verify the project is restored')
      login(user1)
      cy.visit('/project')
      cy.findByRole('navigation', {
        name: 'Project categories and tags',
      })
        .findByRole('button', { name: 'Trashed projects' })
        .click()
      cy.findByRole('link', { name: `${deletedProjectName} (Restored)` })
    })
  })
})
