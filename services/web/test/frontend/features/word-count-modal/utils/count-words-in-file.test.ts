import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { countWordsInFile } from '@/features/word-count-modal/utils/count-words-in-file'
import { WordCountData } from '@/features/word-count-modal/components/word-count-data'
import { createSegmenters } from '@/features/word-count-modal/utils/segmenters'
import { expect } from 'chai'
import { ProjectSnapshot } from '@/infrastructure/project-snapshot'
import { Snapshot } from 'overleaf-editor-core'

describe('word-count', function () {
  beforeEach(async function () {
    this.data = {
      encode: '',
      textWords: 0,
      headWords: 0,
      outside: 0,
      headers: 0,
      elements: 0,
      mathInline: 0,
      mathDisplay: 0,
      errors: 0,
      messages: '',
      textCharacters: 0,
      headCharacters: 0,
      captionWords: 0,
      captionCharacters: 0,
      footnoteWords: 0,
      footnoteCharacters: 0,
      abstractWords: 0,
      abstractCharacters: 0,
      otherWords: 0,
      otherCharacters: 0,
    } satisfies WordCountData

    const files = {
      'word-count.tex': {
        content: await readFile(
          path.join(__dirname, 'word-count.tex'),
          'utf-8'
        ),
      },
      'word-count-with-ignored-sections.tex': {
        content: await readFile(
          path.join(__dirname, 'word-count-with-ignored-sections.tex'),
          'utf-8'
        ),
      },
      'extra-words.tex': {
        content: await readFile(
          path.join(__dirname, 'extra-words.tex'),
          'utf-8'
        ),
      },
      'subfolder/extra-words.tex': {
        content: await readFile(
          path.join(__dirname, 'extra-words.tex'),
          'utf-8'
        ),
      },
    }

    const projectSnapshot = new ProjectSnapshot('test')
    // @ts-expect-error ignoring that "snapshot" is private
    projectSnapshot.snapshot = Snapshot.fromRaw({ files })
    this.projectSnapshot = projectSnapshot

    this.segmenters = createSegmenters('en_US')
  })

  it('produces correct counts', function () {
    countWordsInFile(
      this.data,
      this.projectSnapshot,
      'word-count.tex',
      '/',
      this.segmenters
    )

    expect(this.data).to.deep.include({
      abstractCharacters: 8,
      abstractWords: 2,
      captionCharacters: 16,
      captionWords: 4,
      footnoteCharacters: 8,
      footnoteWords: 2,
      headCharacters: 305,
      headWords: 53,
      otherCharacters: 10,
      otherWords: 2,
      textCharacters: 249,
      textWords: 56,
    })
  })

  it('skips ignored sections', function () {
    countWordsInFile(
      this.data,
      this.projectSnapshot,
      'word-count-with-ignored-sections.tex',
      '/',
      this.segmenters
    )

    expect(this.data).to.deep.include({
      abstractCharacters: 0,
      abstractWords: 0,
      captionCharacters: 0,
      captionWords: 0,
      footnoteCharacters: 0,
      footnoteWords: 0,
      headCharacters: 0,
      headWords: 0,
      otherCharacters: 0,
      otherWords: 0,
      textCharacters: 10,
      textWords: 3,
    })
  })
})
