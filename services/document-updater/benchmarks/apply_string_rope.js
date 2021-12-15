const { Suite } = require('benchmark')
const Rope = require('jumprope')

const suite = new Suite()

for (const size of [5000, 100000, 2000000]) {
  const positions = []
  for (let i = 0; i < 100; i++) {
    positions.push(Math.floor(Math.random() * size))
  }
  for (const inserts of [0, 1, 2, 5, 10, 20, 100, 1000, 10000]) {
    const initialString = 'a'.repeat(size)
    suite.add(`| string | ${inserts} | ${size} |`, () => {
      let str = initialString
      for (let i = 0; i < inserts; i++) {
        const pos = positions[i % 100]
        str = str.slice(0, pos) + '1234567890' + str.slice(pos)
      }
      return str.length
    })

    suite.add(`| rope | ${inserts} | ${size} |`, () => {
      const rope = new Rope(initialString)
      for (let i = 0; i < inserts; i++) {
        const pos = positions[i % 100]
        rope.insert(pos, '1234567890')
      }
      return rope.toString().length
    })
  }
}

suite.on('cycle', function (event) {
  const meanMs = event.target.stats.mean * 1000
  const meanToString = Math.ceil(meanMs * 100000) / 100000
  console.log(`${event.target.name} ${meanToString}ms | `)
})

// markdown table headers
console.log('| method | inserts | string size | mean |')
console.log('|-|-|-|-|')

suite.run({ async: true })
