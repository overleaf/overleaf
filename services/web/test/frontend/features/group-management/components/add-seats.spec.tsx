import '../../../helpers/bootstrap-5'
import AddSeats, {
  MAX_NUMBER_OF_USERS,
} from '@/features/group-management/components/add-seats/add-seats'

describe('<AddSeats />', function () {
  beforeEach(function () {
    this.totalLicenses = 5

    cy.window().then(win => {
      win.metaAttributesCache.set('ol-groupName', 'My Awesome Team')
      win.metaAttributesCache.set('ol-subscriptionId', '123')
      win.metaAttributesCache.set('ol-totalLicenses', this.totalLicenses)
      win.metaAttributesCache.set('ol-isProfessional', false)
    })

    cy.mount(<AddSeats />)

    cy.findByRole('button', { name: /add users/i })
    cy.findByTestId('add-more-users-group-form')
  })

  it('renders the back button', function () {
    cy.findByTestId('group-heading').within(() => {
      cy.findByRole('button', { name: /back to subscription/i }).should(
        'have.attr',
        'href',
        '/user/subscription'
      )
    })
  })

  it('shows the group name', function () {
    cy.findByTestId('group-heading').within(() => {
      cy.findByRole('heading', { name: 'My Awesome Team' })
    })
  })

  it('shows the "Add more users" label', function () {
    cy.findByText(/add more users/i)
  })

  it('shows the maximum supported users', function () {
    cy.findByText(
      new RegExp(
        `your current plan supports up to ${this.totalLicenses} users`,
        'i'
      )
    )
  })

  it('shows instructions on how to reduce users on a plan', function () {
    cy.contains(
      /if you want to reduce the number of users on your plan, please contact customer support/i
    ).within(() => {
      cy.findByRole('link', { name: /contact customer support/i }).should(
        'have.attr',
        'href',
        '/contact'
      )
    })
  })

  it('renders the cancel button', function () {
    cy.findByRole('button', { name: /cancel/i }).should(
      'have.attr',
      'href',
      '/user/subscription'
    )
  })

  describe('"Upgrade my plan" link', function () {
    it('shows the link', function () {
      cy.findByRole('link', { name: /upgrade my plan/i }).should(
        'have.attr',
        'href',
        '/user/subscription/group/upgrade-subscription'
      )
    })

    it('hides the link', function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-isProfessional', true)
      })

      cy.mount(<AddSeats />)

      cy.findByRole('link', { name: /upgrade my plan/i }).should('not.exist')
    })
  })

  describe('cost summary', function () {
    beforeEach(function () {
      cy.findByLabelText(/how many users do you want to add/i).as('input')
    })

    it('shows the title', function () {
      cy.findByTestId('cost-summary').within(() => {
        cy.findByText(/cost summary/i)
      })
    })

    describe('shows default content when', function () {
      afterEach(function () {
        cy.findByTestId('cost-summary').within(() => {
          cy.findByText(
            /enter the number of users you’d like to add to see the cost breakdown/i
          )
        })
      })

      it('leaves input empty', function () {
        cy.get('@input').should('have.value', '')
      })

      it('fills in a non-numeric value', function () {
        cy.get('@input').type('ab')
        cy.findByText(/value must be a number/i)
      })

      it('fills in a decimal value', function () {
        cy.get('@input').type('1.5')
        cy.findByText(/value must be a whole number/i)
      })

      it('fills in a "0" value', function () {
        cy.get('@input').type('0')
        cy.findByText(/value must be at least 1/i)
      })

      it('fills in a value and clears the input', function () {
        cy.get('@input').type('a{backspace}')
        cy.get('@input').should('have.text', '')
        cy.findByText(/this field is required/i)
      })
    })

    describe('entered more than the maximum allowed number of users', function () {
      beforeEach(function () {
        this.numberOfUsersExceedingMaxLimit = MAX_NUMBER_OF_USERS + 1

        cy.get('@input').type(this.numberOfUsersExceedingMaxLimit.toString())
        cy.findByRole('button', { name: /add users/i }).should('not.exist')
        cy.findByRole('button', { name: /send request/i }).as('sendRequestBtn')
      })

      it('renders a notification', function () {
        cy.findByTestId('cost-summary').should('not.exist')
        cy.findByRole('alert').should(
          'contain.text',
          `If you want more than ${MAX_NUMBER_OF_USERS} users on your plan, we need to add them for you. Just click Send request below and we’ll be happy to help.`
        )
      })

      describe('request', function () {
        afterEach(function () {
          cy.findByRole('button', { name: /go to subscriptions/i }).should(
            'have.attr',
            'href',
            '/user/subscription'
          )
        })

        function makeRequest(statusCode: number, adding: string) {
          cy.intercept(
            'POST',
            '/user/subscription/group/add-users/sales-contact-form',
            {
              statusCode,
            }
          ).as('addUsersRequest')
          cy.get('@sendRequestBtn').click()
          cy.get('@addUsersRequest').its('request.body').should('deep.equal', {
            adding,
          })
          cy.findByTestId('add-more-users-group-form').should('not.exist')
        }

        it('sends a request that succeeds', function () {
          makeRequest(204, this.numberOfUsersExceedingMaxLimit.toString())
          cy.findByTestId('title').should(
            'contain.text',
            'We’ve got your request'
          )
          cy.findByText(/our team will get back to you shortly/i)
        })

        it('sends a request that fails', function () {
          makeRequest(400, this.numberOfUsersExceedingMaxLimit.toString())
          cy.findByTestId('title').should(
            'contain.text',
            'Something went wrong'
          )
          cy.contains(
            /it looks like that didn’t work. You can try again or get in touch with our Support team for more help/i
          ).within(() => {
            cy.findByRole('link', { name: /get in touch/i }).should(
              'have.attr',
              'href',
              '/contact'
            )
          })
        })
      })
    })

    describe('entered less than the maximum allowed number of users', function () {
      beforeEach(function () {
        this.adding = 1
        this.body = {
          change: {
            type: 'add-on-update',
            addOn: {
              code: 'additional-license',
              quantity: this.totalLicenses + this.adding,
              prevQuantity: this.totalLicenses,
            },
          },
          currency: 'USD',
          immediateCharge: {
            subtotal: 100,
            tax: 20,
            total: 120,
            discount: 0,
          },
          nextInvoice: {
            date: '2025-12-01T00:00:00.000Z',
            plan: {
              name: 'Overleaf Standard Group',
              amount: 0,
            },
            subtotal: 895,
            tax: {
              rate: 0.2,
              amount: 105,
            },
            total: 1000,
          },
        }

        cy.findByRole('button', { name: /add users/i }).as('addUsersBtn')
        cy.findByRole('button', { name: /send request/i }).should('not.exist')
      })

      it('renders the preview data', function () {
        cy.intercept('POST', '/user/subscription/group/add-users/preview', {
          statusCode: 200,
          body: this.body,
        }).as('addUsersRequest')
        cy.get('@input').type(this.adding.toString())

        cy.findByTestId('cost-summary').within(() => {
          cy.contains(
            new RegExp(
              `you’re adding ${this.adding} users to your plan giving you a total of ${this.body.change.addOn.quantity} users`,
              'i'
            )
          )

          cy.findByTestId('plan').within(() => {
            cy.findByText(
              `${this.body.nextInvoice.plan.name} x ${this.adding} Seats`
            )
            cy.findByTestId('price').should(
              'have.text',
              `$${this.body.immediateCharge.subtotal}.00`
            )
          })

          cy.findByTestId('tax').within(() => {
            cy.findByText(
              new RegExp(`VAT · ${this.body.nextInvoice.tax.rate * 100}%`, 'i')
            )
            cy.findByTestId('price').should(
              'have.text',
              `$${this.body.immediateCharge.tax}.00`
            )
          })

          cy.findByTestId('discount').should('not.exist')

          cy.findByTestId('total').within(() => {
            cy.findByText(/total due today/i)
            cy.findByTestId('price').should(
              'have.text',
              `$${this.body.immediateCharge.total}.00`
            )
          })

          cy.findByText(
            /we’ll charge you now for the cost of your additional users based on the remaining months of your current subscription/i
          )
          cy.findByText(
            /after that, we’ll bill you \$1,000\.00 \(\$895\.00 \+ \$105\.00 tax\) annually on December 1, unless you cancel/i
          )
        })
      })

      it('renders the preview data with discount', function () {
        this.body.immediateCharge.discount = 50

        cy.intercept('POST', '/user/subscription/group/add-users/preview', {
          statusCode: 200,
          body: this.body,
        }).as('addUsersRequest')
        cy.get('@input').type(this.adding.toString())

        cy.findByTestId('cost-summary').within(() => {
          cy.findByTestId('discount').within(() => {
            cy.findByText(`($${this.body.immediateCharge.discount}.00)`)
          })

          cy.findByText(
            /This does not include your current discounts, which will be applied automatically before your next payment/i
          )
        })
      })

      describe('request', function () {
        afterEach(function () {
          cy.findByRole('button', { name: /go to subscriptions/i }).should(
            'have.attr',
            'href',
            '/user/subscription'
          )
        })

        function makeRequest(statusCode: number, adding: string) {
          cy.intercept('POST', '/user/subscription/group/add-users/create', {
            statusCode,
          }).as('addUsersRequest')
          cy.get('@input').type(adding)
          cy.get('@addUsersBtn').click()
          cy.get('@addUsersRequest')
            .its('request.body')
            .should('deep.equal', {
              adding: Number(adding),
            })
          cy.findByTestId('add-more-users-group-form').should('not.exist')
        }

        it('sends a request that succeeds', function () {
          makeRequest(204, this.adding.toString())
          cy.findByTestId('title').should(
            'contain.text',
            'You’ve added more user(s)'
          )
          cy.findByText(/you’ve added more user\(s\) to your subscription/i)
          cy.findByRole('link', { name: /invite people/i }).should(
            'have.attr',
            'href',
            '/manage/groups/123/members'
          )
        })

        it('sends a request that fails', function () {
          makeRequest(400, this.adding.toString())
          cy.findByTestId('title').should(
            'contain.text',
            'Something went wrong'
          )
          cy.contains(
            /it looks like that didn’t work. You can try again or get in touch with our Support team for more help/i
          ).within(() => {
            cy.findByRole('link', { name: /get in touch/i }).should(
              'have.attr',
              'href',
              '/contact'
            )
          })
        })
      })
    })
  })
})
