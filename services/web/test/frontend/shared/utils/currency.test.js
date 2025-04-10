import { expect } from 'chai'
import { formatCurrency } from '../../../../frontend/js/shared/utils/currency'

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

describe('formatCurrency', function () {
  describe('en', function () {
    const format = currency => priceInCents =>
      formatCurrency(priceInCents, currency)

    describe('USD', function () {
      const formatUSD = format('USD')

      it('should format basic amounts', function () {
        expect(formatUSD(0)).to.equal('$0.00')
        expect(formatUSD(12.34)).to.equal('$12.34')
        expect(formatUSD(123)).to.equal('$123.00')
      })

      it('should format thousand separators', function () {
        expect(formatUSD(1_000)).to.equal('$1,000.00')
        expect(formatUSD(98_765_432.1)).to.equal('$98,765,432.10')
      })

      it('should format negative amounts', function () {
        expect(formatUSD(-0.01)).to.equal('-$0.01')
        expect(formatUSD(-12.34)).to.equal('-$12.34')
        expect(formatUSD(-123)).to.equal('-$123.00')
      })
    })

    describe('EUR', function () {
      const formatEUR = format('EUR')

      it('should format basic amounts', function () {
        expect(formatEUR(0)).to.equal('€0.00')
        expect(formatEUR(12.34)).to.equal('€12.34')
        expect(formatEUR(123)).to.equal('€123.00')
      })

      it('should format thousand separators', function () {
        expect(formatEUR(1_000)).to.equal('€1,000.00')
        expect(formatEUR(98_765_432.1)).to.equal('€98,765,432.10')
      })

      it('should format negative amounts', function () {
        expect(formatEUR(-0.01)).to.equal('-€0.01')
        expect(formatEUR(-12.34)).to.equal('-€12.34')
        expect(formatEUR(-123)).to.equal('-€123.00')
      })
    })

    describe('HUF', function () {
      const formatHUF = format('HUF')

      it('should format basic amounts', function () {
        expect(formatHUF(0)).to.equal('Ft 0.00')
        expect(formatHUF(12.34)).to.equal('Ft 12.34')
        expect(formatHUF(123)).to.equal('Ft 123.00')
      })

      it('should format thousand separators', function () {
        expect(formatHUF(1_000)).to.equal('Ft 1,000.00')
        expect(formatHUF(98_765_432.1)).to.equal('Ft 98,765,432.10')
      })

      it('should format negative amounts', function () {
        expect(formatHUF(-0.01)).to.equal('-Ft 0.01')
        expect(formatHUF(-12.34)).to.equal('-Ft 12.34')
        expect(formatHUF(-123)).to.equal('-Ft 123.00')
      })
    })

    describe('CLP', function () {
      const formatCLP = format('CLP')

      it('should format basic amounts', function () {
        expect(formatCLP(0)).to.equal('$0')
        expect(formatCLP(12.34)).to.equal('$12')
        expect(formatCLP(123)).to.equal('$123')
        expect(formatCLP(1234)).to.equal('$1,234')
      })

      it('should format thousand separators', function () {
        expect(formatCLP(1_000)).to.equal('$1,000')
        expect(formatCLP(98_765_432.1)).to.equal('$98,765,432')
      })

      it('should format negative amounts', function () {
        expect(formatCLP(-1)).to.equal('-$1')
        expect(formatCLP(-12.34)).to.equal('-$12')
        expect(formatCLP(-1234)).to.equal('-$1,234')
      })
    })

    describe('all currencies', function () {
      it('should format 1 "minimal atomic units"', function () {
        const amount = 1

        // "no cents currencies"
        expect(format('CLP')(amount)).to.equal('$1')
        expect(format('JPY')(amount)).to.equal('¥1')
        expect(format('KRW')(amount)).to.equal('₩1')
        expect(format('VND')(amount)).to.equal('₫1')

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

      it('should format 1_234_567.897_654 "minimal atomic units"', function () {
        const amount = 1_234_567.897_654

        // "no cents currencies"
        expect(format('CLP')(amount)).to.equal('$1,234,568')
        expect(format('JPY')(amount)).to.equal('¥1,234,568')
        expect(format('KRW')(amount)).to.equal('₩1,234,568')
        expect(format('VND')(amount)).to.equal('₫1,234,568')

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
      formatCurrency(priceInCents, currency, 'fr')

    describe('USD', function () {
      const formatUSD = format('USD')

      it('should format basic amounts', function () {
        expect(formatUSD(0)).to.equal('0,00 $')
        expect(formatUSD(12.34)).to.equal('12,34 $')
        expect(formatUSD(123)).to.equal('123,00 $')
      })

      it('should format thousand separators', function () {
        expect(formatUSD(1_000)).to.equal('1 000,00 $')
        expect(formatUSD(98_765_432.1)).to.equal('98 765 432,10 $')
      })

      it('should format negative amounts', function () {
        expect(formatUSD(-0.01)).to.equal('-0,01 $')
        expect(formatUSD(-12.34)).to.equal('-12,34 $')
        expect(formatUSD(-123)).to.equal('-123,00 $')
      })
    })

    describe('EUR', function () {
      const formatEUR = format('EUR')

      it('should format basic amounts', function () {
        expect(formatEUR(0)).to.equal('0,00 €')
        expect(formatEUR(12.34)).to.equal('12,34 €')
        expect(formatEUR(123)).to.equal('123,00 €')
      })

      it('should format thousand separators', function () {
        expect(formatEUR(1_000)).to.equal('1 000,00 €')
        expect(formatEUR(98_765_432.1)).to.equal('98 765 432,10 €')
      })

      it('should format negative amounts', function () {
        expect(formatEUR(-0.01)).to.equal('-0,01 €')
        expect(formatEUR(-12.34)).to.equal('-12,34 €')
        expect(formatEUR(-123)).to.equal('-123,00 €')
      })
    })

    describe('HUF', function () {
      const formatHUF = format('HUF')

      it('should format basic amounts', function () {
        expect(formatHUF(0)).to.equal('0,00 Ft')
        expect(formatHUF(12.34)).to.equal('12,34 Ft')
        expect(formatHUF(123)).to.equal('123,00 Ft')
      })

      it('should format thousand separators', function () {
        expect(formatHUF(1_000)).to.equal('1 000,00 Ft')
        expect(formatHUF(98_765_432.1)).to.equal('98 765 432,10 Ft')
      })

      it('should format negative amounts', function () {
        expect(formatHUF(-0.01)).to.equal('-0,01 Ft')
        expect(formatHUF(-12.34)).to.equal('-12,34 Ft')
        expect(formatHUF(-123)).to.equal('-123,00 Ft')
      })
    })

    describe('CLP', function () {
      const formatCLP = format('CLP')

      it('should format basic amounts', function () {
        expect(formatCLP(0)).to.equal('0 $')
        expect(formatCLP(12.34)).to.equal('12 $')
        expect(formatCLP(123)).to.equal('123 $')
        expect(formatCLP(1234)).to.equal('1 234 $')
      })

      it('should format thousand separators', function () {
        expect(formatCLP(100_000)).to.equal('100 000 $')
        expect(formatCLP(9_876_543_210)).to.equal('9 876 543 210 $')
      })

      it('should format negative amounts', function () {
        expect(formatCLP(-1)).to.equal('-1 $')
        expect(formatCLP(-12.34)).to.equal('-12 $')
        expect(formatCLP(-1234)).to.equal('-1 234 $')
      })
    })

    describe('all currencies', function () {
      it('should format 1 "minimal atomic units"', function () {
        const amount = 1

        // "no cents currencies"
        expect(format('CLP')(amount)).to.equal('1 $')
        expect(format('JPY')(amount)).to.equal('1 ¥')
        expect(format('KRW')(amount)).to.equal('1 ₩')
        expect(format('VND')(amount)).to.equal('1 ₫')

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

      it('should format 1_234_567.897_654 "minimal atomic units"', function () {
        const amount = 1_234_567.897_654

        // "no cents currencies"
        expect(format('CLP')(amount)).to.equal('1 234 568 $')
        expect(format('JPY')(amount)).to.equal('1 234 568 ¥')
        expect(format('KRW')(amount)).to.equal('1 234 568 ₩')
        expect(format('VND')(amount)).to.equal('1 234 568 ₫')

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
