import getMeta from '../../utils/meta'

let mathJaxPromise: Promise<typeof window.MathJax>

export const loadMathJax = async (options?: {
  enableMenu?: boolean
  numbering?: string
  singleDollar?: boolean
  useLabelIds?: boolean
}) => {
  if (!mathJaxPromise) {
    mathJaxPromise = new Promise((resolve, reject) => {
      options = {
        enableMenu: false,
        singleDollar: true,
        useLabelIds: false,
        ...options,
      }

      const inlineMath = [['\\(', '\\)']]
      if (options.singleDollar) {
        inlineMath.push(['$', '$'])
      }

      // https://docs.mathjax.org/en/v3.2-latest/upgrading/v2.html
      window.MathJax = {
        // https://docs.mathjax.org/en/latest/options/input/tex.html#the-configuration-block
        tex: {
          macros: {
            // Implements support for the \bm command from the bm package. It bolds the argument in math mode.
            // https://github.com/mathjax/MathJax/issues/1219#issuecomment-341059843
            bm: ['\\boldsymbol{#1}', 1],
            // MathJax 3 renders \coloneq as :- whereas the mathtools package
            // renders it as :=. Here we override the \coloneq macro to produce
            // the := symbol.
            coloneq: '\\coloneqq',
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
            ],
          },
          processEscapes: true,
          processEnvironments: true,
          useLabelIds: options.useLabelIds,
          tags: options.numbering,
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
            // disable the "Math Renderer" option in the context menu,
            // as only SVG is available
            window.MathJax.startup.document.menu.menu
              .findID('Renderer')
              .disable()
          },
          ready() {
            window.MathJax.startup.defaultReady()

            // remove anything from the "font-family" attribute after a semicolon
            // so it's not added to the style attribute
            // https://github.com/mathjax/MathJax/issues/3129#issuecomment-1807225345
            const { safe } = window.MathJax.startup.document
            safe.filterAttributes.set('fontfamily', 'filterFontFamily')
            safe.filterMethods.filterFontFamily = (
              _safe: any,
              family: string
            ) => family.split(/;/)[0]
          },
        },
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
