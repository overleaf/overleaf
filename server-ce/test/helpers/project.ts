import { login } from './login'
import { openEmail } from './email'
import { v4 as uuid } from 'uuid'

export function createProject(
  name: string,
  {
    type = 'Blank project',
    newProjectButtonMatcher = /new project/i,
    open = true,
  }: {
    type?: 'Blank project' | 'Example project'
    newProjectButtonMatcher?: RegExp
    open?: boolean
  } = {}
): Cypress.Chainable<string> {
  cy.url().then(url => {
    if (!url.endsWith('/project')) {
      cy.visit('/project')
    }
  })
  const interceptId = uuid()
  let projectId = ''
  if (!open) {
    cy.then(() => {
      // Register intercept just before creating the project, otherwise we might
      // intercept a request from a prior createProject invocation.
      cy.intercept(
        { method: 'GET', url: /\/project\/[a-fA-F0-9]{24}$/, times: 1 },
        req => {
          projectId = req.url.split('/').pop()!
          // Redirect back to the project dashboard, effectively reload the page.
          req.redirect('/project')
        }
      ).as(interceptId)
    })
  }
  cy.findAllByRole('button').contains(newProjectButtonMatcher).click()
  // FIXME: This should only look in the left menu
  // The upgrading tests create projects in older versions of Server Pro which used different casing of the project type. Use case-insensitive match.
  cy.findAllByText(type, { exact: false }).first().click()
  cy.findByRole('dialog').within(() => {
    cy.get('input').type(name)
    cy.findByText('Create').click()
  })
  if (open) {
    cy.url().should('match', /\/project\/[a-fA-F0-9]{24}/)
    waitForMainDocToLoad()
    return cy
      .url()
      .should('match', /\/project\/[a-fA-F0-9]{24}/)
      .then(url => url.split('/').pop())
  } else {
    const alias = `@${interceptId}` // IDEs do not like computed values in cy.wait().
    cy.wait(alias)
    return cy.then(() => projectId)
  }
}

export function openProjectByName(projectName: string) {
  cy.visit('/project')
  cy.findByText(projectName).click()
  waitForMainDocToLoad()
}

export function openProjectById(projectId: string) {
  cy.visit(`/project/${projectId}`)
  waitForMainDocToLoad()
}

export function openProjectViaLinkSharingAsAnon(url: string) {
  cy.visit(url)
  waitForMainDocToLoad()
}

export function openProjectViaLinkSharingAsUser(
  url: string,
  projectName: string,
  email: string
) {
  cy.visit(url)
  cy.findByText(projectName) // wait for lazy loading
  cy.contains(`as ${email}`)
  cy.findByText('OK, join project').click()
  waitForMainDocToLoad()
}

export function openProjectViaInviteNotification(projectName: string) {
  cy.visit('/project')
  cy.findByText(projectName)
    .parent()
    .parent()
    .within(() => {
      cy.findByText('Join Project').click()
    })
  cy.findByText('Open Project').click()
  cy.url().should('match', /\/project\/[a-fA-F0-9]{24}/)
  waitForMainDocToLoad()
}

function shareProjectByEmail(
  projectName: string,
  email: string,
  level: 'Viewer' | 'Editor'
) {
  openProjectByName(projectName)
  cy.findByText('Share').click()
  cy.findByRole('dialog').within(() => {
    cy.findByLabelText('Add email address', { selector: 'input' }).type(
      `${email},`
    )
    cy.findByLabelText('Add email address', { selector: 'input' })
      .parents('form')
      .within(() => {
        cy.findByTestId('add-collaborator-select')
          .click()
          .then(() => {
            cy.findByText(level).click()
          })
      })
    cy.findByText('Invite').click({ force: true })
    cy.findByText('Invite not yet accepted.')
  })
}

export function shareProjectByEmailAndAcceptInviteViaDash(
  projectName: string,
  email: string,
  level: 'Viewer' | 'Editor'
) {
  shareProjectByEmail(projectName, email, level)

  login(email)
  openProjectViaInviteNotification(projectName)
}

export function getSpamSafeProjectName() {
  while (true) {
    // Move from hex/16 to base64/64 possible characters per char in string
    const name = Buffer.from(uuid().replaceAll('-', ''), 'hex')
      .toString('base64')
      .slice(0, 10)
    const nDigits = (name.match(/\d/g) || []).length
    if (nDigits < 6) return name
  }
}

export function shareProjectByEmailAndAcceptInviteViaEmail(
  projectName: string,
  email: string,
  level: 'Viewer' | 'Editor'
) {
  shareProjectByEmail(projectName, email, level)

  login(email)

  openEmail(projectName, frame => {
    frame.contains('View project').then(a => {
      cy.log(
        'bypass target=_blank and navigate current browser tab/cypress-iframe to project invite'
      )
      cy.visit(a.attr('href')!)
    })
  })
  cy.url().should('match', /\/project\/[a-f0-9]+\/invite\/token\/[a-f0-9]+/)
  cy.findByText(/user would like you to join/)
  cy.contains(new RegExp(`You are accepting this invite as ${email}`))
  cy.findByText('Join Project').click()
  waitForMainDocToLoad()
}

export function enableLinkSharing() {
  let linkSharingReadOnly: string
  let linkSharingReadAndWrite: string
  const origin = new URL(Cypress.config().baseUrl!).origin

  waitForMainDocToLoad()

  cy.findByText('Share').click()
  cy.findByText('Turn on link sharing').click()
  cy.findByText('Anyone with this link can view this project')
    .next()
    .should('contain.text', origin + '/read')
    .then(el => {
      linkSharingReadOnly = el.text()
    })
  cy.findByText('Anyone with this link can edit this project')
    .next()
    .should('contain.text', origin + '/')
    .then(el => {
      linkSharingReadAndWrite = el.text()
    })

  return cy.then(() => {
    return { linkSharingReadOnly, linkSharingReadAndWrite }
  })
}

export function waitForMainDocToLoad() {
  cy.log('Wait for main doc to load; it will steal the focus after loading')
  cy.get('.cm-content').should('contain.text', 'Introduction')
}

export function openFile(fileName: string, waitFor: string) {
  // force: The file-tree pane is too narrow to display the full name.
  cy.findByTestId('file-tree').findByText(fileName).click({ force: true })

  // wait until we've switched to the selected file
  cy.findByText('Loading…').should('not.exist')
  cy.findByText(waitFor)
}

export function createNewFile() {
  const fileName = `${uuid()}.tex`

  cy.log('create new project file')
  cy.get('button').contains('New file').click({ force: true })
  cy.findByRole('dialog').within(() => {
    cy.get('input').clear()
    cy.get('input').type(fileName)
    cy.findByText('Create').click()
  })
  // force: The file-tree pane is too narrow to display the full name.
  cy.findByTestId('file-tree').findByText(fileName).click({ force: true })

  // wait until we've switched to the newly created empty file
  cy.findByText('Loading…').should('not.exist')
  cy.get('.cm-line').should('have.length', 1)

  return fileName
}

export function expectFileExists(
  name: string,
  binary: boolean,
  content: string
) {
  cy.findByRole('treeitem', { name }).click()
  if (binary) {
    cy.findByText(content).should('not.have.class', 'cm-line')
  } else {
    cy.findByText(content).should('have.class', 'cm-line')
  }
}

export function prepareFileUploadTest(binary = false) {
  const name = `${uuid()}.txt`
  const content = `Test File Content ${name}${binary ? ' \x00' : ''}`
  cy.get('button').contains('Upload').click({ force: true })
  cy.get('input[type=file]')
    .first()
    .selectFile(
      {
        contents: Cypress.Buffer.from(content),
        fileName: name,
        lastModified: Date.now(),
      },
      { force: true }
    )

  // wait for the upload to finish
  cy.findByRole('treeitem', { name })

  return () => expectFileExists(name, binary, content)
}

export function testNewFileUpload() {
  it('can upload text file', () => {
    const check = prepareFileUploadTest(false)
    check()
  })

  it('can upload binary file', () => {
    const check = prepareFileUploadTest(true)
    check()
  })
}
