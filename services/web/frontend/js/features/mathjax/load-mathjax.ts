import getMeta from '../../utils/meta'

let mathJaxPromise: Promise<typeof window.MathJax>

const TAGS_NONE_REMOVED = 'none-removed'

export const loadMathJax = async (options?: {
  enableMenu?: boolean
  numbering?: 'none-removed' | 'none' | 'ams'
  singleDollar?: boolean
  useLabelIds?: boolean
}) => {
  if (!mathJaxPromise) {
    mathJaxPromise = new Promise((resolve, reject) => {
      options = {
        enableMenu: false,
        numbering: TAGS_NONE_REMOVED,
        singleDollar: true,
        useLabelIds: false,
        ...options,
      }

      const inlineMath = [['\\(', '\\)']]
      if (options.singleDollar) {
        inlineMath.push(['$', '$'])
      }

      // https://docs.mathjax.org/en/stable/options/index.html
      window.MathJax = {
        // https://docs.mathjax.org/en/latest/options/input/tex.html#the-configuration-block
        tex: {
          macros: {
            // Implements support for the \bm command from the bm package. It bolds the argument in math mode.
            // https://github.com/mathjax/MathJax/issues/1219#issuecomment-341059843
            bm: ['\\boldsymbol{#1}', 1],
          },
          inlineMath,
          displayMath: [
            ['\\[', '\\]'],
            ['$$', '$$'],
          ],
          packages: {
            '[-]': [
              'html', // avoid creating HTML elements/attributes
              'require', // prevent loading disabled packages
              'textmacros', // text macros are loaded by default in v4, disable them
            ],
          },
          processEscapes: true,
          processEnvironments: true,
          useLabelIds: options.useLabelIds,
        },
        output: {
          displayOverflow: 'linebreak',
        },
        loader: {
          load: [
            'ui/safe', // https://docs.mathjax.org/en/latest/options/safe.html
          ],
        },
        options: {
          enableMenu: options.enableMenu, // https://docs.mathjax.org/en/latest/options/menu.html
        },
        startup: {
          typeset: false,
          pageReady() {
            // disable the "Math Renderer" option in the context menu, as only SVG is available
            window.MathJax.startup.document.menu.menu
              .findID('Settings', 'Renderer')
              .disable()
          },
          async ready() {
            // use a custom tags factory to avoid a "\multiple label" error
            // in align environments when labels have no tags
            // https://github.com/mathjax/MathJax/issues/3572#issuecomment-4771577206
            if (options?.numbering === TAGS_NONE_REMOVED) {
              const { AbstractTags, TagsFactory } =
                window.MathJax._.input.tex.Tags

              class NoLabelTags extends AbstractTags {
                autoTag() {}
                getTag() {
                  const tag = this.currentTag.tag ? super.getTag() : null
                  this.label = ''
                  return tag
                }
              }

              TagsFactory.add(TAGS_NONE_REMOVED, NoLabelTags)
            }

            await window.MathJax.startup.defaultReady()

            // remove anything from the "font-family" attribute after a semicolon
            // so it's not added to the style attribute
            // https://github.com/mathjax/MathJax/issues/3129#issuecomment-1807225345
            const { safe } = window.MathJax.startup.document
            safe.filterAttributes.set('fontfamily', 'filterFontFamily')
            safe.filterMethods.filterFontFamily = (
              _safe: any,
              family: string
            ) => {
              return family.split(/;/)[0]
            }
          },
        },
      }

      // "tags" set separately as tags: undefined throws an error
      if (options.numbering) {
        window.MathJax.tex.tags = options.numbering
      }

      // if the menu is disabled, disable all the accessibility features, for performance
      // https://docs.mathjax.org/en/stable/options/accessibility.html#accessibility-extensions-options
      if (!options.enableMenu) {
        window.MathJax.options.menuOptions = {
          settings: {
            enrich: false,
            speech: false,
            braille: false,
            assistiveMml: false,
          },
        }
      }

      const script = document.createElement('script')
      const path = getMeta('ol-mathJaxPath')
      if (!path) {
        reject(new Error('No MathJax path found'))
        return
      }
      script.src = path
      script.addEventListener('load', async () => {
        await window.MathJax.startup.promise
        document.head.appendChild(window.MathJax.svgStylesheet())
        resolve(window.MathJax)
      })
      script.addEventListener('error', reject)
      document.head.append(script)
    })
  }

  return mathJaxPromise
}
