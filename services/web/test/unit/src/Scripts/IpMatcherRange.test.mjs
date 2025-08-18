import { convertCidrRanges } from '../../../../scripts/ip_matcher_ranges.mjs'

describe('IpMatcherRange', function () {
  it('returns IP ranges from CIDR notation', function () {
    const ranges = convertCidrRanges(['192.168.1.0/24'])
    expect(ranges).to.deep.equal('192.168.1.0..192.168.1.255')
  })

  it('returns IP ranges from a variation CIDR notation', function () {
    const ranges = convertCidrRanges([
      '192.168.0.0/24',
      '10.0.0.0/8',
      '172.16.0.0/12',
    ])
    expect(ranges).to.deep.equal(
      '192.168.0.0..192.168.0.255,10.0.0.0..10.255.255.255,172.16.0.0..172.31.255.255'
    )
  })
})
