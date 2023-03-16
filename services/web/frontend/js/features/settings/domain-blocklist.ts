const domainBlocklist = ['overleaf.com']
const commonTLDs = [
  'br',
  'cn',
  'co',
  'co.jp',
  'co.uk',
  'com',
  'com.au',
  'de',
  'fr',
  'in',
  'info',
  'io',
  'net',
  'no',
  'ru',
  'se',
  'us',
  'com.tw',
  'com.br',
  'pl',
  'it',
  'co.in',
  'com.mx',
] as const
const commonDomains = [
  'gmail',
  'googlemail',
  'icloud',
  'me',
  'yahoo',
  'ymail',
  'yahoomail',
  'hotmail',
  'live',
  'msn',
  'outlook',
  'gmx',
  'mail',
  'aol',
  '163',
  'mac',
  'qq',
  'o2',
  'libero',
  '126',
  'protonmail',
  'yandex',
  'yeah',
  'web',
  'foxmail',
] as const

for (const domain of commonDomains) {
  for (const tld of commonTLDs) {
    domainBlocklist.push(`${domain}.${tld}`)
  }
}

export default domainBlocklist as ReadonlyArray<typeof domainBlocklist[number]>
