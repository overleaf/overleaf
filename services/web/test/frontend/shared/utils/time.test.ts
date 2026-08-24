import { expect } from 'chai'
import { TFunction } from 'i18next'
import {
  formatSecondsToHoursAndMinutes,
  secondsToHoursAndMinutes,
} from '@/shared/utils/time'

// stands in for i18next, echoing the key and its count
const t = ((key: string, options?: { count?: number }) =>
  options?.count === undefined
    ? key
    : `${options.count} ${key}`) as unknown as TFunction

const ONE_HOUR_IN_SECONDS = 3600
const ONE_MINUTE_IN_SECONDS = 60

describe('formatSecondsToHoursAndMinutes', function () {
  it('joins hours and minutes - 3h 25m', function () {
    expect(
      formatSecondsToHoursAndMinutes(
        t,
        3 * ONE_HOUR_IN_SECONDS + 25 * ONE_MINUTE_IN_SECONDS
      )
    ).to.equal('3 time_hour time_and 25 time_minute')
  })

  it('omits minutes for a whole number of hours - 2h', function () {
    expect(formatSecondsToHoursAndMinutes(t, 2 * ONE_HOUR_IN_SECONDS)).to.equal(
      '2 time_hour'
    )
  })

  it('omits hours for under an hour - 25m', function () {
    expect(
      formatSecondsToHoursAndMinutes(t, 25 * ONE_MINUTE_IN_SECONDS)
    ).to.equal('25 time_minute')
  })

  it('rounds a part-minute up - 25m 30s', function () {
    expect(
      formatSecondsToHoursAndMinutes(t, 25 * ONE_MINUTE_IN_SECONDS + 30)
    ).to.equal('26 time_minute')
  })

  it('rounds up to a minute for under a minute - 30s', function () {
    expect(formatSecondsToHoursAndMinutes(t, 30)).to.equal('1 time_minute')
  })

  it('rounds up to a minute for a fraction of a second - 0.5s', function () {
    expect(formatSecondsToHoursAndMinutes(t, 0.5)).to.equal('1 time_minute')
  })

  it('carries a rounded-up minute into the hours - 20h 59m 30s', function () {
    expect(
      formatSecondsToHoursAndMinutes(
        t,
        20 * ONE_HOUR_IN_SECONDS + 59 * ONE_MINUTE_IN_SECONDS + 30
      )
    ).to.equal('21 time_hour')
  })

  it('adds a minute just past a whole hour - 1h 1s', function () {
    expect(formatSecondsToHoursAndMinutes(t, ONE_HOUR_IN_SECONDS + 1)).to.equal(
      '1 time_hour time_and 1 time_minute'
    )
  })
})

describe('secondsToHoursAndMinutes', function () {
  it('rounds a part-minute up - 50s', function () {
    expect(secondsToHoursAndMinutes(50)).to.deep.equal({
      hours: 0,
      minutes: 1,
    })
  })

  it('rounds a part-minute up - 1m 59s', function () {
    expect(secondsToHoursAndMinutes(ONE_MINUTE_IN_SECONDS + 59)).to.deep.equal({
      hours: 0,
      minutes: 2,
    })
  })

  it('carries whole minutes into hours without a 60 - 1h', function () {
    expect(secondsToHoursAndMinutes(ONE_HOUR_IN_SECONDS)).to.deep.equal({
      hours: 1,
      minutes: 0,
    })
  })

  it('is zero for no remaining time', function () {
    expect(secondsToHoursAndMinutes(0)).to.deep.equal({
      hours: 0,
      minutes: 0,
    })
  })
})
