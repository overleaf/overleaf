import { login } from './login'
import { openEmail } from './email'
import { v4 as uuid } from 'uuid'
import { prepareWaitForNextCompileSlot } from './compile'

export const NEW_PROJECT_BUTTON_MATCHER = /new project/i

const NEW_EDITOR_QUERY_PARAMS = ''
const OLD_EDITOR_QUERY_PARAMS = '?old-editor-override=true'

export function redirectEditorUrlWithQueryParams(newEditor: boolean) {
  const queryString = newEditor
    ? NEW_EDITOR_QUERY_PARAMS
    : OLD_EDITOR_QUERY_PARAMS
  cy.intercept(
    { method: 'GET', url: /\/project\/[a-fA-F0-9]{24}$/, times: 1 },
    req => {
      // Intercept redirect and add the query param to use the new editor
      req.redirect(`${req.url}${queryString}`)
    }
  )
}

export function createProject(
  name: string,
  {
    type = 'Blank project',
    newProjectButtonMatcher = NEW_PROJECT_BUTTON_MATCHER,
    open = true,
    newEditor = false,
  }: {
    type?: 'Blank project' | 'Example project'
    newProjectButtonMatcher?: RegExp
    open?: boolean
    newEditor?: boolean
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
          projectId = req.url.split('/').pop()!.split('?')[0]
          // Redirect back to the project dashboard, effectively reload the page.
          req.redirect('/project')
        }
      ).as(interceptId)
    })
  } else {
    redirectEditorUrlWithQueryParams(newEditor)
  }
  cy.findAllByRole('button').contains(newProjectButtonMatcher).click()
  // FIXME: This should only look in the left menu
  // The upgrading tests create projects in older versions of Server Pro which used different casing of the project type. Use case-insensitive match.
  cy.findAllByText(type, { exact: false }).first().click()
  cy.findByRole('dialog').within(() => {
    cy.get('input').type(name)
    cy.findByRole('button', { name: 'Create' }).click()
  })
  if (open) {
    cy.url().should('match', /\/project\/[a-fA-F0-9]{24}/)
    waitForMainDocToLoad()
    return cy
      .url()
      .should('match', /\/project\/[a-fA-F0-9]{24}/)
      .then(url => url.split('/').pop()?.split('?')[0])
  } else {
    const alias = `@${interceptId}` // IDEs do not like computed values in cy.wait().
    cy.wait(alias)
    return cy.then(() => projectId)
  }
}

// TODO ide-redesign-cleanup: Remove this and just use createProject directly
export function createProjectAndOpenInNewEditor(
  projectName: string,
  options: {
    type?: 'Blank project' | 'Example project'
    newProjectButtonMatcher?: RegExp
  } = {}
) {
  return createProject(projectName, { ...options, open: false }).then(
    projectId => {
      // Open the new project in the new editor
      openProjectById(projectId, true)
      return cy.then(() => projectId)
    }
  )
}

export function openProjectByName(projectName: string, newEditor = false) {
  cy.visit('/project')

  redirectEditorUrlWithQueryParams(newEditor)

  cy.findByText(projectName).click()
  waitForMainDocToLoad()

  if (newEditor) {
    // Close the beta intro modal if it appears
    // TODO ide-redesign-cleanup: Remove this when the intro modal is removed
    cy.get('body').type('{esc}')
  }
}

export function openProjectById(projectId: string, newEditor = false) {
  const url = newEditor
    ? `/project/${projectId}${NEW_EDITOR_QUERY_PARAMS}`
    : `/project/${projectId}${OLD_EDITOR_QUERY_PARAMS}`
  cy.visit(url)
  waitForMainDocToLoad()

  if (newEditor) {
    // Close the beta intro modal if it appears
    // TODO ide-redesign-cleanup: Remove this when the intro modal is removed
    cy.get('body').type('{esc}')
  }
}

export function openProjectViaLinkSharingAsAnon(
  url: string,
  newEditor = false
) {
  redirectEditorUrlWithQueryParams(newEditor)
  cy.visit(url)
  waitForMainDocToLoad()

  if (newEditor) {
    // Close the beta intro modal if it appears
    // TODO ide-redesign-cleanup: Remove this when the intro modal is removed
    cy.get('body').type('{esc}')
  }
}

export function openProjectViaLinkSharingAsUser(
  url: string,
  projectName: string,
  email: string,
  newEditor: boolean = false
) {
  cy.visit(url)
  cy.findByText(projectName) // wait for lazy loading
  cy.contains(`as ${email}`)

  redirectEditorUrlWithQueryParams(newEditor)

  cy.findByText('OK, join project').click()
  waitForMainDocToLoad()

  if (newEditor) {
    // Close the beta intro modal if it appears
    // TODO ide-redesign-cleanup: Remove this when the intro modal is removed
    cy.get('body').type('{esc}')
  }
}

export function openProjectViaInviteNotification(
  projectName: string,
  newEditor: boolean = false
) {
  cy.visit('/project')
  cy.findByText(projectName)
    .parent()
    .parent()
    .within(() => {
      cy.findByText('Join Project').click()
    })

  cy.intercept(
    // NOTE: Struggling to work out why but this only seems to work with times: 2.
    // This is temporary code so leaving it for now.
    { method: 'GET', url: /\/project\/[a-fA-F0-9]{24}$/, times: 2 },
    req => {
      const queryString = newEditor
        ? NEW_EDITOR_QUERY_PARAMS
        : OLD_EDITOR_QUERY_PARAMS
      // Intercept redirect and add the query param to use the new editor
      req.redirect(`${req.url}${queryString}`)
    }
  )

  const { waitForCompile } = prepareWaitForNextCompileSlot()
  waitForCompile(() => {
    cy.findByText('Open Project').click()

    cy.url().should('match', /\/project\/[a-fA-F0-9]{24}/)
    waitForMainDocToLoad()

    if (newEditor) {
      // Close the beta intro modal if it appears
      // TODO ide-redesign-cleanup: Remove this when the intro modal is removed
      cy.get('body').type('{esc}')
    }
  })
}

function shareProjectByEmail(
  projectName: string,
  email: string,
  level: 'Viewer' | 'Editor',
  newEditor: boolean = false
) {
  openProjectByName(projectName, newEditor)
  cy.findByRole('button', { name: 'Share' }).click()
  cy.findByRole('dialog').within(() => {
    cy.findByLabelText('Add email address', { selector: 'input' }).type(
      `${email},`
    )
    cy.findByLabelText('Add email address', { selector: 'input' })
      .parents('form')
      .within(() => {
        cy.findByTestId('add-collaborator-select').as('select').click()
        cy.get('@select').then(() => {
          cy.findByRole('option', { name: level }).click()
        })
      })
    cy.findByRole('button', { name: 'Invite' }).click()
    cy.findByText('Invite not yet accepted.')
  })
}

export function shareProjectByEmailAndAcceptInviteViaDash(
  projectName: string,
  email: string,
  level: 'Viewer' | 'Editor',
  newEditor: boolean = false
) {
  shareProjectByEmail(projectName, email, level, newEditor)

  login(email)
  openProjectViaInviteNotification(projectName, newEditor)
}

export function getSpamSafeProjectName() {
  while (true) {
    // Move from hex/16 to base64/64 possible characters per char in string
    const name = Buffer.from(uuid().replaceAll('-', ''), 'hex')
      .toString('base64')
      .replace('/', '_')
      .slice(0, 10)
    const nDigits = (name.match(/\d/g) || []).length
    if (nDigits < 6) return name
  }
}

export function shareProjectByEmailAndAcceptInviteViaEmail(
  projectName: string,
  email: string,
  level: 'Viewer' | 'Editor',
  newEditor: boolean = false
) {
  shareProjectByEmail(projectName, email, level, newEditor)

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

  redirectEditorUrlWithQueryParams(newEditor)

  cy.findByText('Join Project').click()
  waitForMainDocToLoad()

  if (newEditor) {
    // Close the beta intro modal if it appears
    // TODO ide-redesign-cleanup: Remove this when the intro modal is removed
    cy.get('body').type('{esc}')
  }
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
  cy.findByRole('navigation', { name: 'Project files and outline' })
    .findByRole('treeitem', { name: fileName })
    .click({ force: true })

  // wait until we've switched to the selected file
  cy.findByRole('status').should('not.exist')
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
  cy.findByTestId('file-tree')
    .findByRole('treeitem', { name: fileName })
    .click({ force: true })

  // wait until we've switched to the newly created empty file
  cy.findByRole('textbox', { name: 'Source Editor editing' }).within(() => {
    cy.findByRole('status').should('not.exist')
    cy.get('.cm-line').should('have.length', 1)
  })
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
  it('can upload text file', function () {
    const check = prepareFileUploadTest(false)
    check()
  })

  it('can upload binary file', function () {
    const check = prepareFileUploadTest(true)
    check()
  })
}
