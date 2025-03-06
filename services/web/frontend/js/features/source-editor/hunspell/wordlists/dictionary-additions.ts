const dictionaryAdditions = new Set(['en_US'])

export const buildAdditionalDictionary = async (
  lang: string,
  learnedWords: string[]
) => {
  const words = [...learnedWords]

  if (dictionaryAdditions.has(lang)) {
    const wordList = await import(`./${lang}.txt`).then(m => m.default)
    words.push(...wordList.split('\n').filter(Boolean))
  }

  // the first line contains the approximate word count
  words.unshift(String(words.length))

  return new TextEncoder().encode(words.join('\n'))
}
