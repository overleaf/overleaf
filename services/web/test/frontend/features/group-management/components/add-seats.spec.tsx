import AddSeats, {
  MAX_NUMBER_OF_USERS,
  MAX_NUMBER_OF_PO_NUMBER_CHARACTERS,
} from '@/features/group-management/components/add-seats/add-seats'
import { SplitTestProvider } from '@/shared/context/split-test-context'
import { cloneDeep } from 'lodash'

describe('<AddSeats />', function () {
  beforeEach(function () {
    this.totalLicenses = 5

    cy.window().then(win => {
      win.metaAttributesCache.set('ol-groupName', 'My Awesome Team')
      win.metaAttributesCache.set('ol-subscriptionId', '123')
      win.metaAttributesCache.set('ol-totalLicenses', this.totalLicenses)
      win.metaAttributesCache.set('ol-isProfessional', false)
      win.metaAttributesCache.set('ol-isCollectionMethodManual', true)
    })

    cy.mount(
      <SplitTestProvider>
        <AddSeats />
      </SplitTestProvider>
    )

    cy.findByRole('button', { name: /buy licenses/i })
    cy.findByTestId('add-more-users-group-form')
  })

  it('renders the back button', function () {
    cy.findByTestId('group-heading').within(() => {
      cy.findByRole('link', { name: /back to subscription/i }).should(
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

  it('shows the "Buy more licenses" label', function () {
    cy.findByText(/buy more licenses/i)
  })

  it('shows the maximum supported users', function () {
    cy.findByText(
      new RegExp(
        `your current plan supports up to ${this.totalLicenses} licenses`,
        'i'
      )
    )
  })

  it('shows instructions on how to reduce licenses on a plan', function () {
    cy.contains(
      /if you want to reduce the number of licenses on your plan, please contact customer support/i
    ).within(() => {
      cy.findByRole('link', { name: /contact customer support/i }).should(
        'have.attr',
        'href',
        '/contact'
      )
    })
  })

  it('renders the cancel button', function () {
    cy.findByRole('link', { name: /cancel/i }).should(
      'have.attr',
      'href',
      '/user/subscription'
    )
  })

  describe('PO number', function () {
    it('should not render the PO checkbox and PO input if collection method is not manual', function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-isCollectionMethodManual', false)
      })
      cy.mount(
        <SplitTestProvider>
          <AddSeats />
        </SplitTestProvider>
      )

      cy.findByLabelText(/i want to add a po number/i).should('not.exist')
      cy.findByLabelText(/^po number$/i).should('not.exist')
    })

    it('should check the PO checkbox in order to activate the PO input field', function () {
      cy.findByLabelText(/^po number$/i).should('not.exist')
      cy.findByLabelText(/i want to add a po number/i).check()
      cy.findByLabelText(/^po number$/i)
    })

    describe('validation', function () {
      beforeEach(function () {
        cy.findByLabelText(/i want to add a po number/i).check()
      })

      it('should show max characters error', function () {
        const totalCharacters = 'a'.repeat(
          MAX_NUMBER_OF_PO_NUMBER_CHARACTERS + 1
        )
        cy.findByLabelText(/^po number$/i).type(totalCharacters)
        cy.findByText(
          new RegExp(
            `po number must not exceed ${MAX_NUMBER_OF_PO_NUMBER_CHARACTERS} characters`,
            'i'
          )
        )
      })

      it('should show letters and numbers only error', function () {
        cy.findByLabelText(/^po number$/i).type('🚧')
        cy.findByText(/po number can include digits and letters only/i)
      })
    })
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

      cy.mount(
        <SplitTestProvider>
          <AddSeats />
        </SplitTestProvider>
      )

      cy.findByRole('link', { name: /upgrade my plan/i }).should('not.exist')
    })
  })

  describe('cost summary', function () {
    beforeEach(function () {
      cy.findByLabelText(/how many licenses do you want to buy/i).as('input')
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
            /enter the number of licenses you’d like to add to see the cost breakdown/i
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
        cy.findByRole('button', { name: /buy licenses/i }).should('not.exist')
        cy.findByRole('button', { name: /send request/i }).as('sendRequestBtn')
      })

      it('renders a notification', function () {
        cy.findByTestId('cost-summary').should('not.exist')
        cy.findByRole('alert').should(
          'contain.text',
          `If you want more than ${MAX_NUMBER_OF_USERS} licenses on your plan, we need to add them for you. Just click Send request below and we’ll be happy to help.`
        )
      })

      describe('request', function () {
        afterEach(function () {
          cy.findByRole('link', { name: /go to subscriptions/i }).should(
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
          netTerms: 30,
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

        cy.findByRole('button', { name: /buy licenses/i }).as('addUsersBtn')
        cy.findByRole('button', { name: /send request/i }).should('not.exist')
      })

      function makeRequest(body: object, inputValue: string) {
        cy.intercept('POST', '/user/subscription/group/add-users/preview', {
          statusCode: 200,
          body,
        }).as('addUsersRequest')
        cy.get('@input').type(inputValue)
      }

      it('renders common preview data content', function () {
        makeRequest(this.body, this.adding.toString())
        cy.findByTestId('cost-summary').within(() => {
          cy.contains(
            new RegExp(
              `you’re adding ${this.adding} licenses to your plan giving you a total of ${this.body.change.addOn.quantity} licenses`,
              'i'
            )
          )

          cy.findByTestId('plan').within(() => {
            cy.findByText(
              `${this.body.nextInvoice.plan.name} x ${this.adding} Licenses`
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
            cy.findByTestId('price').should(
              'have.text',
              `$${this.body.immediateCharge.total}.00`
            )
          })

          cy.findByText(
            /after that, we’ll bill you \$1,000\.00 \(\$895\.00 \+ \$105\.00 tax\) annually on December 1, unless you cancel/i
          )
        })
      })

      it('renders the preview data with manually billed subscription', function () {
        makeRequest(this.body, this.adding.toString())
        cy.findByTestId('cost-summary').within(() => {
          cy.findByTestId('total').within(() => {
            cy.findByText(
              new RegExp(`total due in ${this.body.netTerms} days`, 'i')
            )
          })
        })
        cy.findByText(
          new RegExp(
            `we’ll invoice you now for the additional licences based on the remaining months of your current subscription, and payment will be due in ${this.body.netTerms} days`,
            'i'
          )
        )
      })

      it('renders the preview data with automatically billed subscription', function () {
        cy.window().then(win => {
          win.metaAttributesCache.set('ol-isCollectionMethodManual', false)
        })
        cy.mount(
          <SplitTestProvider>
            <AddSeats />
          </SplitTestProvider>
        )
        makeRequest(this.body, this.adding.toString())
        cy.findByTestId('cost-summary').within(() => {
          cy.findByTestId('total').within(() => {
            cy.findByText(/total due today/i)
          })
        })
        cy.findByText(
          /we’ll charge you now for the cost of your additional licenses based on the remaining months of your current subscription/i
        )
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

      it('handles double digit numbers of licenses gracefully', function () {
        const { promise, resolve } = Promise.withResolvers<void>()
        const body = cloneDeep(this.body)
        cy.intercept(
          'POST',
          '/user/subscription/group/add-users/preview',
          async req => {
            await promise
            // make the response reflect back whatever quantity was sent in the request
            // we don't really care about the rest of the body for this test
            const { adding } = req.body
            body.change.addOn.quantity = body.change.addOn.prevQuantity + adding
            req.reply({
              statusCode: 200,
              body,
            })
          }
        ).as('addUsersRequest')

        cy.get('@input').type('1')
        cy.get('@input').type('2')
        resolve()

        cy.findByTestId('adding-licenses-summary').within(() => {
          cy.findByText((_, el) =>
            Boolean(
              el?.textContent?.includes(
                'You’re adding 12 licenses to your plan giving you a total of 17 licenses'
              )
            )
          )
        })
      })

      describe('request', function () {
        afterEach(function () {
          cy.findByRole('link', { name: /go to subscriptions/i }).should(
            'have.attr',
            'href',
            '/user/subscription'
          )
        })

        function makeRequest(statusCode: number, adding: string) {
          const PO_NUMBER = 'PO123456789'
          cy.intercept('POST', '/user/subscription/group/add-users/create', {
            statusCode,
          }).as('addUsersRequest')
          cy.get('@input').type(adding)
          cy.findByLabelText(/i want to add a po number/i).check()
          cy.findByLabelText(/^po number$/i).type(PO_NUMBER)
          cy.get('@addUsersBtn').click()

          const body = {
            adding: Number(adding),
            poNumber: PO_NUMBER,
          }
          cy.get('@addUsersRequest')
            .its('request.body')
            .should('deep.equal', body)
            .and('have.keys', Object.keys(body))
          cy.findByTestId('add-more-users-group-form').should('not.exist')
        }

        it('sends a request that succeeds', function () {
          makeRequest(204, this.adding.toString())
          cy.findByTestId('title').should(
            'contain.text',
            'You’ve added more license(s)'
          )
          cy.findByText(/you’ve added more license\(s\) to your subscription/i)
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
