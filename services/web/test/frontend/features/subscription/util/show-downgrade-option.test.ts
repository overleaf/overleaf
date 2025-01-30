import { expect } from 'chai'
import showDowngradeOption from '../../../../../frontend/js/features/subscription/util/show-downgrade-option'
import dateformat from 'dateformat'

describe('showDowngradeOption', function () {
  const today = new Date()
  const sevenDaysFromToday = new Date().setDate(today.getDate() + 7)
  const sevenDaysFromTodayFormatted = dateformat(
    sevenDaysFromToday,
    'dS mmmm yyyy'
  )

  it('returns false when no trial end date', function () {
    expect(showDowngradeOption('collab')).to.be.false
  })
  it('returns false when a plan code without "collaborator" ', function () {
    expect(showDowngradeOption('test', false, sevenDaysFromTodayFormatted)).to
      .be.false
  })
  it('returns false when on a plan with trial date in future but has "collaborator" and "ann" in plan code', function () {
    expect(
      showDowngradeOption(
        'collaborator-annual',
        false,
        sevenDaysFromTodayFormatted
      )
    ).to.be.false
  })
  it('returns false when on a plan with trial date in future and plan code has "collaborator" and no "ann" but is a group plan', function () {
    expect(
      showDowngradeOption('collaborator', true, sevenDaysFromTodayFormatted)
    ).to.be.false
  })
  it('returns false when on a plan with "collaborator" and without "ann" and trial date in future', function () {
    expect(
      showDowngradeOption('collaborator', false, sevenDaysFromTodayFormatted)
    ).to.be.false
  })
  it('returns true when on a plan with "collaborator" and without "ann" and no trial date', function () {
    expect(showDowngradeOption('collaborator', false)).to.be.true
  })
  it('returns true when on a plan with "collaborator" and without "ann" and trial date is in the past', function () {
    expect(
      showDowngradeOption('collaborator', false, '2000-02-16T17:59:07.000Z')
    ).to.be.true
  })
  it('returns false when on a monthly collaborator plan with a pending pause', function () {
    expect(
      showDowngradeOption(
        'collaborator',
        false,
        null,
        '2030-01-01T12:00:00.000Z'
      )
    ).to.be.false
  })
  it('returns false when on a monthly collaborator plan with an active pause', function () {
    expect(
      showDowngradeOption(
        'collaborator',
        false,
        null,
        '2030-01-01T12:00:00.000Z',
        5
      )
    ).to.be.false
  })
})
