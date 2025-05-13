import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { countWordsInFile } from '@/features/word-count-modal/utils/count-words-in-file'
import { WordCountData } from '@/features/word-count-modal/components/word-count-data'
import { createSegmenters } from '@/features/word-count-modal/utils/segmenters'
import { expect } from 'chai'

describe('word count', function () {
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

    const content = {
      'word-count.tex': await readFile(
        path.join(__dirname, 'word-count.tex'),
        'utf-8'
      ),
    }

    this.projectSnapshot = {
      getDocContents(path: keyof typeof content) {
        return content[path]
      },
    }

    this.segmenters = createSegmenters('en_US')
  })

  it('produces correct counts', function () {
    countWordsInFile(
      this.data,
      this.projectSnapshot,
      'word-count.tex',
      this.segmenters
    )

    expect(this.data).to.deep.include({
      abstractCharacters: 8,
      abstractWords: 2,
      captionCharacters: 16,
      captionWords: 4,
      footnoteCharacters: 8,
      footnoteWords: 2,
      headCharacters: 296,
      headWords: 52,
      otherCharacters: 10,
      otherWords: 2,
      textCharacters: 193,
      textWords: 42,
    })
  })
})
