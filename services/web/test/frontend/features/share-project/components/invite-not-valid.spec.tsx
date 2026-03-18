import InviteNotValid from '@/features/share-project/invite-not-valid'

describe('<InviteNotValid />', function () {
  const email = 'test@example.com'

  it('renders the sorry message', function () {
    cy.mount(<InviteNotValid email={email} />)

    cy.findByRole('heading', {
      name: /sorry, this project isn’t available/i,
    })
  })

  it('renders the broken link message', function () {
    cy.mount(<InviteNotValid email={email} />)

    cy.findByText(/the link may be broken or you may not have access rights/i)
  })

  it('renders a back to projects button linking to /project', function () {
    cy.mount(<InviteNotValid email={email} />)

    cy.findByRole('link', { name: /back to my projects/i }).should(
      'have.attr',
      'href',
      '/project'
    )
  })

  it('renders the logged-in email', function () {
    cy.mount(<InviteNotValid email={email} />)

    cy.contains(
      new RegExp(
        `you are currently logged in as ${email}. you might need to log in with a different email address`,
        'i'
      )
    )
  })

  it('does not render the CTA and email when email not provided', function () {
    cy.mount(<InviteNotValid />)

    cy.findByRole('link', { name: /back to my projects/i }).should('not.exist')
    cy.contains(
      new RegExp(
        `you are currently logged in as ${email}. you might need to log in with a different email address`,
        'i'
      )
    ).should('not.exist')
  })
})
