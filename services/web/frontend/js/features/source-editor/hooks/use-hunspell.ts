import { useEffect, useState } from 'react'
import getMeta from '@/utils/meta'
import { globalIgnoredWords } from '@/features/dictionary/ignored-words'
import { HunspellManager } from '@/features/source-editor/hunspell/HunspellManager'
import { debugConsole } from '@/utils/debugging'
import { learnedWords } from '@/features/source-editor/extensions/spelling/learned-words'
import { supportsWebAssembly } from '@/utils/wasm'

export const useHunspell = (spellCheckLanguage: string | null) => {
  const [hunspellManager, setHunspellManager] = useState<HunspellManager>()

  useEffect(() => {
    if (spellCheckLanguage && supportsWebAssembly()) {
      const lang = (getMeta('ol-languages') ?? []).find(
        item => item.code === spellCheckLanguage
      )
      if (lang?.dic) {
        const hunspellManager = new HunspellManager(lang.dic, [
          ...globalIgnoredWords,
          ...learnedWords.global,
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
