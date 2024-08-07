import { expect } from 'chai'
import isInFreeTrial from '../../../../../frontend/js/features/subscription/util/is-in-free-trial'
import dateformat from 'dateformat'

describe('isInFreeTrial', function () {
  it('returns false when no date sent', function () {
    expect(isInFreeTrial()).to.be.false
  })
  it('returns false when date is null', function () {
    expect(isInFreeTrial(null)).to.be.false
  })
  it('returns false when date is in the past', function () {
    expect(isInFreeTrial('2000-02-16T17:59:07.000Z')).to.be.false
  })
  it('returns true when date is in the future', function () {
    const today = new Date()
    const sevenDaysFromToday = new Date().setDate(today.getDate() + 7)
    const sevenDaysFromTodayFormatted = dateformat(
      sevenDaysFromToday,
      'dS mmmm yyyy'
    )
    expect(isInFreeTrial(sevenDaysFromTodayFormatted)).to.be.true
  })
})
