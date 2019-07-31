/* eslint-disable
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const fs = require('fs')
const PackageVersions = require('./app/src/infrastructure/PackageVersions')
const Settings = require('settings-sharelatex')
require('es6-promise').polyfill()

module.exports = function(grunt) {
  grunt.loadNpmTasks('grunt-contrib-requirejs')
  grunt.loadNpmTasks('grunt-file-append')

  const config = {
    requirejs: {
      compile: {
        options: {
          optimize: 'uglify2',
          appDir: 'public/js',
          baseUrl: './',
          dir: 'public/minjs',
          inlineText: false,
          generateSourceMaps: true,
          preserveLicenseComments: false,
          paths: {
            moment: `libs/${PackageVersions.lib('moment')}`,
            mathjax: '/js/libs/mathjax/MathJax.js?config=TeX-AMS_HTML',
            'pdfjs-dist/build/pdf': `libs/${PackageVersions.lib('pdfjs')}/pdf`,
            ace: `${PackageVersions.lib('ace')}`,
            fineuploader: `libs/${PackageVersions.lib('fineuploader')}`,
            recurly: 'https://js.recurly.com/v4/recurly'
          },

          skipDirOptimize: true,
          modules: [
            {
              name: 'main',
              exclude: ['libraries']
            },
            {
              name: 'ide',
              exclude: ['pdfjs-dist/build/pdf', 'libraries']
            },
            {
              name: 'libraries'
            },
            {
              name: 'ace/mode-latex'
            },
            {
              name: 'ace/worker-latex'
            }
          ]
        }
      }
    },

    file_append: {
      default_options: {
        files: [
          {
            append: '\n//ide.js is complete - used for automated testing',
            input: 'public/minjs/ide.js',
            output: 'public/minjs/ide.js'
          }
        ]
      }
    }
  }

  grunt.initConfig(config)
  return grunt.registerTask(
    'compile:minify',
    'Concat and minify the client side js',
    ['requirejs', 'file_append']
  )
}
