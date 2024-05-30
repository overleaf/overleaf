import { runScript } from './hostAdminClient'

const DEFAULT_PASSWORD = 'Passw0rd!'

const createdUsers = new Set<string>()

async function createMongoUser({
  email,
  isAdmin = false,
}: {
  email: string
  isAdmin?: boolean
}) {
  const t0 = Date.now()
  const { stdout } = await runScript({
    cwd: 'services/web',
    script: 'modules/server-ce-scripts/scripts/create-user.js',
    args: [`--email=${email}`, `--admin=${isAdmin}`],
  })
  const [url] = stdout.match(/\/user\/activate\?token=\S+/)!
  const userId = new URL(url, location.origin).searchParams.get('user_id')!
  const signupDate = parseInt(userId.slice(0, 8), 16) * 1000
  if (signupDate < t0) {
    return { url, exists: true }
  }
  return { url, exists: false }
}

export function ensureUserExists({
  email,
  password = DEFAULT_PASSWORD,
  isAdmin = false,
}: {
  email: string
  password?: string
  isAdmin?: boolean
}) {
  let url: string
  let exists: boolean
  before(async function () {
    exists = createdUsers.has(email)
    if (exists) return
    ;({ url, exists } = await createMongoUser({ email, isAdmin }))
  })
  before(function () {
    if (exists) return
    activateUser(url, password)
    cy.then(() => {
      createdUsers.add(email)
    })
  })
}

export function login(username: string, password = DEFAULT_PASSWORD) {
  cy.session([username, password, new Date()], () => {
    cy.visit('/login')
    cy.get('input[name="email"]').type(username)
    cy.get('input[name="password"]').type(password)
    cy.findByRole('button', { name: 'Login' }).click()
    cy.url().should('contain', '/project')
  })
}

export function activateUser(url: string, password = DEFAULT_PASSWORD) {
  cy.session(url, () => {
    cy.visit(url)
    cy.url().then(url => {
      if (url.includes('/login')) return
      cy.url().should('contain', '/user/activate')
      cy.get('input[name="password"]').type(password)
      cy.findByRole('button', { name: 'Activate' }).click()
      cy.url().should('contain', '/project')
    })
  })
}
