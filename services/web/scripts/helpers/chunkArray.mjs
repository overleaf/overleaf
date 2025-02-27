const CHUNK_SIZE = 1000

// Function to chunk the array
export function chunkArray(array, size = CHUNK_SIZE) {
  const result = []
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size))
  }
  return result
}

export default { chunkArray }
