import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'

export const usePhrases = (): Record<string, string> => {
  const { t, i18n } = useTranslation()

  const codemirrorBuiltinsOverrides = useMemo(
    () => ({
      'Fold line': t('fold_line'),
      'Unfold line': t('unfold_line'),
    }),
    [t]
  )

  const translationProxy = useMemo(
    () => ({
      getOwnPropertyDescriptor(target: Record<string, string>, prop: string) {
        // If we've added an override
        if (Object.prototype.hasOwnProperty.call(target, prop)) {
          return Object.getOwnPropertyDescriptor(target, prop)
        }
        // If the translation exists, report a property:
        //   non-enumerable: it won't show up in enumerating the keys of the target
        //   configurable: we have to report it as configurable since it doesn't
        //                 exist in the base object
        //   writable: an override can be added
        if (i18n.exists(prop)) {
          return { enumerable: false, configurable: true, writable: true }
        }
        return Object.getOwnPropertyDescriptor(target, prop)
      },
      get(target: Record<string, string>, prop: string) {
        // If we've specifically added an override
        if (Object.prototype.hasOwnProperty.call(target, prop)) {
          return target[prop]
        }
        if (i18n.exists(prop)) {
          return t(prop)
        }
        return target[prop]
      },
    }),
    [t, i18n]
  )

  const phrases = useMemo(
    () => new Proxy(codemirrorBuiltinsOverrides, translationProxy),
    [translationProxy, codemirrorBuiltinsOverrides]
  )

  return phrases
}
