ace.define("ace/mode/ruby_highlight_rules",[], function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;
var constantOtherSymbol = exports.constantOtherSymbol = {
    token : "constant.other.symbol.ruby", // symbol
    regex : "[:](?:[A-Za-z_]|[@$](?=[a-zA-Z0-9_]))[a-zA-Z0-9_]*[!=?]?"
};

exports.qString = {
    token : "string", // single line
    regex : "['](?:(?:\\\\.)|(?:[^'\\\\]))*?[']"
};

exports.qqString = {
    token : "string", // single line
    regex : '["](?:(?:\\\\.)|(?:[^"\\\\]))*?["]'
};

exports.tString = {
    token : "string", // backtick string
    regex : "[`](?:(?:\\\\.)|(?:[^'\\\\]))*?[`]"
};

var constantNumericHex = exports.constantNumericHex = {
    token : "constant.numeric", // hex
    regex : "0[xX][0-9a-fA-F](?:[0-9a-fA-F]|_(?=[0-9a-fA-F]))*\\b"
};

var constantNumericBinary = exports.constantNumericBinary = {
    token: "constant.numeric",
    regex: /\b(0[bB][01](?:[01]|_(?=[01]))*)\b/
};

var constantNumericDecimal = exports.constantNumericDecimal = {
    token: "constant.numeric",
    regex: /\b(0[dD](?:[1-9](?:[\d]|_(?=[\d]))*|0))\b/
};

var constantNumericOctal = exports.constantNumericDecimal = {
    token: "constant.numeric",
    regex: /\b(0[oO]?(?:[1-7](?:[0-7]|_(?=[0-7]))*|0))\b/
};

var constantNumericRational = exports.constantNumericRational = {
    token: "constant.numeric", //rational + complex
    regex: /\b([\d]+(?:[./][\d]+)?ri?)\b/
};

var constantNumericComplex = exports.constantNumericComplex = {
    token: "constant.numeric", //simple complex numbers
    regex: /\b([\d]i)\b/
};

var constantNumericFloat = exports.constantNumericFloat = {
    token : "constant.numeric", // float + complex
    regex : "[+-]?\\d(?:\\d|_(?=\\d))*(?:(?:\\.\\d(?:\\d|_(?=\\d))*)?(?:[eE][+-]?\\d+)?)?i?\\b"
};

var instanceVariable = exports.instanceVariable = {
    token : "variable.instance", // instance variable
    regex : "@{1,2}[a-zA-Z_\\d]+"
};

var RubyHighlightRules = function() {

    var builtinFunctions = (
        "abort|Array|assert|assert_equal|assert_not_equal|assert_same|assert_not_same|" +
        "assert_nil|assert_not_nil|assert_match|assert_no_match|assert_in_delta|assert_throws|" +
        "assert_raise|assert_nothing_raised|assert_instance_of|assert_kind_of|assert_respond_to|" +
        "assert_operator|assert_send|assert_difference|assert_no_difference|assert_recognizes|" +
        "assert_generates|assert_response|assert_redirected_to|assert_template|assert_select|" +
        "assert_select_email|assert_select_rjs|assert_select_encoded|css_select|at_exit|" +
        "attr|attr_writer|attr_reader|attr_accessor|attr_accessible|autoload|binding|block_given?|callcc|" +
        "caller|catch|chomp|chomp!|chop|chop!|defined?|delete_via_redirect|eval|exec|exit|" +
        "exit!|fail|Float|flunk|follow_redirect!|fork|form_for|form_tag|format|gets|global_variables|gsub|" +
        "gsub!|get_via_redirect|host!|https?|https!|include|Integer|lambda|link_to|" +
        "link_to_unless_current|link_to_function|link_to_remote|load|local_variables|loop|open|open_session|" +
        "p|print|printf|proc|putc|puts|post_via_redirect|put_via_redirect|raise|rand|" +
        "raw|readline|readlines|redirect?|request_via_redirect|require|scan|select|" +
        "set_trace_func|sleep|split|sprintf|srand|String|stylesheet_link_tag|syscall|system|sub|sub!|test|" +
        "throw|trace_var|trap|untrace_var|atan2|cos|exp|frexp|ldexp|log|log10|sin|sqrt|tan|" +
        "render|javascript_include_tag|csrf_meta_tag|label_tag|text_field_tag|submit_tag|check_box_tag|" +
        "content_tag|radio_button_tag|text_area_tag|password_field_tag|hidden_field_tag|" +
        "fields_for|select_tag|options_for_select|options_from_collection_for_select|collection_select|" +
        "time_zone_select|select_date|select_time|select_datetime|date_select|time_select|datetime_select|" +
        "select_year|select_month|select_day|select_hour|select_minute|select_second|file_field_tag|" +
        "file_field|respond_to|skip_before_filter|around_filter|after_filter|verify|" +
        "protect_from_forgery|rescue_from|helper_method|redirect_to|before_filter|" +
        "send_data|send_file|validates_presence_of|validates_uniqueness_of|validates_length_of|" +
        "validates_format_of|validates_acceptance_of|validates_associated|validates_exclusion_of|" +
        "validates_inclusion_of|validates_numericality_of|validates_with|validates_each|" +
        "authenticate_or_request_with_http_basic|authenticate_or_request_with_http_digest|" +
        "filter_parameter_logging|match|get|post|resources|redirect|scope|assert_routing|" +
        "translate|localize|extract_locale_from_tld|caches_page|expire_page|caches_action|expire_action|" +
        "cache|expire_fragment|expire_cache_for|observe|cache_sweeper|" +
        "has_many|has_one|belongs_to|has_and_belongs_to_many|p|warn|refine|using|module_function|extend|alias_method|" +
        "private_class_method|remove_method|undef_method"
    );

    var keywords = (
        "alias|and|BEGIN|begin|break|case|class|def|defined|do|else|elsif|END|end|ensure|" +
        "__FILE__|finally|for|gem|if|in|__LINE__|module|next|not|or|private|protected|public|" +
        "redo|rescue|retry|return|super|then|undef|unless|until|when|while|yield|__ENCODING__|prepend"
    );

    var buildinConstants = (
        "true|TRUE|false|FALSE|nil|NIL|ARGF|ARGV|DATA|ENV|RUBY_PLATFORM|RUBY_RELEASE_DATE|" +
        "RUBY_VERSION|STDERR|STDIN|STDOUT|TOPLEVEL_BINDING|RUBY_PATCHLEVEL|RUBY_REVISION|RUBY_COPYRIGHT|RUBY_ENGINE|RUBY_ENGINE_VERSION|RUBY_DESCRIPTION"
    );

    var builtinVariables = (
        "$DEBUG|$defout|$FILENAME|$LOAD_PATH|$SAFE|$stdin|$stdout|$stderr|$VERBOSE|" +
        "$!|root_url|flash|session|cookies|params|request|response|logger|self"
    );

    var keywordMapper = this.$keywords = this.createKeywordMapper({
        "keyword": keywords,
        "constant.language": buildinConstants,
        "variable.language": builtinVariables,
        "support.function": builtinFunctions,
        "invalid.deprecated": "debugger" // TODO is this a remnant from js mode?
    }, "identifier");

    var escapedChars = "\\\\(?:n(?:[1-7][0-7]{0,2}|0)|[nsrtvfbae'\"\\\\]|c(?:\\\\M-)?.|M-(?:\\\\C-|\\\\c)?.|C-(?:\\\\M-)?.|[0-7]{3}|x[\\da-fA-F]{2}|u[\\da-fA-F]{4}|u{[\\da-fA-F]{1,6}(?:\\s[\\da-fA-F]{1,6})*})";

    var closeParen = {
        "(": ")",
        "[": "]",
        "{": "}",
        "<": ">",
        "^": "^",
        "|": "|",
        "%": "%"
    };

    this.$rules = {
        "start": [
            {
                token: "comment",
                regex: "#.*$"
            }, {
                token: "comment.multiline", // multi line comment
                regex: "^=begin(?=$|\\s.*$)",
                next: "comment"
            }, {
                token: "string.regexp",
                regex: /[/](?=.*\/)/,
                next: "regex"
            },

            [{
                token: ["constant.other.symbol.ruby", "string.start"],
                regex: /(:)?(")/,
                push: [{
                    token: "constant.language.escape",
                    regex: escapedChars
                }, {
                    token: "paren.start",
                    regex: /#{/,
                    push: "start"
                }, {
                    token: "string.end",
                    regex: /"/,
                    next: "pop"
                }, {
                    defaultToken: "string"
                }]
            }, {
                token: "string.start",
                regex: /`/,
                push: [{
                    token: "constant.language.escape",
                    regex: escapedChars
                }, {
                    token: "paren.start",
                    regex: /#{/,
                    push: "start"
                }, {
                    token: "string.end",
                    regex: /`/,
                    next: "pop"
                }, {
                    defaultToken: "string"
                }]
            }, {
                token: ["constant.other.symbol.ruby", "string.start"],
                regex: /(:)?(')/,
                push: [{
                    token: "constant.language.escape",
                    regex: /\\['\\]/
                }, {
                    token: "string.end",
                    regex: /'/,
                    next: "pop"
                }, {
                    defaultToken: "string"
                }]
            }, {
                token: "string.start",//doesn't see any differences between strings and array of strings in highlighting
                regex: /%[qwx]([(\[<{^|%])/, onMatch: function (val, state, stack) {
                    if (stack.length)
                        stack = [];
                    var paren = val[val.length - 1];
                    stack.unshift(paren, state);
                    this.next = "qStateWithoutInterpolation";
                    return this.token;
                }
            }, {
                token: "string.start", //doesn't see any differences between strings and array of strings in highlighting
                regex: /%[QWX]?([(\[<{^|%])/, onMatch: function (val, state, stack) {
                    if (stack.length)
                        stack = [];
                    var paren = val[val.length - 1];
                    stack.unshift(paren, state);
                    this.next = "qStateWithInterpolation";
                    return this.token;
                }
            }, {
                token: "constant.other.symbol.ruby", //doesn't see any differences between symbols and array of symbols in highlighting
                regex: /%[si]([(\[<{^|%])/, onMatch: function (val, state, stack) {
                    if (stack.length)
                        stack = [];
                    var paren = val[val.length - 1];
                    stack.unshift(paren, state);
                    this.next = "sStateWithoutInterpolation";
                    return this.token;
                }
            }, {
                token: "constant.other.symbol.ruby", //doesn't see any differences between symbols and array of symbols in highlighting
                regex: /%[SI]([(\[<{^|%])/, onMatch: function (val, state, stack) {
                    if (stack.length)
                        stack = [];
                    var paren = val[val.length - 1];
                    stack.unshift(paren, state);
                    this.next = "sStateWithInterpolation";
                    return this.token;
                }
            }, {
                token: "string.regexp",
                regex: /%[r]([(\[<{^|%])/, onMatch: function (val, state, stack) {
                    if (stack.length)
                        stack = [];
                    var paren = val[val.length - 1];
                    stack.unshift(paren, state);
                    this.next = "rState";
                    return this.token;
                }
            }],

            {
                token: "punctuation", // namespaces aren't symbols
                regex: "::"
            },
            instanceVariable,
            {
                token: "variable.global", // global variable
                regex: "[$][a-zA-Z_\\d]+"
            }, {
                token: "support.class", // class name
                regex: "[A-Z][a-zA-Z_\\d]*"
            }, {
                token: ["punctuation.operator", "support.function"],
                regex: /(\.)([a-zA-Z_\d]+)(?=\()/
            }, {
                token: ["punctuation.operator", "identifier"],
                regex: /(\.)([a-zA-Z_][a-zA-Z_\d]*)/
            }, {
                token: "string.character",
                regex: "\\B\\?(?:" + escapedChars + "|\\S)"
            }, {
                token: "punctuation.operator",
                regex: /\?(?=.+:)/
            },

            constantNumericRational,
            constantNumericComplex,
            constantOtherSymbol,
            constantNumericHex,
            constantNumericFloat,
            constantNumericBinary,
            constantNumericDecimal,
            constantNumericOctal,
            {
                token: "constant.language.boolean",
                regex: "(?:true|false)\\b"
            }, {
                token: keywordMapper,
                regex: "[a-zA-Z_$][a-zA-Z0-9_$]*\\b"
            }, {
                token: "punctuation.separator.key-value",
                regex: "=>"
            }, {
                stateName: "heredoc",
                onMatch: function (value, currentState, stack) {
                    var next = (value[2] == '-' || value[2] == '~') ? "indentedHeredoc" : "heredoc";
                    var tokens = value.split(this.splitRegex);
                    stack.push(next, tokens[3]);
                    return [
                        {type: "constant", value: tokens[1]},
                        {type: "string", value: tokens[2]},
                        {type: "support.class", value: tokens[3]},
                        {type: "string", value: tokens[4]}
                    ];
                },
                regex: "(<<[-~]?)(['\"`]?)([\\w]+)(['\"`]?)",
                rules: {
                    heredoc: [{
                        onMatch: function(value, currentState, stack) {
                            if (value === stack[1]) {
                                stack.shift();
                                stack.shift();
                                this.next = stack[0] || "start";
                                return "support.class";
                            }
                            this.next = "";
                            return "string";
                        },
                        regex: ".*$",
                        next: "start"
                    }],
                    indentedHeredoc: [{
                        token: "string",
                        regex: "^ +"
                    }, {
                        onMatch: function(value, currentState, stack) {
                            if (value === stack[1]) {
                                stack.shift();
                                stack.shift();
                                this.next = stack[0] || "start";
                                return "support.class";
                            }
                            this.next = "";
                            return "string";
                        },
                        regex: ".*$",
                        next: "start"
                    }]
                }
            }, {
                regex: "$",
                token: "empty",
                next: function(currentState, stack) {
                    if (stack[0] === "heredoc" || stack[0] === "indentedHeredoc")
                        return stack[0];
                    return currentState;
                }
            },  {
                token: "keyword.operator",
                regex: "!|\\$|%|&|\\*|/|\\-\\-|\\-|\\+\\+|\\+|~|===|==|=|!=|!==|<=|>=|<<=|>>=|>>>=|<>|<|>|!|&&|\\|\\||\\?\\:|\\*=|%=|\\+=|\\-=|&=|\\^=|\\||\\b(?:in|instanceof|new|delete|typeof|void)"
            }, {
                token: "paren.lparen",
                regex: "[[({]"
            }, {
                token: "paren.rparen",
                regex: "[\\])}]",
                onMatch: function(value, currentState, stack) {
                    this.next = '';
                    if (value == "}" && stack.length > 1 && stack[1] != "start") {
                        stack.shift();
                        this.next = stack.shift();
                    }
                    return this.token;
                }
            }, {
                token: "text",
                regex: "\\s+"
            }, {
                token: "punctuation.operator",
                regex: /[?:,;.]/
            }
        ],
        "comment": [
            {
                token: "comment.multiline", // closing comment
                regex: "^=end(?=$|\\s.*$)",
                next: "start"
            }, {
                token: "comment", // comment spanning whole line
                regex: ".+"
            }
        ],
        "qStateWithInterpolation": [{
            token: "string.start",// excluded nested |^% due to difficulty in realization
            regex: /[(\[<{]/, onMatch: function (val, state, stack) {
                if (stack.length && val === stack[0]) {
                    stack.unshift(val, state);
                    return this.token;
                }
                return "string";
            }
        }, {
            token: "constant.language.escape",
            regex: escapedChars
        }, {
            token: "constant.language.escape",
            regex: /\\./
        }, {
            token: "paren.start",
            regex: /#{/,
            push: "start"
        }, {
            token: "string.end",
            regex: /[)\]>}^|%]/, onMatch: function (val, state, stack) {
                if (stack.length && val === closeParen[stack[0]]) {
                    stack.shift();
                    this.next = stack.shift();
                    return this.token;
                }
                this.next = '';
                return "string";
            }
        }, {
            defaultToken: "string"
        }],
        "qStateWithoutInterpolation": [{
            token: "string.start",// excluded nested |^% due to difficulty in realization
            regex: /[(\[<{]/, onMatch: function (val, state, stack) {
                if (stack.length && val === stack[0]) {
                    stack.unshift(val, state);
                    return this.token;
                }
                return "string";
            }
        }, {
            token: "constant.language.escape",
            regex: /\\['\\]/
        }, {
            token: "constant.language.escape",
            regex: /\\./
        }, {
            token: "string.end",
            regex: /[)\]>}^|%]/, onMatch: function (val, state, stack) {
                if (stack.length && val === closeParen[stack[0]]) {
                    stack.shift();
                    this.next = stack.shift();
                    return this.token;
                }
                this.next = '';
                return "string";
            }
        }, {
            defaultToken: "string"
        }],
        "sStateWithoutInterpolation": [{
            token: "constant.other.symbol.ruby",// excluded nested |^% due to difficulty in realization
            regex: /[(\[<{]/, onMatch: function (val, state, stack) {
                if (stack.length && val === stack[0]) {
                    stack.unshift(val, state);
                    return this.token;
                }
                return "constant.other.symbol.ruby";
            }
        }, {
            token: "constant.other.symbol.ruby",
            regex: /[)\]>}^|%]/, onMatch: function (val, state, stack) {
                if (stack.length && val === closeParen[stack[0]]) {
                    stack.shift();
                    this.next = stack.shift();
                    return this.token;
                }
                this.next = '';
                return "constant.other.symbol.ruby";
            }
        }, {
            defaultToken: "constant.other.symbol.ruby"
        }],
        "sStateWithInterpolation": [{
            token: "constant.other.symbol.ruby",// excluded nested |^% due to difficulty in realization
            regex: /[(\[<{]/, onMatch: function (val, state, stack) {
                if (stack.length && val === stack[0]) {
                    stack.unshift(val, state);
                    return this.token;
                }
                return "constant.other.symbol.ruby";
            }
        }, {
            token: "constant.language.escape",
            regex: escapedChars
        }, {
            token: "constant.language.escape",
            regex: /\\./
        }, {
            token: "paren.start",
            regex: /#{/,
            push: "start"
        }, {
            token: "constant.other.symbol.ruby",
            regex: /[)\]>}^|%]/, onMatch: function (val, state, stack) {
                if (stack.length && val === closeParen[stack[0]]) {
                    stack.shift();
                    this.next = stack.shift();
                    return this.token;
                }
                this.next = '';
                return "constant.other.symbol.ruby";
            }
        }, {
            defaultToken: "constant.other.symbol.ruby"
        }],
        "rState": [{
            token: "string.regexp",// excluded nested |^% due to difficulty in realization
            regex: /[(\[<{]/, onMatch: function (val, state, stack) {
                if (stack.length && val === stack[0]) {
                    stack.unshift(val, state);
                    return this.token;
                }
                return "constant.language.escape";
            }
        }, {
            token: "paren.start",
            regex: /#{/,
            push: "start"
        }, {
            token: "string.regexp",
            regex: /\//
        }, {
            token: "string.regexp",
            regex: /[)\]>}^|%][imxouesn]*/, onMatch: function (val, state, stack) {
                if (stack.length && val[0] === closeParen[stack[0]]) {
                    stack.shift();
                    this.next = stack.shift();
                    return this.token;
                }
                this.next = '';
                return "constant.language.escape";
            }
        },
            {include: "regex"},
            {
                defaultToken: "string.regexp"
            }],
        "regex": [
            {// character classes
                token: "regexp.keyword",
                regex: /\\[wWdDhHsS]/
            }, {
                token: "constant.language.escape",
                regex: /\\[AGbBzZ]/
            }, {
                token: "constant.language.escape",
                regex: /\\g<[a-zA-Z0-9]*>/
            }, {
                token: ["constant.language.escape", "regexp.keyword", "constant.language.escape"],
                regex: /(\\p{\^?)(Alnum|Alpha|Blank|Cntrl|Digit|Graph|Lower|Print|Punct|Space|Upper|XDigit|Word|ASCII|Any|Assigned|Arabic|Armenian|Balinese|Bengali|Bopomofo|Braille|Buginese|Buhid|Canadian_Aboriginal|Carian|Cham|Cherokee|Common|Coptic|Cuneiform|Cypriot|Cyrillic|Deseret|Devanagari|Ethiopic|Georgian|Glagolitic|Gothic|Greek|Gujarati|Gurmukhi|Han|Hangul|Hanunoo|Hebrew|Hiragana|Inherited|Kannada|Katakana|Kayah_Li|Kharoshthi|Khmer|Lao|Latin|Lepcha|Limbu|Linear_B|Lycian|Lydian|Malayalam|Mongolian|Myanmar|New_Tai_Lue|Nko|Ogham|Ol_Chiki|Old_Italic|Old_Persian|Oriya|Osmanya|Phags_Pa|Phoenician|Rejang|Runic|Saurashtra|Shavian|Sinhala|Sundanese|Syloti_Nagri|Syriac|Tagalog|Tagbanwa|Tai_Le|Tamil|Telugu|Thaana|Thai|Tibetan|Tifinagh|Ugaritic|Vai|Yi|Ll|Lm|Lt|Lu|Lo|Mn|Mc|Me|Nd|Nl|Pc|Pd|Ps|Pe|Pi|Pf|Po|No|Sm|Sc|Sk|So|Zs|Zl|Zp|Cc|Cf|Cn|Co|Cs|N|L|M|P|S|Z|C)(})/
            }, {
                token: ["constant.language.escape", "invalid", "constant.language.escape"],
                regex: /(\\p{\^?)([^/]*)(})/
            }, {// escapes
                token: "regexp.keyword.operator",
                regex: "\\\\(?:u[\\da-fA-F]{4}|x[\\da-fA-F]{2}|.)"
            }, {// flag
                token: "string.regexp",
                regex: /[/][imxouesn]*/,
                next: "start"
            }, {// invalid operators
                token: "invalid",
                regex: /\{\d+\b,?\d*\}[+*]|[+*$^?][+*]|[$^][?]|\?{3,}/
            }, {// operators
                token: "constant.language.escape",
                regex: /\(\?(?:[:=!>]|<'?[a-zA-Z]*'?>|<[=!])|\)|\{\d+\b,?\d*\}|[+*]\?|[()$^+*?.]/
            }, {
                token: "constant.language.delimiter",
                regex: /\|/
            }, {
                token: "regexp.keyword",
                regex: /\[\[:(?:alnum|alpha|blank|cntrl|digit|graph|lower|print|punct|space|upper|xdigit|word|ascii):\]\]/
            }, {
                token: "constant.language.escape",
                regex: /\[\^?/,
                push: "regex_character_class"
            }, {
                defaultToken: "string.regexp"
            }
        ],
        "regex_character_class": [
            {
                token: "regexp.keyword",
                regex: /\\[wWdDhHsS]/
            }, {
                token: "regexp.charclass.keyword.operator",
                regex: "\\\\(?:u[\\da-fA-F]{4}|x[\\da-fA-F]{2}|.)"
            }, {
                token: "constant.language.escape",
                regex: /&?&?\[\^?/,
                push: "regex_character_class"
            }, {
                token: "constant.language.escape",
                regex: "]",
                next: "pop"
            }, {
                token: "constant.language.escape",
                regex: "-"
            }, {
                defaultToken: "string.regexp.characterclass"
            }
        ]
    };

    this.normalizeRules();
};

oop.inherits(RubyHighlightRules, TextHighlightRules);

exports.RubyHighlightRules = RubyHighlightRules;
});

ace.define("ace/mode/matching_brace_outdent",[], function(require, exports, module) {
"use strict";

var Range = require("../range").Range;

var MatchingBraceOutdent = function() {};

(function() {

    this.checkOutdent = function(line, input) {
        if (! /^\s+$/.test(line))
            return false;

        return /^\s*\}/.test(input);
    };

    this.autoOutdent = function(doc, row) {
        var line = doc.getLine(row);
        var match = line.match(/^(\s*\})/);

        if (!match) return 0;

        var column = match[1].length;
        var openBracePos = doc.findMatchingBracket({row: row, column: column});

        if (!openBracePos || openBracePos.row == row) return 0;

        var indent = this.$getIndent(doc.getLine(openBracePos.row));
        doc.replace(new Range(row, 0, row, column-1), indent);
    };

    this.$getIndent = function(line) {
        return line.match(/^\s*/)[0];
    };

}).call(MatchingBraceOutdent.prototype);

exports.MatchingBraceOutdent = MatchingBraceOutdent;
});

ace.define("ace/mode/folding/ruby",[], function (require, exports, module) {
"use strict";

var oop = require("../../lib/oop");
var BaseFoldMode = require("./fold_mode").FoldMode;
var Range = require("../../range").Range;
var TokenIterator = require("../../token_iterator").TokenIterator;


var FoldMode = exports.FoldMode = function () {
};

oop.inherits(FoldMode, BaseFoldMode);

(function () {
    this.indentKeywords = {
        "class": 1,
        "def": 1,
        "module": 1,
        "do": 1,
        "unless": 1,
        "if": 1,
        "while": 1,
        "for": 1,
        "until": 1,
        "begin": 1,
        "else": 0,
        "elsif": 0,
        "rescue": 0,
        "ensure": 0,
        "when": 0,
        "end": -1,
        "case": 1,
        "=begin": 1,
        "=end": -1
    };

    this.foldingStartMarker = /(?:\s|^)(def|do|while|class|unless|module|if|for|until|begin|else|elsif|case|rescue|ensure|when)\b|({\s*$)|(=begin)/;
    this.foldingStopMarker = /(=end(?=$|\s.*$))|(^\s*})|\b(end)\b/;

    this.getFoldWidget = function (session, foldStyle, row) {
        var line = session.getLine(row);
        var isStart = this.foldingStartMarker.test(line);
        var isEnd = this.foldingStopMarker.test(line);

        if (isStart && !isEnd) {
            var match = line.match(this.foldingStartMarker);
            if (match[1]) {
                if (match[1] == "if" || match[1] == "else" || match[1] == "while" || match[1] == "until" || match[1] == "unless") {
                    if (match[1] == "else" && /^\s*else\s*$/.test(line) === false) {
                        return;
                    }
                    if (/^\s*(?:if|else|while|until|unless)\s*/.test(line) === false) {
                        return;
                    }
                }

                if (match[1] == "when") {
                    if (/\sthen\s/.test(line) === true) {
                        return;
                    }
                }
                if (session.getTokenAt(row, match.index + 2).type === "keyword")
                    return "start";
            } else if (match[3]) {
                if (session.getTokenAt(row, match.index + 1).type === "comment.multiline")
                    return "start";
            } else {
                return "start";
            }
        }
        if (foldStyle != "markbeginend" || !isEnd || isStart && isEnd)
            return "";

        var match = line.match(this.foldingStopMarker);
        if (match[3] === "end") {
            if (session.getTokenAt(row, match.index + 1).type === "keyword")
                return "end";
        } else if (match[1]) {
            if (session.getTokenAt(row, match.index + 1).type === "comment.multiline")
                return "end";
        } else
            return "end";
    };

    this.getFoldWidgetRange = function (session, foldStyle, row) {
        var line = session.doc.getLine(row);
        var match = this.foldingStartMarker.exec(line);
        if (match) {
            if (match[1] || match[3])
                return this.rubyBlock(session, row, match.index + 2);

            return this.openingBracketBlock(session, "{", row, match.index);
        }

        var match = this.foldingStopMarker.exec(line);
        if (match) {
            if (match[3] === "end") {
                if (session.getTokenAt(row, match.index + 1).type === "keyword")
                    return this.rubyBlock(session, row, match.index + 1);
            }

            if (match[1] === "=end") {
                if (session.getTokenAt(row, match.index + 1).type === "comment.multiline")
                    return this.rubyBlock(session, row, match.index + 1);
            }

            return this.closingBracketBlock(session, "}", row, match.index + match[0].length);
        }
    };

    this.rubyBlock = function (session, row, column, tokenRange) {
        var stream = new TokenIterator(session, row, column);

        var token = stream.getCurrentToken();
        if (!token || (token.type != "keyword" && token.type != "comment.multiline"))
            return;

        var val = token.value;
        var line = session.getLine(row);
        switch (token.value) {
            case "if":
            case "unless":
            case "while":
            case "until":
                var checkToken = new RegExp("^\\s*" + token.value);
                if (!checkToken.test(line)) {
                    return;
                }
                var dir = this.indentKeywords[val];
                break;
            case "when":
                if (/\sthen\s/.test(line)) {
                    return;
                }
            case "elsif":
            case "rescue":
            case "ensure":
                var dir = 1;
                break;
            case "else":
                var checkToken = new RegExp("^\\s*" + token.value + "\\s*$");
                if (!checkToken.test(line)) {
                    return;
                }
                var dir = 1;
                break;
            default:
                var dir = this.indentKeywords[val];
                break;
        }

        var stack = [val];
        if (!dir)
            return;

        var startColumn = dir === -1 ? session.getLine(row - 1).length : session.getLine(row).length;
        var startRow = row;
        var ranges = [];
        ranges.push(stream.getCurrentTokenRange());

        stream.step = dir === -1 ? stream.stepBackward : stream.stepForward;
        if (token.type == "comment.multiline") {
            while (token = stream.step()) {
                if (token.type !== "comment.multiline")
                    continue;
                if (dir == 1) {
                    startColumn = 6;
                    if (token.value == "=end") {
                        break;
                    }
                } else {
                    if (token.value == "=begin") {
                        break;
                    }
                }
            }
        } else {
            while (token = stream.step()) {
                var ignore = false;
                if (token.type !== "keyword")
                    continue;
                var level = dir * this.indentKeywords[token.value];
                line = session.getLine(stream.getCurrentTokenRow());
                switch (token.value) {
                    case "do":
                        for (var i = stream.$tokenIndex - 1; i >= 0; i--) {
                            var prevToken = stream.$rowTokens[i];
                            if (prevToken && (prevToken.value == "while" || prevToken.value == "until" || prevToken.value == "for")) {
                                level = 0;
                                break;
                            }
                        }
                        break;
                    case "else":
                        var checkToken = new RegExp("^\\s*" + token.value + "\\s*$");
                        if (!checkToken.test(line) || val == "case") {
                            level = 0;
                            ignore = true;
                        }
                        break;
                    case "if":
                    case "unless":
                    case "while":
                    case "until":
                        var checkToken = new RegExp("^\\s*" + token.value);
                        if (!checkToken.test(line)) {
                            level = 0;
                            ignore = true;
                        }
                        break;
                    case "when":
                        if (/\sthen\s/.test(line) || val == "case") {
                            level = 0;
                            ignore = true;
                        }
                        break;
                }

                if (level > 0) {
                    stack.unshift(token.value);
                } else if (level <= 0 && ignore === false) {
                    stack.shift();
                    if (!stack.length) {
                        if ((val == "while" || val == "until" || val == "for") && token.value != "do") {
                            break;
                        }
                        if (token.value == "do" && dir == -1 && level != 0)
                            break;
                        if (token.value != "do")
                            break;
                    }

                    if (level === 0) {
                        stack.unshift(token.value);
                    }
                }
            }
        }

        if (!token)
            return null;

        if (tokenRange) {
            ranges.push(stream.getCurrentTokenRange());
            return ranges;
        }

        var row = stream.getCurrentTokenRow();
        if (dir === -1) {
            if (token.type === "comment.multiline") {
                var endColumn = 6;
            } else {
                var endColumn = session.getLine(row).length;
            }
            return new Range(row, endColumn, startRow - 1, startColumn);
        } else
            return new Range(startRow, startColumn, row - 1, session.getLine(row - 1).length);
    };

}).call(FoldMode.prototype);

});

ace.define("ace/mode/ruby",[], function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextMode = require("./text").Mode;
var RubyHighlightRules = require("./ruby_highlight_rules").RubyHighlightRules;
var MatchingBraceOutdent = require("./matching_brace_outdent").MatchingBraceOutdent;
var Range = require("../range").Range;
var CstyleBehaviour = require("./behaviour/cstyle").CstyleBehaviour;
var FoldMode = require("./folding/ruby").FoldMode;

var Mode = function() {
    this.HighlightRules = RubyHighlightRules;
    this.$outdent = new MatchingBraceOutdent();
    this.$behaviour = new CstyleBehaviour();
    this.foldingRules = new FoldMode();
    this.indentKeywords = this.foldingRules.indentKeywords;
};
oop.inherits(Mode, TextMode);

(function() {


    this.lineCommentStart = "#";

    this.getNextLineIndent = function(state, line, tab) {
        var indent = this.$getIndent(line);

        var tokenizedLine = this.getTokenizer().getLineTokens(line, state);
        var tokens = tokenizedLine.tokens;

        if (tokens.length && tokens[tokens.length - 1].type == "comment") {
            return indent;
        }

        if (state == "start") {
            var match = line.match(/^.*[\{\(\[]\s*$/);
            var startingClassOrMethod = line.match(/^\s*(class|def|module)\s.*$/);
            var startingDoBlock = line.match(/.*do(\s*|\s+\|.*\|\s*)$/);
            var startingConditional = line.match(/^\s*(if|else|when|elsif|unless|while|for|begin|rescue|ensure)\s*/);
            if (match || startingClassOrMethod || startingDoBlock || startingConditional) {
                indent += tab;
            }
        }

        return indent;
    };

    this.checkOutdent = function(state, line, input) {
        return /^\s+(end|else|rescue|ensure)$/.test(line + input) || this.$outdent.checkOutdent(line, input);
    };

    this.autoOutdent = function(state, session, row) {
        var line = session.getLine(row);
        if (/}/.test(line))
            return this.$outdent.autoOutdent(session, row);
        var indent = this.$getIndent(line);
        var prevLine = session.getLine(row - 1);
        var prevIndent = this.$getIndent(prevLine);
        var tab = session.getTabString();
        if (prevIndent.length <= indent.length) {
            if (indent.slice(-tab.length) == tab)
                session.remove(new Range(row, indent.length - tab.length, row, indent.length));
        }
    };

    this.getMatching = function(session, row, column) {
        if (row == undefined) {
            var pos = session.selection.lead;
            column = pos.column;
            row = pos.row;
        }

        var startToken = session.getTokenAt(row, column);
        if (startToken && startToken.value in this.indentKeywords)
            return this.foldingRules.rubyBlock(session, row, column, true);
    };

    this.$id = "ace/mode/ruby";
    this.snippetFileId = "ace/snippets/ruby";
}).call(Mode.prototype);

exports.Mode = Mode;
});                (function() {
                    ace.require(["ace/mode/ruby"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            