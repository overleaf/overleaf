import type { BibEntryType } from './bibtex-entry-schema.mts'

const entryTypes: Map<string, BibEntryType> = new Map()

entryTypes.set('article', {
  key: 'article',
  label: 'Article',
  fields: ['author', 'title', 'journal', 'journaltitle', 'year', 'date'],
  requiredFields: [
    'author',
    'title',
    ['journal', 'journaltitle'],
    ['year', 'date'],
  ],
  optionalFields: [
    'translator',
    'annotator',
    'commentator',
    'subtitle',
    'titleaddon',
    'editor',
    'editora',
    'editorb',
    'editorc',
    'journalsubtitle',
    'journaltitleaddon',
    'issuetitle',
    'issuesubtitle',
    'issuetitleaddon',
    'language',
    'origlanguage',
    'series',
    'volume',
    'number',
    'eid',
    'issue',
    'month',
    'pages',
    'version',
    'note',
    'issn',
    'addendum',
    'pubstate',
    'doi',
    'eprint',
    'eprintclass',
    'eprinttype',
    'url',
    'urldate',
  ],
})
entryTypes.set('artwork', {
  key: 'artwork',
  label: 'Artwork',
  fields: ['author', 'editor', 'title', 'year', 'date'],
  requiredFields: [],
  optionalFields: [],
})
entryTypes.set('audio', {
  key: 'audio',
  label: 'Audio',
  fields: ['author', 'editor', 'title', 'year', 'date'],
  requiredFields: [],
  optionalFields: [],
})
entryTypes.set('book', {
  key: 'book',
  label: 'Book',
  fields: ['author', 'editor', 'title', 'publisher', 'year', 'date'],
  requiredFields: [['author', 'editor'], 'title', ['year', 'date']],
  optionalFields: [],
})
entryTypes.set('bookinbook', {
  key: 'bookinbook',
  label: 'Book in book',
  fields: [
    'author',
    'editor',
    'title',
    'booktitle',
    'chapter',
    'pages',
    'publisher',
    'year',
    'date',
  ],
  requiredFields: ['author', 'title', 'booktitle', ['year', 'date']],
  optionalFields: [],
})
entryTypes.set('booklet', {
  key: 'booklet',
  label: 'Booklet',
  fields: ['author', 'editor', 'title', 'year', 'date'],
  requiredFields: ['title'],
  optionalFields: [],
})
entryTypes.set('commentary', {
  key: 'commentary',
  label: 'Commentary',
  fields: ['author', 'editor', 'title', 'year', 'date'],
  requiredFields: [],
  optionalFields: [],
})
entryTypes.set('conference', {
  key: 'conference',
  label: 'Conference',
  fields: ['author', 'title', 'booktitle', 'year', 'date'],
  requiredFields: ['author', 'title', 'booktitle', ['year', 'date']],
  optionalFields: [],
})
entryTypes.set('collection', {
  key: 'collection',
  label: 'Collection',
  fields: ['editor', 'title', 'year', 'date'],
  requiredFields: ['editor', 'title', ['year', 'date']],
  optionalFields: [],
})
entryTypes.set('dataset', {
  key: 'dataset',
  label: 'Dataset',
  fields: ['author', 'editor', 'title', 'year', 'date'],
  requiredFields: [['author', 'editor'], 'title', ['year', 'date']],
  optionalFields: [],
})
entryTypes.set('electronic', {
  key: 'electronic',
  label: 'Electronic resource',
  fields: ['author', 'editor', 'title', 'year', 'date', 'doi', 'eprint', 'url'],
  requiredFields: [
    ['author', 'editor'],
    'title',
    ['year', 'date'],
    ['doi', 'eprint', 'url'],
  ],
  optionalFields: [],
})
entryTypes.set('image', {
  key: 'image',
  label: 'Image',
  fields: ['author', 'editor', 'title', 'year', 'date'],
  requiredFields: [],
  optionalFields: [],
})
entryTypes.set('inproceedings', {
  key: 'inproceedings',
  label: 'In proceedings',
  fields: ['author', 'title', 'booktitle', 'year', 'date'],
  requiredFields: ['author', 'title', 'booktitle', ['year', 'date']],
  optionalFields: [],
})
entryTypes.set('inbook', {
  key: 'inbook',
  label: 'In book',
  fields: [
    'author',
    'editor',
    'title',
    'booktitle',
    'chapter',
    'pages',
    'publisher',
    'year',
    'date',
  ],
  requiredFields: [['author', 'editor'], 'title', ['year', 'date']],
  optionalFields: [],
})
entryTypes.set('incollection', {
  key: 'incollection',
  label: 'In collection',
  fields: ['author', 'title', 'booktitle', 'publisher', 'year', 'date'],
  requiredFields: ['author', 'title', 'booktitle', ['year', 'date']],
  optionalFields: [],
})
entryTypes.set('inreference', {
  key: 'inreference',
  label: 'In reference',
  fields: ['author', 'editor', 'title', 'booktitle', 'year', 'date'],
  requiredFields: ['author', 'title', 'editor', 'booktitle', ['year', 'date']],
  optionalFields: [],
})
entryTypes.set('jurisdiction', {
  key: 'jurisdiction',
  label: 'Jurisdiction',
  fields: ['author', 'editor', 'title', 'year', 'date'],
  requiredFields: [],
  optionalFields: [],
})
entryTypes.set('manual', {
  key: 'manual',
  label: 'Manual',
  fields: ['author', 'editor', 'title', 'year', 'date'],
  requiredFields: ['title'],
  optionalFields: [],
})
entryTypes.set('mastersthesis', {
  key: 'mastersthesis',
  label: "Master's thesis",
  fields: ['author', 'title', 'institution', 'school', 'year', 'date'],
  requiredFields: [
    'author',
    'title',
    ['school', 'institution'],
    ['year', 'date'],
  ],
  optionalFields: [],
})
entryTypes.set('misc', {
  key: 'misc',
  label: 'Miscellaneous',
  fields: ['author', 'editor', 'title', 'year', 'date'],
  requiredFields: [],
  optionalFields: [],
})
entryTypes.set('movie', {
  key: 'movie',
  label: 'Movie',
  fields: ['author', 'editor', 'title', 'year', 'date'],
  requiredFields: [],
  optionalFields: [],
})
entryTypes.set('music', {
  key: 'music',
  label: 'Music',
  fields: ['author', 'editor', 'title', 'year', 'date'],
  requiredFields: [],
  optionalFields: [],
})
entryTypes.set('mvbook', {
  key: 'mvbook',
  label: 'Multi-volume book',
  fields: ['author', 'title', 'year', 'date'],
  requiredFields: ['author', 'title', ['year', 'date']],
  optionalFields: [],
})
entryTypes.set('mvcollection', {
  key: 'mvcollection',
  label: 'Multi-volume collection',
  fields: ['editor', 'title', 'year', 'date'],
  requiredFields: ['editor', 'title', ['year', 'date']],
  optionalFields: [],
})
entryTypes.set('mvproceedings', {
  key: 'mvproceedings',
  label: 'Multi-volume proceedings',
  fields: ['title', 'year', 'date'],
  requiredFields: ['title', ['year', 'date']],
  optionalFields: [],
})
entryTypes.set('mvreference', {
  key: 'mvreference',
  label: 'Multi-volume reference',
  fields: ['editor', 'title', 'year', 'date'],
  requiredFields: ['editor', 'title', ['year', 'date']],
  optionalFields: [],
})
entryTypes.set('legal', {
  key: 'legal',
  label: 'Legal',
  fields: ['author', 'editor', 'title', 'year', 'date'],
  requiredFields: [],
  optionalFields: [],
})
entryTypes.set('legislation', {
  key: 'legislation',
  label: 'Legislation',
  fields: ['author', 'editor', 'title', 'year', 'date'],
  requiredFields: [],
  optionalFields: [],
})
entryTypes.set('letter', {
  key: 'letter',
  label: 'Letter',
  fields: ['author', 'editor', 'title', 'year', 'date'],
  requiredFields: [],
  optionalFields: [],
})
entryTypes.set('online', {
  key: 'online',
  label: 'Online resource',
  fields: ['author', 'editor', 'title', 'year', 'date', 'doi', 'eprint', 'url'],
  requiredFields: [
    ['author', 'editor'],
    'title',
    ['year', 'date'],
    ['doi', 'eprint', 'url'],
  ],
  optionalFields: [],
})
entryTypes.set('patent', {
  key: 'patent',
  label: 'Patent',
  fields: ['author', 'title', 'number', 'year', 'date'],
  requiredFields: ['author', 'title', 'number', ['year', 'date']],
  optionalFields: [],
})
entryTypes.set('performance', {
  key: 'performance',
  label: 'Performance',
  fields: ['author', 'editor', 'title', 'year', 'date'],
  requiredFields: [],
  optionalFields: [],
})
entryTypes.set('periodical', {
  key: 'periodical',
  label: 'Periodical',
  fields: ['editor', 'title', 'year', 'date'],
  requiredFields: ['editor', 'title', ['year', 'date']],
  optionalFields: [],
})
entryTypes.set('phdthesis', {
  key: 'phdthesis',
  label: 'PhD thesis',
  fields: ['author', 'title', 'institution', 'school', 'year', 'date'],
  requiredFields: [
    'author',
    'title',
    ['school', 'institution'],
    ['year', 'date'],
  ],
  optionalFields: [],
})
entryTypes.set('proceedings', {
  key: 'proceedings',
  label: 'Proceedings',
  fields: ['title', 'year', 'date'],
  requiredFields: ['title', ['year', 'date']],
  optionalFields: [],
})
entryTypes.set('reference', {
  key: 'reference',
  label: 'Reference',
  fields: ['editor', 'title', 'year', 'date'],
  requiredFields: ['editor', 'title', ['year', 'date']],
  optionalFields: [],
})
entryTypes.set('report', {
  key: 'report',
  label: 'Report',
  fields: ['author', 'title', 'type', 'institution', 'year', 'date'],
  requiredFields: ['author', 'title', 'type', 'institution', ['year', 'date']],
  optionalFields: [],
})
entryTypes.set('review', {
  key: 'review',
  label: 'Review',
  fields: ['author', 'editor', 'title', 'year', 'date'],
  requiredFields: [],
  optionalFields: [],
})
entryTypes.set('software', {
  key: 'software',
  label: 'Software',
  fields: ['author', 'editor', 'title', 'year', 'date'],
  requiredFields: [],
  optionalFields: [],
})
entryTypes.set('standard', {
  key: 'standard',
  label: 'Standard',
  fields: ['author', 'editor', 'title', 'year', 'date'],
  requiredFields: [],
  optionalFields: [],
})
entryTypes.set('suppbook', {
  key: 'suppbook',
  label: 'Supplemental material in book',
  fields: [
    'author',
    'editor',
    'title',
    'booktitle',
    'chapter',
    'pages',
    'publisher',
    'year',
    'date',
  ],
  requiredFields: ['author', 'title', 'booktitle', ['year', 'date']],
  optionalFields: [],
})
entryTypes.set('suppcollection', {
  key: 'suppcollection',
  label: 'Supplemental material in collection',
  fields: ['author', 'editor', 'title', 'booktitle', 'year', 'date'],
  requiredFields: ['author', 'title', 'editor', 'booktitle', ['year', 'date']],
  optionalFields: [],
})
entryTypes.set('suppperiodical', {
  key: 'suppperiodical',
  label: 'Supplemental material in periodical',
  fields: ['author', 'title', 'journaltitle', 'year', 'date'],
  optionalFields: [],
  requiredFields: ['author', 'title', 'journaltitle', ['year', 'date']],
})
entryTypes.set('techreport', {
  key: 'techreport',
  label: 'Tech report',
  fields: ['author', 'title', 'institution', 'year', 'date'],
  requiredFields: ['author', 'title', 'institution', ['year', 'date']],
  optionalFields: [],
})
entryTypes.set('thesis', {
  key: 'thesis',
  label: 'Thesis',
  fields: ['author', 'title', 'type', 'institution', 'year', 'date'],
  requiredFields: ['author', 'title', 'type', 'institution', ['year', 'date']],
  optionalFields: [],
})
entryTypes.set('unpublished', {
  key: 'unpublished',
  label: 'Unpublished',
  fields: ['author', 'title', 'year', 'date', 'note'],
  requiredFields: ['author', 'title'],
  optionalFields: [],
})
entryTypes.set('video', {
  key: 'video',
  label: 'Video',
  fields: ['author', 'editor', 'title', 'year', 'date'],
  requiredFields: [],
  optionalFields: [],
})
entryTypes.set('www', {
  key: 'www',
  label: 'WWW',
  fields: ['author', 'editor', 'title', 'year', 'date', 'doi', 'eprint', 'url'],
  requiredFields: [
    ['author', 'editor'],
    'title',
    ['year', 'date'],
    ['doi', 'eprint', 'url'],
  ],
  optionalFields: [],
})

function getMiscEntryType(): BibEntryType | undefined {
  return entryTypes.get('misc')
}

export function isEntryType(key: string): boolean {
  return entryTypes.has(key)
}

export function getEntryType(key: string): BibEntryType {
  const entryType = entryTypes.get(key)
  if (entryType != null) {
    return entryType
  } else {
    return generateCustomEntryType(key)
  }
}

export function getAllEntryTypes(): BibEntryType[] {
  return Array.from(entryTypes.values())
}

export function getAllEntryKeys(): string[] {
  return Array.from(entryTypes.keys()) ?? []
}

export function generateCustomEntryType(key: string): BibEntryType {
  const miscEntryType = getMiscEntryType()
  return {
    key,
    label: key,
    fields: miscEntryType?.fields || [],
    optionalFields: miscEntryType?.optionalFields || [],
    requiredFields: miscEntryType?.requiredFields || [],
  }
}

export function getTypeFields(type: string): string[] {
  return (
    (!isEntryType(type)
      ? getMiscEntryType()?.fields
      : getEntryType(type)?.fields) || []
  )
}
