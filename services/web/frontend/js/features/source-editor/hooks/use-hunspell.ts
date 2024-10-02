import { isSplitTestEnabled } from '@/utils/splitTestUtils'
import { useEffect, useState } from 'react'
import getMeta from '@/utils/meta'
import { globalLearnedWords } from '@/features/dictionary/ignored-words'
import { HunspellManager } from '@/features/source-editor/hunspell/HunspellManager'
import { debugConsole } from '@/utils/debugging'

export const useHunspell = (spellCheckLanguage: string | null) => {
  const [hunspellManager, setHunspellManager] = useState<HunspellManager>()

  useEffect(() => {
    if (isSplitTestEnabled('spell-check-client')) {
      if (spellCheckLanguage) {
        const languages = getMeta('ol-languages')
        const lang = languages.find(item => item.code === spellCheckLanguage)
        if (lang?.dic) {
          const hunspellManager = new HunspellManager(lang.dic, [
            ...globalLearnedWords,
            ...getMeta('ol-learnedWords'),
          ])
          setHunspellManager(hunspellManager)
          debugConsole.log(spellCheckLanguage, hunspellManager)

          return () => {
            hunspellManager.destroy()
          }
        } else {
          setHunspellManager(undefined)
        }
      }
    }
  }, [spellCheckLanguage])

  return hunspellManager
}
