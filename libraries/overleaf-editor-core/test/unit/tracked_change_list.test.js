// @ts-check
const TrackedChangeList = require('../../lib/file_data/tracked_change_list')
const TrackingProps = require('../../lib/file_data/tracking_props')
const ClearTrackingProps = require('../../lib/file_data/clear_tracking_props')
const { expect } = require('chai')
/** @import { TrackedChangeRawData } from '../../lib/types' */

describe('TrackedChangeList', function () {
  describe('applyInsert', function () {
    describe('with same author', function () {
      it('should merge consecutive tracked changes and use the latest timestamp', function () {
        const trackedChanges = TrackedChangeList.fromRaw([
          {
            range: { pos: 0, length: 3 },
            tracking: {
              type: 'insert',
              userId: 'user1',
              ts: '2023-01-01T00:00:00.000Z',
            },
          },
        ])
        trackedChanges.applyInsert(3, 'foo', {
          tracking: TrackingProps.fromRaw({
            type: 'insert',
            userId: 'user1',
            ts: '2024-01-01T00:00:00.000Z',
          }),
        })
        expect(trackedChanges.length).to.equal(1)
        expect(trackedChanges.toRaw()).to.deep.equal([
          {
            range: { pos: 0, length: 6 },
            tracking: {
              type: 'insert',
              userId: 'user1',
              ts: '2024-01-01T00:00:00.000Z',
            },
          },
        ])
      })

      it('should extend tracked changes when inserting in the middle', function () {
        const trackedChanges = TrackedChangeList.fromRaw([
          {
            range: { pos: 0, length: 10 },
            tracking: {
              type: 'insert',
              userId: 'user1',
              ts: '2024-01-01T00:00:00.000Z',
            },
          },
        ])
        trackedChanges.applyInsert(5, 'foobar', {
          tracking: TrackingProps.fromRaw({
            type: 'insert',
            userId: 'user1',
            ts: '2024-01-01T00:00:00.000Z',
          }),
        })
        expect(trackedChanges.length).to.equal(1)
        expect(trackedChanges.toRaw()).to.deep.equal([
          {
            range: { pos: 0, length: 16 },
            tracking: {
              type: 'insert',
              userId: 'user1',
              ts: '2024-01-01T00:00:00.000Z',
            },
          },
        ])
      })

      it('should merge two tracked changes starting at the same position', function () {
        const trackedChanges = TrackedChangeList.fromRaw([
          {
            range: { pos: 0, length: 3 },
            tracking: {
              type: 'insert',
              userId: 'user1',
              ts: '2023-01-01T00:00:00.000Z',
            },
          },
        ])
        trackedChanges.applyInsert(0, 'foo', {
          tracking: TrackingProps.fromRaw({
            type: 'insert',
            userId: 'user1',
            ts: '2023-01-01T00:00:00.000Z',
          }),
        })
        expect(trackedChanges.length).to.equal(1)
        expect(trackedChanges.toRaw()).to.deep.equal([
          {
            range: { pos: 0, length: 6 },
            tracking: {
              type: 'insert',
              userId: 'user1',
              ts: '2023-01-01T00:00:00.000Z',
            },
          },
        ])
      })

      it('should not extend range when there is a gap between the ranges', function () {
        const trackedChanges = TrackedChangeList.fromRaw([
          {
            range: { pos: 0, length: 3 },
            tracking: {
              type: 'insert',
              userId: 'user1',
              ts: '2023-01-01T00:00:00.000Z',
            },
          },
        ])
        trackedChanges.applyInsert(4, 'foobar', {
          tracking: TrackingProps.fromRaw({
            type: 'insert',
            userId: 'user1',
            ts: '2024-01-01T00:00:00.000Z',
          }),
        })
        expect(trackedChanges.length).to.equal(2)
        expect(trackedChanges.toRaw()).to.deep.equal([
          {
            range: { pos: 0, length: 3 },
            tracking: {
              type: 'insert',
              userId: 'user1',
              ts: '2023-01-01T00:00:00.000Z',
            },
          },
          {
            range: { pos: 4, length: 6 },
            tracking: {
              type: 'insert',
              userId: 'user1',
              ts: '2024-01-01T00:00:00.000Z',
            },
          },
        ])
      })

      it('should not merge tracked changes if there is a space between them', function () {
        const trackedChanges = TrackedChangeList.fromRaw([
          {
            range: { pos: 5, length: 5 },
            tracking: {
              type: 'insert',
              userId: 'user1',
              ts: '2023-01-01T00:00:00.000Z',
            },
          },
        ])
        trackedChanges.applyInsert(4, 'foo', {
          tracking: TrackingProps.fromRaw({
            type: 'insert',
            userId: 'user1',
            ts: '2024-01-01T00:00:00.000Z',
          }),
        })
        expect(trackedChanges.length).to.equal(2)
        expect(trackedChanges.toRaw()).to.deep.equal([
          {
            range: { pos: 4, length: 3 },
            tracking: {
              type: 'insert',
              userId: 'user1',
              ts: '2024-01-01T00:00:00.000Z',
            },
          },
          {
            range: { pos: 8, length: 5 },
            tracking: {
              type: 'insert',
              userId: 'user1',
              ts: '2023-01-01T00:00:00.000Z',
            },
          },
        ])
      })
    })

    describe('with different authors', function () {
      it('should not merge consecutive tracked changes', function () {
        const trackedChanges = TrackedChangeList.fromRaw([
          {
            range: { pos: 0, length: 3 },
            tracking: {
              type: 'insert',
              userId: 'user1',
              ts: '2023-01-01T00:00:00.000Z',
            },
          },
        ])
        trackedChanges.applyInsert(3, 'foo', {
          tracking: TrackingProps.fromRaw({
            type: 'insert',
            userId: 'user2',
            ts: '2024-01-01T00:00:00.000Z',
          }),
        })
        expect(trackedChanges.length).to.equal(2)
        expect(trackedChanges.toRaw()).to.deep.equal([
          {
            range: { pos: 0, length: 3 },
            tracking: {
              type: 'insert',
              userId: 'user1',
              ts: '2023-01-01T00:00:00.000Z',
            },
          },
          {
            range: { pos: 3, length: 3 },
            tracking: {
              type: 'insert',
              userId: 'user2',
              ts: '2024-01-01T00:00:00.000Z',
            },
          },
        ])
      })

      it('should not merge tracked changes at same position', function () {
        const trackedChanges = TrackedChangeList.fromRaw([
          {
            range: { pos: 0, length: 3 },
            tracking: {
              type: 'insert',
              userId: 'user1',
              ts: '2023-01-01T00:00:00.000Z',
            },
          },
        ])
        trackedChanges.applyInsert(0, 'foo', {
          tracking: TrackingProps.fromRaw({
            type: 'insert',
            userId: 'user2',
            ts: '2024-01-01T00:00:00.000Z',
          }),
        })
        expect(trackedChanges.length).to.equal(2)
        expect(trackedChanges.toRaw()).to.deep.equal([
          {
            range: { pos: 0, length: 3 },
            tracking: {
              type: 'insert',
              userId: 'user2',
              ts: '2024-01-01T00:00:00.000Z',
            },
          },
          {
            range: { pos: 3, length: 3 },
            tracking: {
              type: 'insert',
              userId: 'user1',
              ts: '2023-01-01T00:00:00.000Z',
            },
          },
        ])
      })

      it('should insert tracked changes in the middle of a tracked range', function () {
        const trackedChanges = TrackedChangeList.fromRaw([
          {
            range: { pos: 0, length: 10 },
            tracking: {
              type: 'insert',
              userId: 'user1',
              ts: '2023-01-01T00:00:00.000Z',
            },
          },
        ])
        trackedChanges.applyInsert(5, 'foobar', {
          tracking: TrackingProps.fromRaw({
            type: 'insert',
            userId: 'user2',
            ts: '2024-01-01T00:00:00.000Z',
          }),
        })
        expect(trackedChanges.length).to.equal(3)
        expect(trackedChanges.toRaw()).to.deep.equal([
          {
            range: { pos: 0, length: 5 },
            tracking: {
              type: 'insert',
              userId: 'user1',
              ts: '2023-01-01T00:00:00.000Z',
            },
          },
          {
            range: { pos: 5, length: 6 },
            tracking: {
              type: 'insert',
              userId: 'user2',
              ts: '2024-01-01T00:00:00.000Z',
            },
          },
          {
            range: { pos: 11, length: 5 },
            tracking: {
              type: 'insert',
              userId: 'user1',
              ts: '2023-01-01T00:00:00.000Z',
            },
          },
        ])
      })

      it('should insert tracked changes at the end of a tracked range', function () {
        const trackedChanges = TrackedChangeList.fromRaw([
          {
            range: { pos: 0, length: 5 },
            tracking: {
              type: 'insert',
              userId: 'user1',
              ts: '2023-01-01T00:00:00.000Z',
            },
          },
        ])
        trackedChanges.applyInsert(5, 'foobar', {
          tracking: TrackingProps.fromRaw({
            type: 'insert',
            userId: 'user2',
            ts: '2024-01-01T00:00:00.000Z',
          }),
        })
        expect(trackedChanges.length).to.equal(2)
        expect(trackedChanges.toRaw()).to.deep.equal([
          {
            range: { pos: 0, length: 5 },
            tracking: {
              type: 'insert',
              userId: 'user1',
              ts: '2023-01-01T00:00:00.000Z',
            },
          },
          {
            range: { pos: 5, length: 6 },
            tracking: {
              type: 'insert',
              userId: 'user2',
              ts: '2024-01-01T00:00:00.000Z',
            },
          },
        ])
      })

      it('should split a track range when inserting at last contained cursor', function () {
        const trackedChanges = TrackedChangeList.fromRaw([
          {
            range: { pos: 0, length: 5 },
            tracking: {
              type: 'insert',
              userId: 'user1',
              ts: '2023-01-01T00:00:00.000Z',
            },
          },
        ])
        trackedChanges.applyInsert(4, 'foobar', {
          tracking: TrackingProps.fromRaw({
            type: 'insert',
            userId: 'user2',
            ts: '2024-01-01T00:00:00.000Z',
          }),
        })
        expect(trackedChanges.length).to.equal(3)
        expect(trackedChanges.toRaw()).to.deep.equal([
          {
            range: { pos: 0, length: 4 },
            tracking: {
              type: 'insert',
              userId: 'user1',
              ts: '2023-01-01T00:00:00.000Z',
            },
          },
          {
            range: { pos: 4, length: 6 },
            tracking: {
              type: 'insert',
              userId: 'user2',
              ts: '2024-01-01T00:00:00.000Z',
            },
          },
          {
            range: { pos: 10, length: 1 },
            tracking: {
              type: 'insert',
              userId: 'user1',
              ts: '2023-01-01T00:00:00.000Z',
            },
          },
        ])
      })

      it('should insert a new range if inserted just before the first cursor of a tracked range', function () {
        const trackedChanges = TrackedChangeList.fromRaw([
          {
            range: { pos: 5, length: 5 },
            tracking: {
              type: 'insert',
              userId: 'user1',
              ts: '2023-01-01T00:00:00.000Z',
            },
          },
        ])
        trackedChanges.applyInsert(5, 'foobar', {
          tracking: TrackingProps.fromRaw({
            type: 'insert',
            userId: 'user2',
            ts: '2024-01-01T00:00:00.000Z',
          }),
        })
        expect(trackedChanges.length).to.equal(2)
        expect(trackedChanges.toRaw()).to.deep.equal([
          {
            range: { pos: 5, length: 6 },
            tracking: {
              type: 'insert',
              userId: 'user2',
              ts: '2024-01-01T00:00:00.000Z',
            },
          },
          {
            range: { pos: 11, length: 5 },
            tracking: {
              type: 'insert',
              userId: 'user1',
              ts: '2023-01-01T00:00:00.000Z',
            },
          },
        ])
      })
    })
  })

  describe('applyDelete', function () {
    it('should shrink tracked changes', function () {
      const trackedChanges = TrackedChangeList.fromRaw([
        {
          range: { pos: 0, length: 10 },
          tracking: {
            type: 'insert',
            userId: 'user1',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
      ])
      trackedChanges.applyDelete(5, 2)
      expect(trackedChanges.length).to.equal(1)
      expect(trackedChanges.toRaw()).to.deep.equal([
        {
          range: { pos: 0, length: 8 },
          tracking: {
            type: 'insert',
            userId: 'user1',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
      ])
    })

    it('should delete tracked changes when the whole range is deleted', function () {
      const trackedChanges = TrackedChangeList.fromRaw([
        {
          range: { pos: 0, length: 10 },
          tracking: {
            type: 'insert',
            userId: 'user1',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
      ])
      trackedChanges.applyDelete(0, 10)
      expect(trackedChanges.length).to.equal(0)
      expect(trackedChanges.toRaw()).to.deep.equal([])
    })

    it('should delete tracked changes when more than the whole range is deleted', function () {
      const trackedChanges = TrackedChangeList.fromRaw([
        {
          range: { pos: 5, length: 10 },
          tracking: {
            type: 'insert',
            userId: 'user1',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
      ])
      trackedChanges.applyDelete(0, 25)
      expect(trackedChanges.length).to.equal(0)
      expect(trackedChanges.toRaw()).to.deep.equal([])
    })

    it('should shrink the tracked change from start with overlap', function () {
      const trackedChanges = TrackedChangeList.fromRaw([
        {
          range: { pos: 0, length: 10 },
          tracking: {
            type: 'insert',
            userId: 'user1',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
      ])
      trackedChanges.applyDelete(1, 9)
      expect(trackedChanges.length).to.equal(1)
      expect(trackedChanges.toRaw()).to.deep.equal([
        {
          range: { pos: 0, length: 1 },
          tracking: {
            type: 'insert',
            userId: 'user1',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
      ])
    })

    it('should shrink the tracked change from end with overlap', function () {
      const trackedChanges = TrackedChangeList.fromRaw([
        {
          range: { pos: 0, length: 10 },
          tracking: {
            type: 'insert',
            userId: 'user1',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
      ])
      trackedChanges.applyDelete(0, 9)
      expect(trackedChanges.length).to.equal(1)
      expect(trackedChanges.toRaw()).to.deep.equal([
        {
          range: { pos: 0, length: 1 },
          tracking: {
            type: 'insert',
            userId: 'user1',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
      ])
    })
  })

  describe('fromRaw & toRaw', function () {
    it('should survive serialization', function () {
      /** @type {TrackedChangeRawData[]} */
      const initialRaw = [
        {
          range: { pos: 0, length: 10 },
          tracking: {
            type: 'insert',
            userId: 'user1',
            ts: '2024-01-01T00:00:00.000Z',
          },
        },
      ]

      const trackedChanges = TrackedChangeList.fromRaw(initialRaw)
      const raw = trackedChanges.toRaw()
      const newTrackedChanges = TrackedChangeList.fromRaw(raw)

      expect(newTrackedChanges).to.deep.equal(trackedChanges)
      expect(raw).to.deep.equal(initialRaw)
    })
  })

  describe('applyRetain', function () {
    it('should add tracking information to an untracked range', function () {
      const trackedChanges = TrackedChangeList.fromRaw([])
      trackedChanges.applyRetain(0, 10, {
        tracking: TrackingProps.fromRaw({
          type: 'insert',
          userId: 'user1',
          ts: '2024-01-01T00:00:00.000Z',
        }),
      })
      expect(trackedChanges.length).to.equal(1)
      expect(trackedChanges.toRaw()).to.deep.equal([
        {
          range: { pos: 0, length: 10 },
          tracking: {
            type: 'insert',
            userId: 'user1',
            ts: '2024-01-01T00:00:00.000Z',
          },
        },
      ])
    })

    it('should shrink a tracked range to make room for retained operation', function () {
      const trackedChanges = TrackedChangeList.fromRaw([
        {
          range: { pos: 3, length: 7 },
          tracking: {
            type: 'insert',
            userId: 'user1',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
      ])
      trackedChanges.applyRetain(0, 5, {
        tracking: TrackingProps.fromRaw({
          type: 'insert',
          userId: 'user2',
          ts: '2024-01-01T00:00:00.000Z',
        }),
      })
      expect(trackedChanges.length).to.equal(2)
      expect(trackedChanges.toRaw()).to.deep.equal([
        {
          range: { pos: 0, length: 5 },
          tracking: {
            type: 'insert',
            userId: 'user2',
            ts: '2024-01-01T00:00:00.000Z',
          },
        },
        {
          range: { pos: 5, length: 5 },
          tracking: {
            type: 'insert',
            userId: 'user1',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
      ])
    })

    it('should break up a tracked range to make room for retained operation', function () {
      const trackedChanges = TrackedChangeList.fromRaw([
        {
          range: { pos: 0, length: 10 },
          tracking: {
            type: 'insert',
            userId: 'user1',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
      ])
      trackedChanges.applyRetain(5, 1, {
        tracking: TrackingProps.fromRaw({
          type: 'insert',
          userId: 'user2',
          ts: '2024-01-01T00:00:00.000Z',
        }),
      })
      expect(trackedChanges.length).to.equal(3)
      expect(trackedChanges.toRaw()).to.deep.equal([
        {
          range: { pos: 0, length: 5 },
          tracking: {
            type: 'insert',
            userId: 'user1',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
        {
          range: { pos: 5, length: 1 },
          tracking: {
            type: 'insert',
            userId: 'user2',
            ts: '2024-01-01T00:00:00.000Z',
          },
        },
        {
          range: { pos: 6, length: 4 },
          tracking: {
            type: 'insert',
            userId: 'user1',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
      ])
    })

    it('should update the timestamp of a tracked range', function () {
      const trackedChanges = TrackedChangeList.fromRaw([
        {
          range: { pos: 0, length: 10 },
          tracking: {
            type: 'insert',
            userId: 'user1',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
      ])
      trackedChanges.applyRetain(1, 12, {
        tracking: TrackingProps.fromRaw({
          type: 'insert',
          userId: 'user1',
          ts: '2024-01-01T00:00:00.000Z',
        }),
      })
      expect(trackedChanges.length).to.equal(1)
      expect(trackedChanges.toRaw()).to.deep.equal([
        {
          range: { pos: 0, length: 13 },
          tracking: {
            type: 'insert',
            userId: 'user1',
            ts: '2024-01-01T00:00:00.000Z',
          },
        },
      ])
    })

    it('should leave ignore a retain operation with no tracking info', function () {
      const trackedChanges = TrackedChangeList.fromRaw([
        {
          range: { pos: 0, length: 10 },
          tracking: {
            type: 'insert',
            userId: 'user1',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
      ])
      trackedChanges.applyRetain(0, 10)
      expect(trackedChanges.length).to.equal(1)
      expect(trackedChanges.toRaw()).to.deep.equal([
        {
          range: { pos: 0, length: 10 },
          tracking: {
            type: 'insert',
            userId: 'user1',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
      ])
    })

    it('should leave not break up a tracked change for a retain with no tracking info', function () {
      const trackedChanges = TrackedChangeList.fromRaw([
        {
          range: { pos: 0, length: 10 },
          tracking: {
            type: 'insert',
            userId: 'user1',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
      ])
      trackedChanges.applyRetain(4, 1)
      expect(trackedChanges.length).to.equal(1)
      expect(trackedChanges.toRaw()).to.deep.equal([
        {
          range: { pos: 0, length: 10 },
          tracking: {
            type: 'insert',
            userId: 'user1',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
      ])
    })

    it('should delete a tracked change which is being resolved', function () {
      const trackedChanges = TrackedChangeList.fromRaw([
        {
          range: { pos: 0, length: 10 },
          tracking: {
            type: 'insert',
            userId: 'user1',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
      ])
      trackedChanges.applyRetain(0, 10, {
        tracking: new ClearTrackingProps(),
      })
      expect(trackedChanges.length).to.equal(0)
      expect(trackedChanges.toRaw()).to.deep.equal([])
    })

    it('should delete a tracked change which is being resolved by other user', function () {
      const trackedChanges = TrackedChangeList.fromRaw([
        {
          range: { pos: 0, length: 10 },
          tracking: {
            type: 'insert',
            userId: 'user1',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
      ])
      trackedChanges.applyRetain(0, 10, {
        tracking: new ClearTrackingProps(),
      })
      expect(trackedChanges.length).to.equal(0)
      expect(trackedChanges.toRaw()).to.deep.equal([])
    })

    it('should delete a tracked change which is being rejected', function () {
      const trackedChanges = TrackedChangeList.fromRaw([
        {
          range: { pos: 0, length: 10 },
          tracking: {
            type: 'delete',
            userId: 'user1',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
      ])
      trackedChanges.applyRetain(0, 10, {
        tracking: new ClearTrackingProps(),
      })
      expect(trackedChanges.length).to.equal(0)
      expect(trackedChanges.toRaw()).to.deep.equal([])
    })

    it('should delete a tracked change which is being rejected by other user', function () {
      const trackedChanges = TrackedChangeList.fromRaw([
        {
          range: { pos: 0, length: 10 },
          tracking: {
            type: 'delete',
            userId: 'user1',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
      ])
      trackedChanges.applyRetain(0, 10, {
        tracking: new ClearTrackingProps(),
      })
      expect(trackedChanges.length).to.equal(0)
      expect(trackedChanges.toRaw()).to.deep.equal([])
    })

    it('should append a new tracked change when retaining a range from another user with tracking info', function () {
      const trackedChanges = TrackedChangeList.fromRaw([
        {
          range: { pos: 4, length: 4 },
          tracking: {
            type: 'delete',
            userId: 'user1',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
      ])
      trackedChanges.applyRetain(8, 1, {
        tracking: TrackingProps.fromRaw({
          type: 'delete',
          userId: 'user2',
          ts: '2024-01-01T00:00:00.000Z',
        }),
      })
      expect(trackedChanges.length).to.equal(2)
      expect(trackedChanges.toRaw()).to.deep.equal([
        {
          range: { pos: 4, length: 4 },
          tracking: {
            type: 'delete',
            userId: 'user1',
            ts: '2023-01-01T00:00:00.000Z',
          },
        },
        {
          range: { pos: 8, length: 1 },
          tracking: {
            type: 'delete',
            userId: 'user2',
            ts: '2024-01-01T00:00:00.000Z',
          },
        },
      ])
    })
  })
})
