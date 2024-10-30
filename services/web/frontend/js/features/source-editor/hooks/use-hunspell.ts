import { useEffect, useState } from 'react'
import getMeta from '@/utils/meta'
import { globalLearnedWords } from '@/features/dictionary/ignored-words'
import { HunspellManager } from '@/features/source-editor/hunspell/HunspellManager'
import { debugConsole } from '@/utils/debugging'

export const useHunspell = (spellCheckLanguage: string | null) => {
  const [hunspellManager, setHunspellManager] = useState<HunspellManager>()

  useEffect(() => {
    if (spellCheckLanguage) {
      const lang = (getMeta('ol-languages') ?? []).find(
        item => item.code === spellCheckLanguage
      )
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
  }, [spellCheckLanguage])

  return hunspellManager
}
