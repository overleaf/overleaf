# latex-log-parser

A set of parsers for Latex logs.


## Usage

Each parser is provided by a requirejs module, found in the `dist` directory. Each parser exposes a `parse` method which takes a
text string (representing the log to be parsed) and an options object.

Example:

```javascript
define([
	'path/to/latex-log-parser'
], function(LatexLogParser) {
	var logText = "...";
	var logEntries = LatexLogParser.parse(logText, {ignoreDuplicates: true});
});

```


## Build

First install dependencies:

```bash
$ npm install
```

Then run the compile npm task: `npm run-script compile`

Then the compiled modules will appear in the `dist` directory


## Testing

The test are in `tests/tests.js`, to run them launch a http-server of
some kind from the root directory of this project, then visit `/tests` in a web browser.
Example:

```bash
$ npm install -g http-server
$ http-server
$ # now visit http://localhost:8080/tests in a browser
```
