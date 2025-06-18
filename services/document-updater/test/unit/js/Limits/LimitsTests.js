const { expect } = require('chai')
const modulePath = '../../../../app/js/Limits.js'
const SandboxedModule = require('sandboxed-module')

describe('Limits', function () {
  beforeEach(function () {
    return (this.Limits = SandboxedModule.require(modulePath))
  })

  describe('getTotalSizeOfLines', function () {
    it('should compute the character count for a document with multiple lines', function () {
      const count = this.Limits.getTotalSizeOfLines(['123', '4567'])
      expect(count).to.equal(9)
    })

    it('should compute the character count for a document with a single line', function () {
      const count = this.Limits.getTotalSizeOfLines(['123'])
      expect(count).to.equal(4)
    })

    it('should compute the character count for an empty document', function () {
      const count = this.Limits.getTotalSizeOfLines([])
      expect(count).to.equal(0)
    })
  })

  describe('docIsTooLarge', function () {
    describe('when the estimated size is below the limit', function () {
      it('should return false when the estimated size is below the limit', function () {
        const result = this.Limits.docIsTooLarge(128, ['hello', 'world'], 1024)
        expect(result).to.be.false
      })
    })

    describe('when the estimated size is at the limit', function () {
      it('should return false when the estimated size is at the limit', function () {
        const result = this.Limits.docIsTooLarge(1024, ['hello', 'world'], 1024)
        expect(result).to.be.false
      })
    })

    describe('when the estimated size is above the limit', function () {
      it('should return false when the actual character count is below the limit', function () {
        const result = this.Limits.docIsTooLarge(2048, ['hello', 'world'], 1024)
        expect(result).to.be.false
      })

      it('should return false when the actual character count is at the limit', function () {
        const result = this.Limits.docIsTooLarge(2048, ['x'.repeat(1023)], 1024)
        expect(result).to.be.false
      })

      it('should return true when the actual character count is above the limit by 1', function () {
        const count = this.Limits.docIsTooLarge(2048, ['x'.repeat(1024)], 1024)
        expect(count).to.be.true
      })

      it('should return true when the actual character count is above the limit', function () {
        const count = this.Limits.docIsTooLarge(2048, ['x'.repeat(2000)], 1024)
        expect(count).to.be.true
      })
    })

    describe('when the document has many lines', function () {
      it('should return false when the actual character count is below the limit ', function () {
        const count = this.Limits.docIsTooLarge(
          2048,
          '1234567890'.repeat(100).split('0'),
          1024
        )
        expect(count).to.be.false
      })

      it('should return true when the actual character count is above the limit', function () {
        const count = this.Limits.docIsTooLarge(
          2048,
          '1234567890'.repeat(2000).split('0'),
          1024
        )
        expect(count).to.be.true
      })
    })
  })

  describe('stringFileDataContentIsTooLarge', function () {
    it('should handle small docs', function () {
      expect(
        this.Limits.stringFileDataContentIsTooLarge({ content: '' }, 123)
      ).to.equal(false)
    })
    it('should handle docs at the limit', function () {
      expect(
        this.Limits.stringFileDataContentIsTooLarge(
          { content: 'x'.repeat(123) },
          123
        )
      ).to.equal(false)
    })
    it('should handle docs above the limit', function () {
      expect(
        this.Limits.stringFileDataContentIsTooLarge(
          { content: 'x'.repeat(123 + 1) },
          123
        )
      ).to.equal(true)
    })
    it('should handle docs above the limit and below with tracked-deletes removed', function () {
      expect(
        this.Limits.stringFileDataContentIsTooLarge(
          {
            content: 'x'.repeat(123 + 1),
            trackedChanges: [
              {
                range: { pos: 1, length: 1 },
                tracking: {
                  type: 'delete',
                  ts: '2025-06-16T14:31:44.910Z',
                  userId: 'user-id',
                },
              },
            ],
          },
          123
        )
      ).to.equal(false)
    })
    it('should handle docs above the limit and above with tracked-deletes removed', function () {
      expect(
        this.Limits.stringFileDataContentIsTooLarge(
          {
            content: 'x'.repeat(123 + 2),
            trackedChanges: [
              {
                range: { pos: 1, length: 1 },
                tracking: {
                  type: 'delete',
                  ts: '2025-06-16T14:31:44.910Z',
                  userId: 'user-id',
                },
              },
            ],
          },
          123
        )
      ).to.equal(true)
    })
    it('should handle docs above the limit and with tracked-inserts', function () {
      expect(
        this.Limits.stringFileDataContentIsTooLarge(
          {
            content: 'x'.repeat(123 + 1),
            trackedChanges: [
              {
                range: { pos: 1, length: 1 },
                tracking: {
                  type: 'insert',
                  ts: '2025-06-16T14:31:44.910Z',
                  userId: 'user-id',
                },
              },
            ],
          },
          123
        )
      ).to.equal(true)
    })
  })
})
