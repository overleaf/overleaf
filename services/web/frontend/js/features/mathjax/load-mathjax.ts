import getMeta from '../../utils/meta'

let mathJaxPromise: Promise<typeof window.MathJax>

export const loadMathJax = async () => {
  if (!mathJaxPromise) {
    mathJaxPromise = new Promise((resolve, reject) => {
      // https://docs.mathjax.org/en/v3.2-latest/upgrading/v2.html
      window.MathJax = {
        // https://docs.mathjax.org/en/latest/options/input/tex.html#the-configuration-block
        tex: {
          inlineMath: [
            ['\\(', '\\)'],
            ['$', '$'],
          ],
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
        },
        loader: {
          load: [
            'ui/safe', // https://docs.mathjax.org/en/latest/options/safe.html
          ],
        },
        options: {
          enableMenu: false, // https://docs.mathjax.org/en/latest/options/menu.html
        },
        startup: {
          typeset: false,
        },
      }

      const script = document.createElement('script')
      script.src = getMeta('ol-mathJax3Path')
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
