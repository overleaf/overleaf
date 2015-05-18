[![Build Status](https://travis-ci.org/jacomyal/sigma.js.png)](https://travis-ci.org/jacomyal/sigma.js)

sigma.js - v1.0.3
=================

Sigma is a JavaScript library dedicated to graph drawing.

### Resources

[The website](http://sigmajs.org) provides a global overview of the project, and the documentation is available in the [Github Wiki](https://github.com/jacomyal/sigma.js/wiki).

Also, the `plugins` and `examples` directories contain some various use-cases, that might help you understanding how to use sigma.

### How to use it

To use it, clone the repository:

```
git clone git@github.com:jacomyal/sigma.js.git
```

To build the code:

 - Install [Node.js](http://nodejs.org/).
 - Install [gjslint](https://developers.google.com/closure/utilities/docs/linter_howto?hl=en).
 - Use `npm install` to install sigma development dependencies.
 - Use `npm run build` to minify the code with [Uglify](https://github.com/mishoo/UglifyJS). The minified file `sigma.min.js` will then be accessible in the `build/` folder.

Also, you can customize the build by adding or removing files from the `coreJsFiles` array in `Gruntfile.js` before applying the grunt task.

### Contributing

You can contribute by submitting [issues tickets](http://github.com/jacomyal/sigma.js/issues) and proposing [pull requests](http://github.com/jacomyal/sigma.js/pulls). Make sure that tests and linting pass before submitting any pull request by running the command `grunt`.

The whole source code is validated by the [Google Closure Linter](https://developers.google.com/closure/utilities/) and [JSHint](http://www.jshint.com/), and the comments are written in [JSDoc](http://en.wikipedia.org/wiki/JSDoc) (tags description is available [here](https://developers.google.com/closure/compiler/docs/js-for-compiler)).
