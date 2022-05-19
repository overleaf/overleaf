const SandboxedModule = require('sandboxed-module')
const { expect } = require('chai')
const modulePath =
  '../../../../app/src/Features/Subscription/SubscriptionHelper'

const plans = {
  expensive: {
    planCode: 'expensive',
    price_in_cents: 1500,
  },
  cheaper: {
    planCode: 'cheaper',
    price_in_cents: 500,
  },
  alsoCheap: {
    plancode: 'also-cheap',
    price_in_cents: 500,
  },
  expensiveGroup: {
    plancode: 'group_expensive',
    price_in_cents: 49500,
    groupPlan: true,
  },
  cheapGroup: {
    plancode: 'group_cheap',
    price_in_cents: 1000,
    groupPlan: true,
  },
  bad: {},
}

describe('SubscriptionHelper', function () {
  beforeEach(function () {
    this.INITIAL_LICENSE_SIZE = 2
    this.mockCollaboratorPrice = 2000
    this.mockProfessionalPrice = 4000
    this.settings = {
      groupPlanModalOptions: {
        currencySymbols: {
          USD: '$',
          CHF: 'Fr',
          DKK: 'kr',
          NOK: 'kr',
          SEK: 'kr',
        },
      },
    }
    this.GroupPlansData = {
      enterprise: {
        collaborator: {
          USD: {
            [this.INITIAL_LICENSE_SIZE]: {
              price_in_cents: this.mockCollaboratorPrice,
            },
          },
          CHF: {
            [this.INITIAL_LICENSE_SIZE]: {
              price_in_cents: this.mockCollaboratorPrice,
            },
          },
          DKK: {
            [this.INITIAL_LICENSE_SIZE]: {
              price_in_cents: this.mockCollaboratorPrice,
            },
          },
          NOK: {
            [this.INITIAL_LICENSE_SIZE]: {
              price_in_cents: this.mockCollaboratorPrice,
            },
          },
          SEK: {
            [this.INITIAL_LICENSE_SIZE]: {
              price_in_cents: this.mockCollaboratorPrice,
            },
          },
        },
        professional: {
          USD: {
            [this.INITIAL_LICENSE_SIZE]: {
              price_in_cents: this.mockProfessionalPrice,
            },
          },
          CHF: {
            [this.INITIAL_LICENSE_SIZE]: {
              price_in_cents: this.mockProfessionalPrice,
            },
          },
          DKK: {
            [this.INITIAL_LICENSE_SIZE]: {
              price_in_cents: this.mockProfessionalPrice,
            },
          },
          NOK: {
            [this.INITIAL_LICENSE_SIZE]: {
              price_in_cents: this.mockProfessionalPrice,
            },
          },
          SEK: {
            [this.INITIAL_LICENSE_SIZE]: {
              price_in_cents: this.mockProfessionalPrice,
            },
          },
        },
      },
    }
    this.SubscriptionHelper = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': this.settings,
        './GroupPlansData': this.GroupPlansData,
      },
    })
  })

  describe('shouldPlanChangeAtTermEnd', function () {
    it('should return true if the new plan is less expensive', function () {
      const changeAtTermEnd = this.SubscriptionHelper.shouldPlanChangeAtTermEnd(
        plans.expensive,
        plans.cheaper
      )
      expect(changeAtTermEnd).to.be.true
    })
    it('should return false if the new plan is more exepensive', function () {
      const changeAtTermEnd = this.SubscriptionHelper.shouldPlanChangeAtTermEnd(
        plans.cheaper,
        plans.expensive
      )
      expect(changeAtTermEnd).to.be.false
    })
    it('should return false if the new plan is the same price', function () {
      const changeAtTermEnd = this.SubscriptionHelper.shouldPlanChangeAtTermEnd(
        plans.cheaper,
        plans.alsoCheap
      )
      expect(changeAtTermEnd).to.be.false
    })
    it('should return false if the change is from an individual plan to a more expensive group plan', function () {
      const changeAtTermEnd = this.SubscriptionHelper.shouldPlanChangeAtTermEnd(
        plans.expensive,
        plans.expensiveGroup
      )
      expect(changeAtTermEnd).to.be.false
    })
    it('should return true if the change is from an individual plan to a cheaper group plan', function () {
      const changeAtTermEnd = this.SubscriptionHelper.shouldPlanChangeAtTermEnd(
        plans.expensive,
        plans.cheapGroup
      )
      expect(changeAtTermEnd).to.be.true
    })
  })

  describe('generateInitialLocalizedGroupPrice', function () {
    describe('collaborator plan', function () {
      beforeEach(function () {
        this.plan = 'collaborator'
      })

      describe('for CHF currency', function () {
        beforeEach(function () {
          this.mockRecommendedCurrency = 'CHF'
          this.recommendedCurrencySymbol =
            this.settings.groupPlanModalOptions.currencySymbols[
              this.mockRecommendedCurrency
            ]
          this.expectedPrice =
            this.GroupPlansData.enterprise[this.plan][
              this.mockRecommendedCurrency
            ][this.INITIAL_LICENSE_SIZE].price_in_cents / 100
        })

        it('should return the correct localized price', function () {
          const expectedLocalizedPrice = `${this.recommendedCurrencySymbol} ${this.expectedPrice}`
          const {
            price: { collaborator },
          } = this.SubscriptionHelper.generateInitialLocalizedGroupPrice(
            this.mockRecommendedCurrency
          )
          expect(collaborator).to.be.equal(expectedLocalizedPrice)
        })

        it('should return the correct localized price per user', function () {
          const expectedPricePerUser =
            this.expectedPrice / this.INITIAL_LICENSE_SIZE
          const expectedLocalizedPricePerUser = `${this.recommendedCurrencySymbol} ${expectedPricePerUser}`
          const {
            pricePerUser: { collaborator },
          } = this.SubscriptionHelper.generateInitialLocalizedGroupPrice(
            this.mockRecommendedCurrency
          )
          expect(collaborator).to.be.equal(expectedLocalizedPricePerUser)
        })
      })

      describe('for DKK currency', function () {
        beforeEach(function () {
          this.mockRecommendedCurrency = 'DKK'
          this.recommendedCurrencySymbol =
            this.settings.groupPlanModalOptions.currencySymbols[
              this.mockRecommendedCurrency
            ]
          this.expectedPrice =
            this.GroupPlansData.enterprise[this.plan][
              this.mockRecommendedCurrency
            ][this.INITIAL_LICENSE_SIZE].price_in_cents / 100
        })

        it('should return the correct localized price', function () {
          const expectedLocalizedPrice = `${this.expectedPrice} ${this.recommendedCurrencySymbol}`
          const {
            price: { collaborator },
          } = this.SubscriptionHelper.generateInitialLocalizedGroupPrice(
            this.mockRecommendedCurrency
          )
          expect(collaborator).to.be.equal(expectedLocalizedPrice)
        })

        it('should return the correct localized price per user', function () {
          const expectedPricePerUser =
            this.expectedPrice / this.INITIAL_LICENSE_SIZE
          const expectedLocalizedPricePerUser = `${expectedPricePerUser} ${this.recommendedCurrencySymbol}`
          const {
            pricePerUser: { collaborator },
          } = this.SubscriptionHelper.generateInitialLocalizedGroupPrice(
            this.mockRecommendedCurrency
          )
          expect(collaborator).to.be.equal(expectedLocalizedPricePerUser)
        })
      })

      describe('for SEK currency', function () {
        beforeEach(function () {
          this.mockRecommendedCurrency = 'SEK'
          this.recommendedCurrencySymbol =
            this.settings.groupPlanModalOptions.currencySymbols[
              this.mockRecommendedCurrency
            ]
          this.expectedPrice =
            this.GroupPlansData.enterprise[this.plan][
              this.mockRecommendedCurrency
            ][this.INITIAL_LICENSE_SIZE].price_in_cents / 100
        })

        it('should return the correct localized price', function () {
          const expectedLocalizedPrice = `${this.expectedPrice} ${this.recommendedCurrencySymbol}`
          const {
            price: { collaborator },
          } = this.SubscriptionHelper.generateInitialLocalizedGroupPrice(
            this.mockRecommendedCurrency
          )
          expect(collaborator).to.be.equal(expectedLocalizedPrice)
        })

        it('should return the correct localized price per user', function () {
          const expectedPricePerUser =
            this.expectedPrice / this.INITIAL_LICENSE_SIZE
          const expectedLocalizedPricePerUser = `${expectedPricePerUser} ${this.recommendedCurrencySymbol}`
          const {
            pricePerUser: { collaborator },
          } = this.SubscriptionHelper.generateInitialLocalizedGroupPrice(
            this.mockRecommendedCurrency
          )
          expect(collaborator).to.be.equal(expectedLocalizedPricePerUser)
        })
      })

      describe('for NOK currency', function () {
        beforeEach(function () {
          this.mockRecommendedCurrency = 'NOK'
          this.recommendedCurrencySymbol =
            this.settings.groupPlanModalOptions.currencySymbols[
              this.mockRecommendedCurrency
            ]
          this.expectedPrice =
            this.GroupPlansData.enterprise[this.plan][
              this.mockRecommendedCurrency
            ][this.INITIAL_LICENSE_SIZE].price_in_cents / 100
        })

        it('should return the correct localized price', function () {
          const expectedLocalizedPrice = `${this.expectedPrice} ${this.recommendedCurrencySymbol}`
          const {
            price: { collaborator },
          } = this.SubscriptionHelper.generateInitialLocalizedGroupPrice(
            this.mockRecommendedCurrency
          )
          expect(collaborator).to.be.equal(expectedLocalizedPrice)
        })

        it('should return the correct localized price per user', function () {
          const expectedPricePerUser =
            this.expectedPrice / this.INITIAL_LICENSE_SIZE
          const expectedLocalizedPricePerUser = `${expectedPricePerUser} ${this.recommendedCurrencySymbol}`
          const {
            pricePerUser: { collaborator },
          } = this.SubscriptionHelper.generateInitialLocalizedGroupPrice(
            this.mockRecommendedCurrency
          )
          expect(collaborator).to.be.equal(expectedLocalizedPricePerUser)
        })
      })

      describe('for other supported currencies', function () {
        beforeEach(function () {
          this.mockRecommendedCurrency = 'USD'
          this.recommendedCurrencySymbol =
            this.settings.groupPlanModalOptions.currencySymbols[
              this.mockRecommendedCurrency
            ]
          this.expectedPrice =
            this.GroupPlansData.enterprise[this.plan][
              this.mockRecommendedCurrency
            ][this.INITIAL_LICENSE_SIZE].price_in_cents / 100
        })

        it('should return the correct localized price', function () {
          const expectedLocalizedPrice = `${this.recommendedCurrencySymbol}${this.expectedPrice}`
          const {
            price: { collaborator },
          } = this.SubscriptionHelper.generateInitialLocalizedGroupPrice(
            this.mockRecommendedCurrency
          )
          expect(collaborator).to.be.equal(expectedLocalizedPrice)
        })

        it('should return the correct localized price per user', function () {
          const expectedPricePerUser =
            this.expectedPrice / this.INITIAL_LICENSE_SIZE
          const expectedLocalizedPricePerUser = `${this.recommendedCurrencySymbol}${expectedPricePerUser}`
          const {
            pricePerUser: { collaborator },
          } = this.SubscriptionHelper.generateInitialLocalizedGroupPrice(
            this.mockRecommendedCurrency
          )
          expect(collaborator).to.be.equal(expectedLocalizedPricePerUser)
        })
      })
    })

    describe('professional plan plan', function () {
      beforeEach(function () {
        this.plan = 'professional'
      })

      describe('for CHF currency', function () {
        beforeEach(function () {
          this.mockRecommendedCurrency = 'CHF'
          this.recommendedCurrencySymbol =
            this.settings.groupPlanModalOptions.currencySymbols[
              this.mockRecommendedCurrency
            ]
          this.expectedPrice =
            this.GroupPlansData.enterprise[this.plan][
              this.mockRecommendedCurrency
            ][this.INITIAL_LICENSE_SIZE].price_in_cents / 100
        })

        it('should return the correct localized price', function () {
          const expectedLocalizedPrice = `${this.recommendedCurrencySymbol} ${this.expectedPrice}`
          const {
            price: { professional },
          } = this.SubscriptionHelper.generateInitialLocalizedGroupPrice(
            this.mockRecommendedCurrency
          )
          expect(professional).to.be.equal(expectedLocalizedPrice)
        })

        it('should return the correct localized price per user', function () {
          const expectedPricePerUser =
            this.expectedPrice / this.INITIAL_LICENSE_SIZE
          const expectedLocalizedPricePerUser = `${this.recommendedCurrencySymbol} ${expectedPricePerUser}`
          const {
            pricePerUser: { professional },
          } = this.SubscriptionHelper.generateInitialLocalizedGroupPrice(
            this.mockRecommendedCurrency
          )
          expect(professional).to.be.equal(expectedLocalizedPricePerUser)
        })
      })

      describe('for DKK currency', function () {
        beforeEach(function () {
          this.mockRecommendedCurrency = 'DKK'
          this.recommendedCurrencySymbol =
            this.settings.groupPlanModalOptions.currencySymbols[
              this.mockRecommendedCurrency
            ]
          this.expectedPrice =
            this.GroupPlansData.enterprise[this.plan][
              this.mockRecommendedCurrency
            ][this.INITIAL_LICENSE_SIZE].price_in_cents / 100
        })

        it('should return the correct localized price', function () {
          const expectedLocalizedPrice = `${this.expectedPrice} ${this.recommendedCurrencySymbol}`
          const {
            price: { professional },
          } = this.SubscriptionHelper.generateInitialLocalizedGroupPrice(
            this.mockRecommendedCurrency
          )
          expect(professional).to.be.equal(expectedLocalizedPrice)
        })

        it('should return the correct localized price per user', function () {
          const expectedPricePerUser =
            this.expectedPrice / this.INITIAL_LICENSE_SIZE
          const expectedLocalizedPricePerUser = `${expectedPricePerUser} ${this.recommendedCurrencySymbol}`
          const {
            pricePerUser: { professional },
          } = this.SubscriptionHelper.generateInitialLocalizedGroupPrice(
            this.mockRecommendedCurrency
          )
          expect(professional).to.be.equal(expectedLocalizedPricePerUser)
        })
      })

      describe('for SEK currency', function () {
        beforeEach(function () {
          this.mockRecommendedCurrency = 'SEK'
          this.recommendedCurrencySymbol =
            this.settings.groupPlanModalOptions.currencySymbols[
              this.mockRecommendedCurrency
            ]
          this.expectedPrice =
            this.GroupPlansData.enterprise[this.plan][
              this.mockRecommendedCurrency
            ][this.INITIAL_LICENSE_SIZE].price_in_cents / 100
        })

        it('should return the correct localized price', function () {
          const expectedLocalizedPrice = `${this.expectedPrice} ${this.recommendedCurrencySymbol}`
          const {
            price: { professional },
          } = this.SubscriptionHelper.generateInitialLocalizedGroupPrice(
            this.mockRecommendedCurrency
          )
          expect(professional).to.be.equal(expectedLocalizedPrice)
        })

        it('should return the correct localized price per user', function () {
          const expectedPricePerUser =
            this.expectedPrice / this.INITIAL_LICENSE_SIZE
          const expectedLocalizedPricePerUser = `${expectedPricePerUser} ${this.recommendedCurrencySymbol}`
          const {
            pricePerUser: { professional },
          } = this.SubscriptionHelper.generateInitialLocalizedGroupPrice(
            this.mockRecommendedCurrency
          )
          expect(professional).to.be.equal(expectedLocalizedPricePerUser)
        })
      })

      describe('for NOK currency', function () {
        beforeEach(function () {
          this.mockRecommendedCurrency = 'NOK'
          this.recommendedCurrencySymbol =
            this.settings.groupPlanModalOptions.currencySymbols[
              this.mockRecommendedCurrency
            ]
          this.expectedPrice =
            this.GroupPlansData.enterprise[this.plan][
              this.mockRecommendedCurrency
            ][this.INITIAL_LICENSE_SIZE].price_in_cents / 100
        })

        it('should return the correct localized price', function () {
          const expectedLocalizedPrice = `${this.expectedPrice} ${this.recommendedCurrencySymbol}`
          const {
            price: { professional },
          } = this.SubscriptionHelper.generateInitialLocalizedGroupPrice(
            this.mockRecommendedCurrency
          )
          expect(professional).to.be.equal(expectedLocalizedPrice)
        })

        it('should return the correct localized price per user', function () {
          const expectedPricePerUser =
            this.expectedPrice / this.INITIAL_LICENSE_SIZE
          const expectedLocalizedPricePerUser = `${expectedPricePerUser} ${this.recommendedCurrencySymbol}`
          const {
            pricePerUser: { professional },
          } = this.SubscriptionHelper.generateInitialLocalizedGroupPrice(
            this.mockRecommendedCurrency
          )
          expect(professional).to.be.equal(expectedLocalizedPricePerUser)
        })
      })

      describe('for other supported currencies', function () {
        beforeEach(function () {
          this.mockRecommendedCurrency = 'USD'
          this.recommendedCurrencySymbol =
            this.settings.groupPlanModalOptions.currencySymbols[
              this.mockRecommendedCurrency
            ]
          this.expectedPrice =
            this.GroupPlansData.enterprise[this.plan][
              this.mockRecommendedCurrency
            ][this.INITIAL_LICENSE_SIZE].price_in_cents / 100
        })

        it('should return the correct localized price', function () {
          const expectedLocalizedPrice = `${this.recommendedCurrencySymbol}${this.expectedPrice}`
          const {
            price: { professional },
          } = this.SubscriptionHelper.generateInitialLocalizedGroupPrice(
            this.mockRecommendedCurrency
          )
          expect(professional).to.be.equal(expectedLocalizedPrice)
        })

        it('should return the correct localized price per user', function () {
          const expectedPricePerUser =
            this.expectedPrice / this.INITIAL_LICENSE_SIZE
          const expectedLocalizedPricePerUser = `${this.recommendedCurrencySymbol}${expectedPricePerUser}`
          const {
            pricePerUser: { professional },
          } = this.SubscriptionHelper.generateInitialLocalizedGroupPrice(
            this.mockRecommendedCurrency
          )
          expect(professional).to.be.equal(expectedLocalizedPricePerUser)
        })
      })
    })
  })
})
