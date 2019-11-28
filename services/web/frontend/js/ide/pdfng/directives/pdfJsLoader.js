/*
 * Adapted from https://github.com/mozilla/pdfjs-dist/blob/e9492b7a725ec4edd466880223474f4295a5fb45/webpack.js
 * The PDF.js worker needs to be loaded in a Web Worker. This can be done
 * automatically with webpack via worker-loader.
 * PDF.js has the above file to do this, however it uses the webpack loader
 * module loading syntax, which prevents us from customising the loader.
 * We need to output the worker file to the public/js directory, and so we need
 * to customise the loader's options. However the rest of the file is identical
 * to the one provided by PDF.js.
 */
var pdfjs = require('pdfjs-dist/build/pdf.js')
var PdfjsWorker = require('pdfjs-dist/build/pdf.worker.js')

if (typeof window !== 'undefined' && 'Worker' in window) {
  pdfjs.GlobalWorkerOptions.workerPort = new PdfjsWorker()
}

module.exports = pdfjs
