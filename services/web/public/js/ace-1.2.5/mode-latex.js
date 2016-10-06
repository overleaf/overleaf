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


var Mode = function() {
    this.HighlightRules = LatexHighlightRules;
    this.foldingRules = new LatexFoldMode();
    this.createWorker = function(session) {
	var doc = session.getDocument();
	var selection = session.getSelection();

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
	    if(suppressions.length > 0) {
		changeHandler = setTimeout(function () {
		    updateMarkers();
		    suppressions = [];
		    changeHandler = null;
		}, 100);
	    }
	});

	var updateMarkers = function () {
	    var annotations = [];
	    var newRange = {};
	    var cursor = selection.getCursor();
	    suppressions = [];

	    for (var i = 0; i<hints.length; i++) {
		var data = hints[i];
		var start_row = data.start_row;
		var start_col = data.start_col;
		var end_row = data.end_row;
		var end_col = data.end_col;
		if (data.suppressIfEditing &&
		    ((cursor.row === start_row && cursor.column == start_col+1)
		     || (cursor.row === end_row && (cursor.column+1) == end_col))) {
		    suppressions.push([start_row, start_col, end_row, end_col]);
		    continue;
		}
		var suppress = false;
		for (var j = 0; j < suppressions.length; j++) {
		    var e=suppressions[j];
		    var fromRow=e[0], fromCol=e[1], toRow=e[2], toCol=e[3];
		    if (start_row == fromRow && start_col >= fromCol && start_row === toRow  && start_col <= toCol) {
			suppress = true;
			break;
		    }
		}
		if(suppress) { continue; };

		var key = "(" + start_row + "," + start_col + ")" + ":" + "(" + end_row + "," + end_col + ")";
		newRange[key] = data;
		annotations.push(data);
	    }

	    var newKeys = Object.keys(newRange);
	    var oldKeys = Object.keys(savedRange);
	    var changes = 0;
	    for (i = 0; i < newKeys.length; i++) {
		key = newKeys[i];
		if (!savedRange[key]) {
		    var new_range = newRange[key];
		    var a = doc.createAnchor(new_range.start_row, new_range.start_col);
		    var b = doc.createAnchor(new_range.end_row, new_range.end_col);
		    var range = new Range();
		    range.start = a;
		    range.end = b;
		    range.id = session.addMarker(range, "ace_error-marker", "text");
		    savedRange[key] = range;
		    changes++;
		}
	    }

	    for (i = 0; i < oldKeys.length; i++) {
		key = oldKeys[i];
		if (!newRange[key]) {
		    range = savedRange[key];
		    range.start.detach();
		    range.end.detach();
		    session.removeMarker(range.id);
		    delete savedRange[key];
		    changes++;
		}
	    }

	    if (changes>0) {
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
	    var oldKeys = Object.keys(savedRange);
	    for (var i = 0; i < oldKeys.length; i++) {
		var key = oldKeys[i];
		var range = savedRange[key];
		session.removeMarker(range.id);
		delete savedRange[key];
	    }

	});
	return worker;
    };
};
oop.inherits(Mode, TextMode);

(function() {
    this.type = "text";

    this.lineCommentStart = "%";

    this.$id = "ace/mode/latex";
}).call(Mode.prototype);

exports.Mode = Mode;

});
