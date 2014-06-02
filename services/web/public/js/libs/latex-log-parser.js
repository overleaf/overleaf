define(function() {
    // Define some constants
    var LOG_WRAP_LIMIT = 79;
    var LATEX_WARNING_REGEX = /^LaTeX Warning: (.*)$/;
    var HBOX_WARNING_REGEX = /^(Over|Under)full \\(v|h)box/;
    var BIBER_WARNING_REGEX = /^Package biblatex Warning: (.*)$/;
    var NATBIB_WARNING_REGEX = /^Package natbib Warning: (.*)$/;
    // This is used to parse the line number from common latex warnings
    var LINES_REGEX = /lines? ([0-9]+)/;

    var LogText = function(text) {
        this.text = text.replace(/(\r\n)|\r/g, "\n");

        // Join any lines which look like they have wrapped.
        var wrappedLines = this.text.split("\n");
        this.lines = [wrappedLines[0]];
        for (var i = 1; i < wrappedLines.length; i++) {
            // If the previous line is as long as the wrap limit then 
            // append this line to it.
            // Some lines end with ... when LaTeX knows it's hit the limit
            // These shouldn't be wrapped.
            if (wrappedLines[i-1].length == LOG_WRAP_LIMIT && wrappedLines[i-1].slice(-3) != "...") {
                this.lines[this.lines.length - 1] += wrappedLines[i];
            } else {
                this.lines.push(wrappedLines[i]);
            }
        }

        this.row = 0;
    };

    (function() {
        this.nextLine = function() {
            this.row++;
            if (this.row >= this.lines.length) {
                return false;
            } else {
                return this.lines[this.row];
            }
        };

        this.rewindLine = function() {
            this.row--;
        };

        this.linesUpToNextWhitespaceLine = function() {
            return this.linesUpToNextMatchingLine(/^ *$/);
        };

        this.linesUpToNextMatchingLine = function(match) {
            var lines = [];
            var nextLine = this.nextLine();
            if (nextLine !== false) {
                lines.push(nextLine);
            }
            while (nextLine !== false && !nextLine.match(match) && nextLine !== false) {
                nextLine = this.nextLine();
                if (nextLine !== false) {
                    lines.push(nextLine);
                }
            }
            return lines;
        }
    }).call(LogText.prototype);

    var state = {
        NORMAL : 0,
        ERROR  : 1
    };

    var LatexParser = function(text, options) {
        this.log = new LogText(text);
        this.state = state.NORMAL;

        options = options || {};
        this.fileBaseNames = options.fileBaseNames || [/compiles/, /\/usr\/local/];
        this.ignoreDuplicates = options.ignoreDuplicates;

        this.data  = [];
        this.fileStack = [];
        this.currentFileList = this.rootFileList = [];

        this.openParens = 0;
    };

    (function() {
        this.parse = function() {
            while ((this.currentLine = this.log.nextLine()) !== false) {
                if (this.state == state.NORMAL) {
                    if (this.currentLineIsError()) {
                        this.state = state.ERROR;
                        this.currentError = {
                            line        : null,
                            file        : this.currentFilePath,
                            level       : "error",
                            message     : this.currentLine.slice(2),
                            content     : "",
                            raw         : this.currentLine + "\n"
                        }
                    } else if (this.currentLineIsWarning()) {
                        this.parseSingleWarningLine(LATEX_WARNING_REGEX);
                    } else if (this.currentLineIsHboxWarning()) {
                        this.parseHboxLine();
                    } else if (this.currentLineIsBiberWarning()) {
                        this.parseBiberWarningLine();
                    } else if (this.currentLineIsNatbibWarning()) {
                        this.parseSingleWarningLine(NATBIB_WARNING_REGEX);
                    } else {
                        this.parseParensForFilenames();
                    }
                }

                if (this.state == state.ERROR) {
                    this.currentError.content += this.log.linesUpToNextMatchingLine(/^l\.[0-9]+/).join("\n");
                    this.currentError.content += "\n";
                    this.currentError.content += this.log.linesUpToNextWhitespaceLine().join("\n");
                    this.currentError.content += "\n";
                    this.currentError.content += this.log.linesUpToNextWhitespaceLine().join("\n");

                    this.currentError.raw += this.currentError.content;

                    var lineNo = this.currentError.raw.match(/l\.([0-9]+)/);
                    if (lineNo) {
                        this.currentError.line = parseInt(lineNo[1], 10);
                    }

                    this.data.push(this.currentError);
                    this.state = state.NORMAL;
                }
            }

            return this.postProcess(this.data);
        };

        this.currentLineIsError = function() {
            return this.currentLine[0] == "!";
        };

        this.currentLineIsWarning = function() {
            return !!(this.currentLine.match(LATEX_WARNING_REGEX));
        };

        this.currentLineIsBiberWarning = function () {
            return !!(this.currentLine.match(BIBER_WARNING_REGEX));
        };

        this.currentLineIsNatbibWarning = function () {
            return !!(this.currentLine.match(NATBIB_WARNING_REGEX));
        };

        this.currentLineIsHboxWarning = function() {
            return !!(this.currentLine.match(HBOX_WARNING_REGEX));
        };

        this.parseSingleWarningLine = function(prefix_regex) {
            var warningMatch = this.currentLine.match(prefix_regex);
            if (!warningMatch) return;
            var warning = warningMatch[1];

            var lineMatch = warning.match(LINES_REGEX);
            var line = lineMatch ? parseInt(lineMatch[1], 10) : null;

            this.data.push({
                line    : line,
                file    : this.currentFilePath,
                level   : "warning",
                message : warning,
                raw     : warning
            });
        };

        this.parseBiberWarningLine = function() {
            // Biber warnings are multiple lines, let's parse the first line
            var warningMatch = this.currentLine.match(BIBER_WARNING_REGEX);
            if (!warningMatch) return;  // Something strange happened, return early

            // Now loop over the other output and just grab the message part
            // Each line is prefiex with: (biblatex)
            var warning_lines = [warningMatch[1]];
            while (((this.currentLine = this.log.nextLine()) !== false) &&
                (warningMatch = this.currentLine.match(/^\(biblatex\)[\s]+(.*)$/))) {
                warning_lines.push(warningMatch[1])
            }

            var raw_message = warning_lines.join(' ');
            this.data.push({
                line    : null,  // Unfortunately, biber doesn't return a line number
                file    : this.currentFilePath,
                level   : "warning",
                message : raw_message,
                raw     : raw_message
            });
        };

        this.parseHboxLine = function() {
            var lineMatch = this.currentLine.match(LINES_REGEX);
            var line = lineMatch ? parseInt(lineMatch[1], 10) : null;

            this.data.push({
                line    : line,
                file    : this.currentFilePath,
                level   : "typesetting",
                message : this.currentLine,
                raw     : this.currentLine
            });
        };

        // Check if we're entering or leaving a new file in this line
        this.parseParensForFilenames = function() {
            var pos = this.currentLine.search(/\(|\)/);

            if (pos != -1) {
                var token = this.currentLine[pos];
                this.currentLine = this.currentLine.slice(pos + 1);

                if (token == "(") {
                    var filePath = this.consumeFilePath();
                    if (filePath) {
                        this.currentFilePath = filePath;

                        var newFile = {
                            path : filePath,
                            files : []
                        };
                        this.fileStack.push(newFile);
                        this.currentFileList.push(newFile);
                        this.currentFileList = newFile.files;
                    } else {
                        this.openParens++;
                    }
                } else if (token == ")") {
                    if (this.openParens > 0) {
                        this.openParens--;
                    } else {
                        if (this.fileStack.length > 1) {
                            this.fileStack.pop();
                            var previousFile = this.fileStack[this.fileStack.length - 1];
                            this.currentFilePath = previousFile.path;
                            this.currentFileList = previousFile.files;
                        }
                        // else {
                        //     Something has gone wrong but all we can do now is ignore it :(
                        // }
                    }
                }

                // Process the rest of the line
                this.parseParensForFilenames();
            }
        };

        this.consumeFilePath = function() {
            // Our heuristic for detecting file names are rather crude
            // A file may not contain a space, or ) in it
            // To be a file path it must have at least one /
            if (!this.currentLine.match(/^\/?([^ \)]+\/)+/)) {
                return false;
            }

            var endOfFilePath = this.currentLine.search(/ |\)/);
            var path;
            if (endOfFilePath == -1) {
                path = this.currentLine;
                this.currentLine = "";
            } else {
                path = this.currentLine.slice(0, endOfFilePath);
                this.currentLine = this.currentLine.slice(endOfFilePath);
            }

            return path;
        };

        this.postProcess = function(data) {
            var all         = [];
            var errors      = [];
            var warnings    = [];
            var typesetting = [];

            var hashes = [];

            function hashEntry(entry) {
                return entry.raw;
            }

            for (var i = 0; i < data.length; i++) {
                if (this.ignoreDuplicates && hashes.indexOf(hashEntry(data[i])) > -1) {
                    continue;
                }

                if (data[i].level == "error") {
                    errors.push(data[i]);
                } else if (data[i].level == "typesetting") {
                    typesetting.push(data[i]);
                } else if (data[i].level == "warning") {
                    warnings.push(data[i]);
                }

                all.push(data[i]);
                hashes.push(hashEntry(data[i]));
            }

            return {
              errors      : errors,
              warnings    : warnings,
              typesetting : typesetting,
              all         : all,
              files       : this.rootFileList
            }
        }
    }).call(LatexParser.prototype);

    LatexParser.parse = function(text, options) {
        return (new LatexParser(text, options)).parse()
    };

    return LatexParser;
});
