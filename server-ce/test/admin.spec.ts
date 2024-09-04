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
    it('via GUI and opening URL manually', () => {
      const user = `${uuid()}@example.com`
      cy.get('input[name="email"]').type(user + '{enter}')

      cy.get('td')
        .contains(/\/user\/activate/)
        .then($td => {
          const url = $td.text().trim()
          activateUser(url)
        })
    })

    it('via GUI and email', () => {
      const user = `${uuid()}@example.com`
      cy.get('input[name="email"]').type(user + '{enter}')

      let url: string
      cy.get('td')
        .contains(/\/user\/activate/)
        .then($td => {
          url = $td.text().trim()
        })

      cy.then(() => {
        openEmail(
          'Activate your Overleaf Community Edition Account',
          (frame, { url }) => {
            frame.contains('Set password').then(el => {
              expect(el.attr('href')!).to.equal(url)
            })
          },
          { url }
        )
        // Run activateUser in the main origin instead of inside openEmail. See docs on openEmail.
        activateUser(url)
      })
    })
    it('via script and opening URL manually', () => {
      const user = `${uuid()}@example.com`
      let url: string
      cy.then(async () => {
        ;({ url } = await createMongoUser({ email: user }))
      })
      cy.then(() => {
        activateUser(url)
      })
    })
    it('via script and email', () => {
      const user = `${uuid()}@example.com`
      let url: string
      cy.then(async () => {
        ;({ url } = await createMongoUser({ email: user }))
      })
      cy.then(() => {
        openEmail(
          'Activate your Overleaf Community Edition Account',
          (frame, { url }) => {
            frame.contains('Set password').then(el => {
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

  describe('in CE', () => {
    if (isExcludedBySharding('CE_DEFAULT')) return
    startWith({ pro: false, version: 'latest' })
    const admin = 'admin@example.com'
    const user = `user+${uuid()}@example.com`
    ensureUserExists({ email: admin, isAdmin: true })
    ensureUserExists({ email: user })

    describe('create users', () => {
      beforeEach(() => {
        login(admin)
        cy.visit('/project')
        cy.get('nav').findByText('Admin').click()
        cy.get('nav').findByText('Manage Users').click()
      })
      registrationTests()
    })
  })

  describe('in server pro', () => {
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
      cy.visit('/project')
      createProject(testProjectName).then(id => (testProjectId = id))
      cy.visit('/project')
      createProject(deletedProjectName).then(id => (projectToDeleteId = id))
    })

    describe('manage site', () => {
      beforeEach(() => {
        login(admin)
        cy.visit('/project')
        cy.get('nav').findByText('Admin').click()
        cy.get('nav').findByText('Manage Site').click()
      })

      it('publish and clear admin messages', () => {
        const message = 'Admin Message ' + uuid()

        cy.log('create system message')
        cy.get('[role="tab"]').contains('System Messages').click()
        cy.get('input[name="content"]').type(message)
        cy.get('button').contains('Post Message').click()
        cy.findByText(message)

        login(user1)
        cy.visit('/project')
        cy.findByText(message)

        cy.log('clear system messages')
        login(admin)
        cy.visit('/project')
        cy.get('nav').findByText('Admin').click()
        cy.get('nav').findByText('Manage Site').click()
        cy.get('[role="tab"]').contains('System Messages').click()
        cy.get('button').contains('Clear all messages').click()

        cy.log('verify system messages are no longer displayed')
        login(user1)
        cy.visit('/project')
        cy.findByText(message).should('not.exist')
      })
    })

    describe('manage users', () => {
      beforeEach(() => {
        login(admin)
        cy.visit('/project')
        cy.get('nav').findByText('Admin').click()
        cy.get('nav').findByText('Manage Users').click()
      })

      describe('create users', () => {
        beforeEach(() => {
          cy.get('a').contains('New User').click()
        })
        registrationTests()
      })

      it('user list RegExp search', () => {
        cy.get('input[name="isRegExpSearch"]').click()
        cy.get('input[name="email"]').type('user[0-9]{enter}')
        cy.findByText(user2)
        cy.findByText(user1).should('not.exist')
      })
    })

    describe('user page', () => {
      beforeEach(() => {
        login(admin)
        cy.visit('/project')
        cy.get('nav').findByText('Admin').click()
        cy.get('nav').findByText('Manage Users').click()
        cy.get('input[name="email"]').type(user1 + '{enter}')
        cy.findByText(user1).click()
        cy.url().should('match', /\/admin\/user\/[a-fA-F0-9]{24}/)
      })

      it('displays expected tabs', () => {
        const tabs = [
          'User Info',
          'Projects',
          'Deleted Projects',
          'Audit Log',
          'Sessions',
        ]
        cy.get('[role="tab"]').each((el, index) => {
          cy.wrap(el).findByText(tabs[index]).click()
        })
        cy.get('[role="tab"]').should('have.length', tabs.length)
      })

      describe('user info tab', () => {
        beforeEach(() => {
          cy.get('[role="tab"]').contains('User Info').click()
        })

        it('displays required sections', () => {
          // not exhaustive list, checks the tab content is rendered
          cy.findByText('Profile')
          cy.findByText('Editor Settings')
        })

        it('should not display SaaS-only sections', () => {
          cy.findByText('Referred User Count').should('not.exist')
          cy.findByText('Split Test Assignments').should('not.exist')
          cy.findByText('Experimental Features').should('not.exist')
          cy.findByText('Service Integration').should('not.exist')
          cy.findByText('SSO Integrations').should('not.exist')
          cy.findByText('Security').should('not.exist')
        })
      })

      it('transfer project ownership', () => {
        cy.log("access project admin through owners' project list")
        cy.get('[role="tab"]').contains('Projects').click()
        cy.get(`a[href="/admin/project/${testProjectId}"]`).click()

        cy.findByText('Transfer Ownership').click()
        cy.get('button[type="submit"]').should('be.disabled')
        cy.get('input[name="user_id"]').type(user2)
        cy.get('button[type="submit"]').should('not.be.disabled')
        cy.get('button[type="submit"]').click()
        cy.findByText('Transfer project to this user?')
        cy.get('button').contains('Confirm').click()

        cy.log('check the project is displayed in the new owner projects tab')
        cy.get('input[name="email"]').type(user2 + '{enter}')
        cy.findByText(user2).click()
        cy.get('[role="tab"]').contains('Projects').click()
        cy.get(`a[href="/admin/project/${testProjectId}"]`)
      })
    })

    describe('project page', () => {
      beforeEach(() => {
        login(admin)
        cy.visit(`/admin/project/${testProjectId}`)
      })

      it('displays expected tabs', () => {
        const tabs = ['Project Info', 'Deleted Docs', 'Audit Log']
        cy.get('[role="tab"]').each((el, index) => {
          cy.wrap(el).findByText(tabs[index]).click()
        })
        cy.get('[role="tab"]').should('have.length', tabs.length)
      })
    })

    it('restore deleted projects', () => {
      login(user1)
      cy.visit('/project')

      cy.log('select project to delete')
      findProjectRow(deletedProjectName).within(() =>
        cy.get('input[type="checkbox"]').first().check()
      )

      cy.log('delete project')
      findProjectRow(deletedProjectName).within(() =>
        cy.findByRole('button', { name: 'Trash' }).click()
      )
      cy.get('button').contains('Confirm').click()
      cy.findByText(deletedProjectName).should('not.exist')

      cy.log('navigate to thrashed projects and delete the project')
      cy.get('.project-list-sidebar-react').within(() => {
        cy.findByText('Trashed Projects').click()
      })
      findProjectRow(deletedProjectName).within(() =>
        cy.findByRole('button', { name: 'Delete' }).click()
      )
      cy.get('button').contains('Confirm').click()
      cy.findByText(deletedProjectName).should('not.exist')

      cy.log('login as an admin and navigate to the deleted project')
      login(admin)
      cy.visit('/admin/user')
      cy.get('input[name="email"]').type(user1 + '{enter}')
      cy.get('a').contains(user1).click()
      cy.findByText('Deleted Projects').click()
      cy.get('a').contains(deletedProjectName).click()

      cy.log('undelete the project')
      cy.findByText('Undelete').click()
      cy.findByText('Undelete').should('not.exist')
      cy.url().should('contain', `/admin/project/${projectToDeleteId}`)

      cy.log('login as the user and verify the project is restored')
      login(user1)
      cy.visit('/project')
      cy.get('.project-list-sidebar-react').within(() => {
        cy.findByText('Trashed Projects').click()
      })
      cy.findByText(`${deletedProjectName} (Restored)`)
    })
  })
})
