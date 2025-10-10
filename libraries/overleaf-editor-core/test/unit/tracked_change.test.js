// @ts-check
const TrackedChange = require('../../lib/file_data/tracked_change')
const Range = require('../../lib/range')
const TrackingProps = require('../../lib/file_data/tracking_props')
const { expect } = require('chai')

describe('TrackedChange', function () {
  it('should survive serialization', function () {
    const trackedChange = new TrackedChange(
      new Range(1, 2),
      new TrackingProps('insert', 'user1', new Date('2024-01-01T00:00:00.000Z'))
    )
    const newTrackedChange = TrackedChange.fromRaw(trackedChange.toRaw())
    expect(newTrackedChange).to.be.instanceOf(TrackedChange)
    expect(newTrackedChange).to.deep.equal(trackedChange)
  })

  it('can be created from a raw object', function () {
    const trackedChange = TrackedChange.fromRaw({
      range: { pos: 1, length: 2 },
      tracking: {
        type: 'insert',
        userId: 'user1',
        ts: '2024-01-01T00:00:00.000Z',
      },
    })
    expect(trackedChange).to.be.instanceOf(TrackedChange)
    expect(trackedChange).to.deep.equal(
      new TrackedChange(
        new Range(1, 2),
        new TrackingProps(
          'insert',
          'user1',
          new Date('2024-01-01T00:00:00.000Z')
        )
      )
    )
  })

  it('can be serialized to a raw object', function () {
    const change = new TrackedChange(
      new Range(1, 2),
      new TrackingProps('insert', 'user1', new Date('2024-01-01T00:00:00.000Z'))
    )
    expect(change).to.be.instanceOf(TrackedChange)
    expect(change.toRaw()).to.deep.equal({
      range: { pos: 1, length: 2 },
      tracking: {
        type: 'insert',
        userId: 'user1',
        ts: '2024-01-01T00:00:00.000Z',
      },
    })
  })
})
