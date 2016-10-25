ace.define("ace/mode/latex_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

var LatexHighlightRules = function() {  

    this.$rules = {
        "start" : [{
            token : "comment",
            regex : "%.*$"
        }, {
            token : ["keyword", "lparen", "variable.parameter", "rparen", "lparen", "storage.type", "rparen"],
            regex : "(\\\\(?:documentclass|usepackage|input))(?:(\\[)([^\\]]*)(\\]))?({)([^}]*)(})"
        }, {
            token : ["keyword","lparen", "variable.parameter", "rparen"],
            regex : "(\\\\(?:label|v?ref|cite(?:[^{]*)))(?:({)([^}]*)(}))?"
        }, {
            token : ["storage.type", "lparen", "variable.parameter", "rparen"],
            regex : "(\\\\(?:begin|end))({)(\\w*)(})"
        }, {
            token : "storage.type",
            regex : "\\\\[a-zA-Z]+"
        }, {
            token : "lparen",
            regex : "[[({]"
        }, {
            token : "rparen",
            regex : "[\\])}]"
        }, {
            token : "constant.character.escape",
            regex : "\\\\[^a-zA-Z]?"
        }, {
            token : "string",
            regex : "\\${1,2}",
            next  : "equation"
        }],
        "equation" : [{
            token : "comment",
            regex : "%.*$"
        }, {
            token : "string",
            regex : "\\${1,2}",
            next  : "start"
        }, {
            token : "constant.character.escape",
            regex : "\\\\(?:[^a-zA-Z]|[a-zA-Z]+)"
        }, {
            token : "error", 
            regex : "^\\s*$", 
            next : "start" 
        }, {
            defaultToken : "string"
        }]

    };
};
oop.inherits(LatexHighlightRules, TextHighlightRules);

exports.LatexHighlightRules = LatexHighlightRules;

});

ace.define("ace/mode/folding/latex",["require","exports","module","ace/lib/oop","ace/mode/folding/fold_mode","ace/range","ace/token_iterator"], function(require, exports, module) {
"use strict";

var oop = require("../../lib/oop");
var BaseFoldMode = require("./fold_mode").FoldMode;
var Range = require("../../range").Range;
var TokenIterator = require("../../token_iterator").TokenIterator;

var FoldMode = exports.FoldMode = function() {};

oop.inherits(FoldMode, BaseFoldMode);

(function() {

    this.foldingStartMarker = /^\s*\\(begin)|(section|subsection|paragraph)\b|{\s*$/;
    this.foldingStopMarker = /^\s*\\(end)\b|^\s*}/;

    this.getFoldWidgetRange = function(session, foldStyle, row) {
        var line = session.doc.getLine(row);
        var match = this.foldingStartMarker.exec(line);
        if (match) {
            if (match[1])
                return this.latexBlock(session, row, match[0].length - 1);
            if (match[2])
                return this.latexSection(session, row, match[0].length - 1);

            return this.openingBracketBlock(session, "{", row, match.index);
        }

        var match = this.foldingStopMarker.exec(line);
        if (match) {
            if (match[1])
                return this.latexBlock(session, row, match[0].length - 1);

            return this.closingBracketBlock(session, "}", row, match.index + match[0].length);
        }
    };

    this.latexBlock = function(session, row, column) {
        var keywords = {
            "\\begin": 1,
            "\\end": -1
        };

        var stream = new TokenIterator(session, row, column);
        var token = stream.getCurrentToken();
        if (!token || !(token.type == "storage.type" || token.type == "constant.character.escape"))
            return;

        var val = token.value;
        var dir = keywords[val];

        var getType = function() {
            var token = stream.stepForward();
            var type = token.type == "lparen" ?stream.stepForward().value : "";
            if (dir === -1) {
                stream.stepBackward();
                if (type)
                    stream.stepBackward();
            }
            return type;
        };
        var stack = [getType()];
        var startColumn = dir === -1 ? stream.getCurrentTokenColumn() : session.getLine(row).length;
        var startRow = row;

        stream.step = dir === -1 ? stream.stepBackward : stream.stepForward;
        while(token = stream.step()) {
            if (!token || !(token.type == "storage.type" || token.type == "constant.character.escape"))
                continue;
            var level = keywords[token.value];
            if (!level)
                continue;
            var type = getType();
            if (level === dir)
                stack.unshift(type);
            else if (stack.shift() !== type || !stack.length)
                break;
        }

        if (stack.length)
            return;

        var row = stream.getCurrentTokenRow();
        if (dir === -1)
            return new Range(row, session.getLine(row).length, startRow, startColumn);
        stream.stepBackward();
        return new Range(startRow, startColumn, row, stream.getCurrentTokenColumn());
    };

    this.latexSection = function(session, row, column) {
        var keywords = ["\\subsection", "\\section", "\\begin", "\\end", "\\paragraph"];

        var stream = new TokenIterator(session, row, column);
        var token = stream.getCurrentToken();
        if (!token || token.type != "storage.type")
            return;

        var startLevel = keywords.indexOf(token.value);
        var stackDepth = 0
        var endRow = row;

        while(token = stream.stepForward()) {
            if (token.type !== "storage.type")
                continue;
            var level = keywords.indexOf(token.value);

            if (level >= 2) {
                if (!stackDepth)
                    endRow = stream.getCurrentTokenRow() - 1;
                stackDepth += level == 2 ? 1 : - 1;
                if (stackDepth < 0)
                    break
            } else if (level >= startLevel)
                break;
        }

        if (!stackDepth)
            endRow = stream.getCurrentTokenRow() - 1;

        while (endRow > row && !/\S/.test(session.getLine(endRow)))
            endRow--;

        return new Range(
            row, session.getLine(row).length,
            endRow, session.getLine(endRow).length
        );
    };

}).call(FoldMode.prototype);

});

ace.define("ace/mode/latex",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/latex_highlight_rules","ace/mode/folding/latex","ace/range","ace/worker/worker_client"], function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextMode = require("./text").Mode;
var LatexHighlightRules = require("./latex_highlight_rules").LatexHighlightRules;
var LatexFoldMode = require("./folding/latex").FoldMode;
var Range = require("../range").Range;
var WorkerClient = require("ace/worker/worker_client").WorkerClient;

var createLatexWorker = function (session) {
    var doc = session.getDocument();
    var selection = session.getSelection();
    var cursorAnchor = selection.lead;

    var savedRange = {};
    var suppressions = [];
    var hints = [];
    var changeHandler = null;

    var worker = new WorkerClient(["ace"], "ace/mode/latex_worker", "LatexWorker");
    worker.attachToDocument(doc);

    doc.on("change", function () {
        if(changeHandler) {
            clearTimeout(changeHandler);
            changeHandler = null;
        }
    });

    selection.on("changeCursor", function () {
        changeHandler = setTimeout(function () {
            updateMarkers({cursorMoveOnly:true});
            suppressions = [];
            changeHandler = null;
        }, 100);
    });

    var updateMarkers = function (options) {
        if (!options) { options = {};};
        var cursorMoveOnly = options.cursorMoveOnly;
        var annotations = [];
        var newRange = {};
        var cursor = selection.getCursor();
        suppressions = [];

        for (var i = 0, len = hints.length; i<len; i++) {
            var hint = hints[i];

            var suppressedChanges = 0;
            var hintRange = new Range(hint.start_row, hint.start_col, hint.end_row, hint.end_col);

            var cursorInRange = hintRange.insideStart(cursor.row, cursor.column);
            var cursorAtStart = hintRange.isStart(cursor.row, cursor.column);
            var cursorAtEnd = hintRange.isEnd(cursor.row, cursor.column);
            if (hint.suppressIfEditing && (cursorAtStart || cursorAtEnd)) {
                suppressions.push(hintRange);
                if (!hint.suppressed) { suppressedChanges++; };
                hint.suppressed = true;
                continue;
            }
            var isCascadeError = false;
            for (var j = 0, suplen = suppressions.length; j < suplen; j++) {
                var badRange = suppressions[j];
                if (badRange.intersects(hintRange)) {
                    isCascadeError = true;
                    break;
                }
            }
            if(isCascadeError) {
                if (!hint.suppressed) { suppressedChanges++; };
                hint.suppressed = true;
                continue;
            };

            if (hint.suppressed) { suppressedChanges++; };
            hint.suppressed = false;

            annotations.push(hint);
            if (hint.type === "info") {
                continue;
            };
            var key = hintRange.toString() + (cursorInRange ? "+cursor" : "");
            newRange[key] = {hint: hint, cursorInRange: cursorInRange, range: hintRange};
        }
        for (key in newRange) {
            if (!savedRange[key]) {  // doesn't exist in already displayed errors
                var new_range = newRange[key].range;
                cursorInRange = newRange[key].cursorInRange;
                hint = newRange[key].hint;
                var errorAtStart = (hint.row === hint.start_row && hint.column === hint.start_col);
                var a = (cursorInRange && !errorAtStart) ? cursorAnchor : doc.createAnchor(new_range.start);
                var b = (cursorInRange && errorAtStart) ? cursorAnchor : doc.createAnchor(new_range.end);
                var range = new Range();
                range.start = a;
                range.end = b;
                var cssClass = "ace_error-marker";
                if (hint.type === "warning") { cssClass = "ace_highlight-marker"; };
                range.id = session.addMarker(range, cssClass, "text");
                savedRange[key] = range;
            }
        }
        for (key in savedRange) {
            if (!newRange[key]) {  // no longer present in list of errors to display
                range = savedRange[key];
                if (range.start !== cursorAnchor) { range.start.detach(); }
                if (range.end !== cursorAnchor) { range.end.detach(); }
                session.removeMarker(range.id);
                delete savedRange[key];
            }
        }
        if (!cursorMoveOnly || suppressedChanges) {
            session.setAnnotations(annotations);
        };

    };
    worker.on("lint", function(results) {
        hints = results.data;
        if (hints.length > 100) {
            hints = hints.slice(0, 100); // limit to 100 errors
        };
        updateMarkers();
    });
    worker.on("terminate", function() {
        for (var key in savedRange) {
            var range = savedRange[key];
            range.start.detach();
            range.end.detach();
            session.removeMarker(range.id);
            delete savedRange[key];
        }

    });

    return worker;
};

var Mode = function() {
    this.HighlightRules = LatexHighlightRules;
    this.foldingRules = new LatexFoldMode();
    this.createWorker = createLatexWorker;
};
oop.inherits(Mode, TextMode);

(function() {
    this.type = "text";

    this.lineCommentStart = "%";

    this.$id = "ace/mode/latex";
}).call(Mode.prototype);

exports.Mode = Mode;

});
