import { expect } from 'chai'
import { formatLocalDate } from '@/shared/utils/formatDate'
import moment from 'moment'

describe('formatLocalDate', function () {
  it('should format a date string with local timezone offset', function () {
    const date = '2022-12-21T10:29:21.881Z'
    const formatted = formatLocalDate(date)

    // Should match format: D MMM YYYY, HH:mm:ss Z
    // Tests run with TZ=GMT so timezone offset should be +00:00
    expect(formatted).to.equal('21 Dec 2022, 10:29:21 +00:00')
  })

  it('should format a Date object with local timezone offset', function () {
    const date = new Date('2023-01-03T14:20:13.000Z')
    const formatted = formatLocalDate(date)

    // Tests run with TZ=GMT so timezone offset should be +00:00
    expect(formatted).to.equal('3 Jan 2023, 14:20:13 +00:00')
  })

  it('should format a moment object with local timezone offset', function () {
    const date = moment('2022-03-22T11:36:09.000Z')
    const formatted = formatLocalDate(date)

    // Tests run with TZ=GMT so timezone offset should be +00:00
    expect(formatted).to.equal('22 Mar 2022, 11:36:09 +00:00')
  })

  it('should return "N/A" for null', function () {
    const formatted = formatLocalDate(null)
    expect(formatted).to.equal('N/A')
  })

  it('should return "N/A" for undefined', function () {
    const formatted = formatLocalDate(undefined)
    expect(formatted).to.equal('N/A')
  })

  it('should return "N/A" for empty string', function () {
    const formatted = formatLocalDate('')
    expect(formatted).to.equal('N/A')
  })

  it('should format consistent output for the same date', function () {
    const date = '2022-08-05T09:29:17.000Z'
    const formatted1 = formatLocalDate(date)
    const formatted2 = formatLocalDate(date)

    expect(formatted1).to.equal(formatted2)
  })

  it('should include timezone offset in output', function () {
    const date = '2022-12-21T10:29:21.881Z'
    const formatted = formatLocalDate(date)

    // Tests run with TZ=GMT so should always be +00:00
    expect(formatted).to.match(/\+00:00$/)
  })

  it('should format date with correct month abbreviation', function () {
    const date = '2022-12-21T10:29:21.881Z'
    const formatted = formatLocalDate(date)

    // December should be abbreviated as Dec
    expect(formatted).to.include('Dec')
  })

  it('should format time with seconds', function () {
    const date = '2022-12-21T10:29:21.881Z'
    const formatted = formatLocalDate(date)

    // Should include seconds in HH:mm:ss format
    expect(formatted).to.match(/\d{2}:\d{2}:\d{2}/)
  })

  it('should handle dates from different years', function () {
    const date1 = '2021-02-18T13:24:54.000Z'
    const date2 = '2023-04-04T15:31:26.000Z'

    const formatted1 = formatLocalDate(date1)
    const formatted2 = formatLocalDate(date2)

    expect(formatted1).to.include('2021')
    expect(formatted2).to.include('2023')
  })
})
