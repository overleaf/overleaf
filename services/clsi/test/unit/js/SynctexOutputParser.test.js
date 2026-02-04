import Path from 'node:path'
import { expect, describe, beforeEach, it } from 'vitest'

const MODULE_PATH = Path.join(
  import.meta.dirname,
  '../../../app/js/SynctexOutputParser'
)

describe('SynctexOutputParser', function () {
  beforeEach(async function (ctx) {
    ctx.SynctexOutputParser = (await import(MODULE_PATH)).default
  })

  describe('parseViewOutput', function () {
    it('parses valid output', function (ctx) {
      const output = `This is SyncTeX command line utility, version 1.5
SyncTeX result begin
Output:/compile/output.pdf
Page:1
x:136.537964
y:661.437561
h:133.768356
v:663.928223
W:343.711060
H:9.962640
before:
offset:-1
middle:
after:
Output:/compile/output.pdf
Page:2
x:178.769592
y:649.482361
h:134.768356
v:651.973022
W:342.711060
H:19.962640
before:
offset:-1
middle:
after:
SyncTeX result end
`
      const records = ctx.SynctexOutputParser.parseViewOutput(output)
      expect(records).to.deep.equal([
        {
          page: 1,
          h: 133.768356,
          v: 663.928223,
          width: 343.71106,
          height: 9.96264,
        },
        {
          page: 2,
          h: 134.768356,
          v: 651.973022,
          width: 342.71106,
          height: 19.96264,
        },
      ])
    })

    it('handles garbage', function (ctx) {
      const output = 'This computer is on strike!'
      const records = ctx.SynctexOutputParser.parseViewOutput(output)
      expect(records).to.deep.equal([])
    })
  })

  describe('parseEditOutput', function () {
    it('parses valid output', function (ctx) {
      const output = `This is SyncTeX command line utility, version 1.5
SyncTeX result begin
Output:/compile/output.pdf
Input:/compile/main.tex
Line:17
Column:-1
Offset:0
Context:
SyncTeX result end
`
      const records = ctx.SynctexOutputParser.parseEditOutput(
        output,
        '/compile'
      )
      expect(records).to.deep.equal([
        { file: 'main.tex', line: 17, column: -1 },
      ])
    })

    it('handles values that contain colons', function (ctx) {
      const output = `This is SyncTeX command line utility, version 1.5
SyncTeX result begin
Output:/compile/output.pdf
Input:/compile/this-file:has-a-weird-name.tex
Line:17
Column:-1
Offset:0
Context:
SyncTeX result end
`

      const records = ctx.SynctexOutputParser.parseEditOutput(
        output,
        '/compile'
      )
      expect(records).to.deep.equal([
        { file: 'this-file:has-a-weird-name.tex', line: 17, column: -1 },
      ])
    })

    it('handles garbage', function (ctx) {
      const output = '2 + 2 = 4'
      const records = ctx.SynctexOutputParser.parseEditOutput(output)
      expect(records).to.deep.equal([])
    })
  })
})
