const chai = require('chai')
const SubscriptionFormatters = require('../../../../app/src/Features/Subscription/SubscriptionFormatters')

const { expect } = chai

/*
  Users can select any language we support, regardless of the country where they are located.
  Which mean that any combination of "supported language"-"supported currency" can be displayed
  on the user's screen.

  Users located in the USA visiting https://fr.overleaf.com/user/subscription/plans
  should see amounts in USD (because of their IP address),
  but with French text, number formatting and currency formats (because of language choice).
  (e.g. 1 000,00 $)

  Users located in the France visiting https://www.overleaf.com/user/subscription/plans
  should see amounts in EUR (because of their IP address),
  but with English text, number formatting and currency formats (because of language choice).
  (e.g. €1,000.00)
 */

describe('SubscriptionFormatters.formatPrice', function () {
  describe('en', function () {
    const format = currency => priceInCents =>
      SubscriptionFormatters.formatPriceLocalized(priceInCents, currency)

    describe('USD', function () {
      const formatUSD = format('USD')

      it('should format basic amounts', function () {
        expect(formatUSD(0)).to.equal('$0.00')
        expect(formatUSD(1234)).to.equal('$12.34')
      })

      it('should format thousand separators', function () {
        expect(formatUSD(100_000)).to.equal('$1,000.00')
        expect(formatUSD(9_876_543_210)).to.equal('$98,765,432.10')
      })

      it('should format negative amounts', function () {
        expect(formatUSD(-1)).to.equal('-$0.01')
        expect(formatUSD(-1234)).to.equal('-$12.34')
      })
    })

    describe('EUR', function () {
      const formatEUR = format('EUR')

      it('should format basic amounts', function () {
        expect(formatEUR(0)).to.equal('€0.00')
        expect(formatEUR(1234)).to.equal('€12.34')
      })

      it('should format thousand separators', function () {
        expect(formatEUR(100_000)).to.equal('€1,000.00')
        expect(formatEUR(9_876_543_210)).to.equal('€98,765,432.10')
      })

      it('should format negative amounts', function () {
        expect(formatEUR(-1)).to.equal('-€0.01')
        expect(formatEUR(-1234)).to.equal('-€12.34')
      })
    })

    describe('HUF', function () {
      const formatHUF = format('HUF')

      it('should format basic amounts', function () {
        expect(formatHUF(0)).to.equal('Ft 0.00')
        expect(formatHUF(1234)).to.equal('Ft 12.34')
      })

      it('should format thousand separators', function () {
        expect(formatHUF(100_000)).to.equal('Ft 1,000.00')
        expect(formatHUF(9_876_543_210)).to.equal('Ft 98,765,432.10')
      })

      it('should format negative amounts', function () {
        expect(formatHUF(-1)).to.equal('-Ft 0.01')
        expect(formatHUF(-1234)).to.equal('-Ft 12.34')
      })
    })

    describe('CLP', function () {
      const formatCLP = format('CLP')

      it('should format basic amounts', function () {
        expect(formatCLP(0)).to.equal('$0')
        expect(formatCLP(1234)).to.equal('$1,234')
      })

      it('should format thousand separators', function () {
        expect(formatCLP(100_000)).to.equal('$100,000')
        expect(formatCLP(9_876_543_210)).to.equal('$9,876,543,210')
      })

      it('should format negative amounts', function () {
        expect(formatCLP(-1)).to.equal('-$1')
        expect(formatCLP(-1234)).to.equal('-$1,234')
      })
    })

    describe('all currencies', function () {
      it('should format 100 "minimal atomic units"', function () {
        const amount = 100

        // "no cents currencies"
        expect(format('CLP')(amount)).to.equal('$100')
        expect(format('JPY')(amount)).to.equal('¥100')
        expect(format('KRW')(amount)).to.equal('₩100')
        expect(format('VND')(amount)).to.equal('₫100')

        // other currencies
        expect(format('AUD')(amount)).to.equal('$1.00')
        expect(format('BRL')(amount)).to.equal('R$1.00')
        expect(format('CAD')(amount)).to.equal('$1.00')
        expect(format('CHF')(amount)).to.equal('CHF 1.00')
        expect(format('CNY')(amount)).to.equal('¥1.00')
        expect(format('COP')(amount)).to.equal('$1.00')
        expect(format('DKK')(amount)).to.equal('kr 1.00')
        expect(format('EUR')(amount)).to.equal('€1.00')
        expect(format('GBP')(amount)).to.equal('£1.00')
        expect(format('HUF')(amount)).to.equal('Ft 1.00')
        expect(format('IDR')(amount)).to.equal('Rp 1.00')
        expect(format('INR')(amount)).to.equal('₹1.00')
        expect(format('MXN')(amount)).to.equal('$1.00')
        expect(format('MYR')(amount)).to.equal('RM 1.00')
        expect(format('NOK')(amount)).to.equal('kr 1.00')
        expect(format('NZD')(amount)).to.equal('$1.00')
        expect(format('PEN')(amount)).to.equal('PEN 1.00')
        expect(format('PHP')(amount)).to.equal('₱1.00')
        expect(format('SEK')(amount)).to.equal('kr 1.00')
        expect(format('SGD')(amount)).to.equal('$1.00')
        expect(format('THB')(amount)).to.equal('฿1.00')
        expect(format('USD')(amount)).to.equal('$1.00')
      })

      it('should format 123_456_789.987_654 "minimal atomic units"', function () {
        const amount = 123_456_789.987_654

        // "no cents currencies"
        expect(format('CLP')(amount)).to.equal('$123,456,790')
        expect(format('JPY')(amount)).to.equal('¥123,456,790')
        expect(format('KRW')(amount)).to.equal('₩123,456,790')
        expect(format('VND')(amount)).to.equal('₫123,456,790')

        // other currencies
        expect(format('AUD')(amount)).to.equal('$1,234,567.90')
        expect(format('BRL')(amount)).to.equal('R$1,234,567.90')
        expect(format('CAD')(amount)).to.equal('$1,234,567.90')
        expect(format('CHF')(amount)).to.equal('CHF 1,234,567.90')
        expect(format('CNY')(amount)).to.equal('¥1,234,567.90')
        expect(format('COP')(amount)).to.equal('$1,234,567.90')
        expect(format('DKK')(amount)).to.equal('kr 1,234,567.90')
        expect(format('EUR')(amount)).to.equal('€1,234,567.90')
        expect(format('GBP')(amount)).to.equal('£1,234,567.90')
        expect(format('HUF')(amount)).to.equal('Ft 1,234,567.90')
        expect(format('IDR')(amount)).to.equal('Rp 1,234,567.90')
        expect(format('INR')(amount)).to.equal('₹1,234,567.90')
        expect(format('MXN')(amount)).to.equal('$1,234,567.90')
        expect(format('MYR')(amount)).to.equal('RM 1,234,567.90')
        expect(format('NOK')(amount)).to.equal('kr 1,234,567.90')
        expect(format('NZD')(amount)).to.equal('$1,234,567.90')
        expect(format('PEN')(amount)).to.equal('PEN 1,234,567.90')
        expect(format('PHP')(amount)).to.equal('₱1,234,567.90')
        expect(format('SEK')(amount)).to.equal('kr 1,234,567.90')
        expect(format('SGD')(amount)).to.equal('$1,234,567.90')
        expect(format('THB')(amount)).to.equal('฿1,234,567.90')
        expect(format('USD')(amount)).to.equal('$1,234,567.90')
      })
    })
  })

  describe('fr', function () {
    const format = currency => priceInCents =>
      SubscriptionFormatters.formatPriceLocalized(priceInCents, currency, 'fr')

    describe('USD', function () {
      const formatUSD = format('USD')

      it('should format basic amounts', function () {
        expect(formatUSD(0)).to.equal('0,00 $')
        expect(formatUSD(1234)).to.equal('12,34 $')
      })

      it('should format thousand separators', function () {
        expect(formatUSD(100_000)).to.equal('1 000,00 $')
        expect(formatUSD(9_876_543_210)).to.equal('98 765 432,10 $')
      })

      it('should format negative amounts', function () {
        expect(formatUSD(-1)).to.equal('-0,01 $')
        expect(formatUSD(-1234)).to.equal('-12,34 $')
      })
    })

    describe('EUR', function () {
      const formatEUR = format('EUR')

      it('should format basic amounts', function () {
        expect(formatEUR(0)).to.equal('0,00 €')
        expect(formatEUR(1234)).to.equal('12,34 €')
      })

      it('should format thousand separators', function () {
        expect(formatEUR(100_000)).to.equal('1 000,00 €')
        expect(formatEUR(9_876_543_210)).to.equal('98 765 432,10 €')
      })

      it('should format negative amounts', function () {
        expect(formatEUR(-1)).to.equal('-0,01 €')
        expect(formatEUR(-1234)).to.equal('-12,34 €')
      })
    })

    describe('HUF', function () {
      const formatHUF = format('HUF')

      it('should format basic amounts', function () {
        expect(formatHUF(0)).to.equal('0,00 Ft')
        expect(formatHUF(1234)).to.equal('12,34 Ft')
      })

      it('should format thousand separators', function () {
        expect(formatHUF(100_000)).to.equal('1 000,00 Ft')
        expect(formatHUF(9_876_543_210)).to.equal('98 765 432,10 Ft')
      })

      it('should format negative amounts', function () {
        expect(formatHUF(-1)).to.equal('-0,01 Ft')
        expect(formatHUF(-1234)).to.equal('-12,34 Ft')
      })
    })

    describe('CLP', function () {
      const formatCLP = format('CLP')

      it('should format basic amounts', function () {
        expect(formatCLP(0)).to.equal('0 $')
        expect(formatCLP(1234)).to.equal('1 234 $')
      })

      it('should format thousand separators', function () {
        expect(formatCLP(100_000)).to.equal('100 000 $')
        expect(formatCLP(9_876_543_210)).to.equal('9 876 543 210 $')
      })

      it('should format negative amounts', function () {
        expect(formatCLP(-1)).to.equal('-1 $')
        expect(formatCLP(-1234)).to.equal('-1 234 $')
      })
    })

    describe('all currencies', function () {
      it('should format 100 "minimal atomic units"', function () {
        const amount = 100

        // "no cents currencies"
        expect(format('CLP')(amount)).to.equal('100 $')
        expect(format('JPY')(amount)).to.equal('100 ¥')
        expect(format('KRW')(amount)).to.equal('100 ₩')
        expect(format('VND')(amount)).to.equal('100 ₫')

        // other currencies
        expect(format('AUD')(amount)).to.equal('1,00 $')
        expect(format('BRL')(amount)).to.equal('1,00 R$')
        expect(format('CAD')(amount)).to.equal('1,00 $')
        expect(format('CHF')(amount)).to.equal('1,00 CHF')
        expect(format('CNY')(amount)).to.equal('1,00 ¥')
        expect(format('COP')(amount)).to.equal('1,00 $')

        expect(format('EUR')(amount)).to.equal('1,00 €')
        expect(format('GBP')(amount)).to.equal('1,00 £')
        expect(format('USD')(amount)).to.equal('1,00 $')
      })

      it('should format 123_456_789.987_654 "minimal atomic units"', function () {
        const amount = 123_456_789.987_654

        // "no cents currencies"
        expect(format('CLP')(amount)).to.equal('123 456 790 $')
        expect(format('JPY')(amount)).to.equal('123 456 790 ¥')
        expect(format('KRW')(amount)).to.equal('123 456 790 ₩')
        expect(format('VND')(amount)).to.equal('123 456 790 ₫')

        // other currencies
        expect(format('AUD')(amount)).to.equal('1 234 567,90 $')
        expect(format('BRL')(amount)).to.equal('1 234 567,90 R$')
        expect(format('CAD')(amount)).to.equal('1 234 567,90 $')
        expect(format('CHF')(amount)).to.equal('1 234 567,90 CHF')
        expect(format('CNY')(amount)).to.equal('1 234 567,90 ¥')
        expect(format('COP')(amount)).to.equal('1 234 567,90 $')

        expect(format('EUR')(amount)).to.equal('1 234 567,90 €')
        expect(format('GBP')(amount)).to.equal('1 234 567,90 £')
        expect(format('USD')(amount)).to.equal('1 234 567,90 $')
      })
    })
  })
})
