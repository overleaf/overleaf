// Super quick and dirty LCG PRNG

const m = 0xffffffff
let X = Math.floor(Math.random() * (m - 1))
const a = 16807
const c = 0

// Should probably be a large-ish number
export function seed(i) {
  if (i < 0) {
    throw new Error('Seed must be a positive integer')
  }
  X = i & m
}

export function random() {
  X = (a * X + c) % m
  return X / m
}
