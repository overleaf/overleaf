ace.define("ace/mode/lucene_highlight_rules",[], function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

var LuceneHighlightRules = function() {
    this.$rules = {
        "start" : [
            {
                token: "constant.language.escape",
                regex: /\\[\-+&|!(){}\[\]^"~*?:\\]/
            }, {
                token: "constant.character.negation",
                regex: "\\-"
            }, {
                token: "constant.character.interro",
                regex: "\\?"
            }, {
                token: "constant.character.required",
                regex: "\\+"
            }, {
                token: "constant.character.asterisk",
                regex: "\\*"
            }, {
                token: 'constant.character.proximity',
                regex: '~(?:0\\.[0-9]+|[0-9]+)?'
            }, {
                token: 'keyword.operator',
                regex: '(AND|OR|NOT|TO)\\b'
            }, {
                token: "paren.lparen",
                regex: "[\\(\\{\\[]"
            }, {
                token: "paren.rparen",
                regex: "[\\)\\}\\]]"
            }, {
                token: "keyword.operator",
                regex: /[><=^]/
            }, {
                token: "constant.numeric",
                regex: /\d[\d.-]*/
            }, {
                token: "string",
                regex: /"(?:\\"|[^"])*"/
            }, {
                token: "keyword",
                regex: /(?:\\.|[^\s\-+&|!(){}\[\]^"~*?:\\])+:/,
                next: "maybeRegex"
            }, {
                token: "term",
                regex: /\w+/
            }, {
                token: "text",
                regex: /\s+/
            }
        ],
        "maybeRegex": [{
            token: "text",
            regex: /\s+/
        }, {
            token: "string.regexp.start",
            regex: "/",
            next: "regex"
        }, {
            regex: "",
            next: "start"
        }],
        "regex": [
            {
                token: "regexp.keyword.operator",
                regex: "\\\\(?:u[\\da-fA-F]{4}|x[\\da-fA-F]{2}|.)"
            }, {
                token: "string.regexp.end",
                regex: "/[sxngimy]*",
                next: "no_regex"
            }, {
                token : "invalid",
                regex: /\{\d+\b,?\d*\}[+*]|[+*$^?][+*]|[$^][?]|\?{3,}/
            }, {
                token : "constant.language.escape",
                regex: /\(\?[:=!]|\)|\{\d+\b,?\d*\}|[+*]\?|[()$^+*?.]/
            }, {
                token: "constant.language.escape",
                regex: "<\d+-\d+>|[~&@]"
            }, {
                token : "constant.language.delimiter",
                regex: /\|/
            }, {
                token: "constant.language.escape",
                regex: /\[\^?/,
                next: "regex_character_class"
            }, {
                token: "empty",
                regex: "$",
                next: "no_regex"
            }, {
                defaultToken: "string.regexp"
            }
        ],
        "regex_character_class": [
            {
                token: "regexp.charclass.keyword.operator",
                regex: "\\\\(?:u[\\da-fA-F]{4}|x[\\da-fA-F]{2}|.)"
            }, {
                token: "constant.language.escape",
                regex: "]",
                next: "regex"
            }, {
                token: "constant.language.escape",
                regex: "-"
            }, {
                token: "empty",
                regex: "$",
                next: "no_regex"
            }, {
                defaultToken: "string.regexp.charachterclass"
            }
        ]
    };
};

oop.inherits(LuceneHighlightRules, TextHighlightRules);

exports.LuceneHighlightRules = LuceneHighlightRules;
});

ace.define("ace/mode/lucene",[], function(require, exports, module) {
'use strict';

var oop = require("../lib/oop");
var TextMode = require("./text").Mode;
var LuceneHighlightRules = require("./lucene_highlight_rules").LuceneHighlightRules;

var Mode = function() {
    this.HighlightRules = LuceneHighlightRules;
    this.$behaviour = this.$defaultBehaviour;
};

oop.inherits(Mode, TextMode);

(function() {
    this.$id = "ace/mode/lucene";
}).call(Mode.prototype);

exports.Mode = Mode;
});
                (function() {
                    ace.require(["ace/mode/lucene"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            