import symbols from '../data/symbols.json'

export function createCategories(t) {
  return [
    {
      id: 'Greek',
      label: t('category_greek'),
    },
    {
      id: 'Arrows',
      label: t('category_arrows'),
    },
    {
      id: 'Operators',
      label: t('category_operators'),
    },
    {
      id: 'Relations',
      label: t('category_relations'),
    },
    {
      id: 'Misc',
      label: t('category_misc'),
    },
  ]
}

export function buildCategorisedSymbols(categories) {
  const output = {}

  for (const category of categories) {
    output[category.id] = []
  }

  for (const item of symbols) {
    if (item.category in output) {
      item.character = String.fromCodePoint(
        parseInt(item.codepoint.replace(/^U\+0*/, ''), 16)
      )
      output[item.category].push(item)
    }
  }

  return output
}
