import { expect } from 'chai'
import freeTrialExpiresUnderSevenDays from '../../../../../frontend/js/features/subscription/util/free-trial-expires-under-seven-days'

describe('freeTrialExpiresUnderSevenDays', function () {
  it('returns false when no date sent', function () {
    expect(freeTrialExpiresUnderSevenDays()).to.be.false
  })
  it('returns false when date is null', function () {
    expect(freeTrialExpiresUnderSevenDays(null)).to.be.false
  })
  it('returns false when date is in the past', function () {
    expect(freeTrialExpiresUnderSevenDays('2000-02-16T17:59:07.000Z')).to.be
      .false
  })
  it('returns true when date is in 6 days', function () {
    const d = new Date()
    d.setDate(d.getDate() + 6)
    expect(freeTrialExpiresUnderSevenDays(d.toString())).to.be.true
  })
  it('returns false when date is in 8 days', function () {
    const d = new Date()
    d.setDate(d.getDate() + 8)
    expect(freeTrialExpiresUnderSevenDays(d.toString())).to.be.false
  })
})
