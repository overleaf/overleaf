(function () {
    // Object.assign polyfill from https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Object/assign#Polyfill
    Object.assign||Object.defineProperty(Object,"assign",{enumerable:!1,configurable:!0,writable:!0,value:function(e){"use strict";if(void 0===e||null===e)throw new TypeError("Cannot convert first argument to object");for(var r=Object(e),t=1;t<arguments.length;t++){var n=arguments[t];if(void 0!==n&&null!==n){n=Object(n);for(var o=Object.keys(Object(n)),a=0,c=o.length;c>a;a++){var i=o[a],b=Object.getOwnPropertyDescriptor(n,i);void 0!==b&&b.enumerable&&(r[i]=n[i])}}}return r}});

    var sixpack = {base_url: "http://localhost:5000", ip_address: null, user_agent: null, timeout: 1000};

    // check for node module loader
    var on_node = false;
    if (typeof module !== "undefined" && typeof require !== "undefined") {
        on_node = true;
        module.exports = sixpack;
    } else {
        window["sixpack"] = sixpack;
    }

    sixpack.generate_client_id = function () {
        // from http://stackoverflow.com/questions/105034
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });
    };

    sixpack.Session = function (options) {
        Object.assign(this, sixpack, options);
        console.log("creating new session", options)
        if (!this.client_id) {
            this.client_id = this.generate_client_id();
        }
        if (!on_node) {
            this.user_agent = this.user_agent || (window && window.navigator && window.navigator.userAgent);
        }
    };

    sixpack.Session.prototype = {
        participate: function(experiment_name, alternatives, traffic_fraction, force, callback) {
            console.log("processing new participate", this.base_url)
            if (typeof traffic_fraction === "function") {
                callback = traffic_fraction;
                traffic_fraction = null;
                force = null;
            }
            else if (typeof traffic_fraction === "string") {
                callback = force;
                force = traffic_fraction;
                traffic_fraction = null;
            }
            if (typeof force === "function") {
                callback = force;
                force = null;
            }

            if (!(/^[a-z0-9][a-z0-9\-_ ]*$/).test(experiment_name)) {
                return callback(new Error("Bad experiment_name"));
            }

            if (alternatives.length < 2) {
                return callback(new Error("Must specify at least 2 alternatives"));
            }

            for (var i = 0; i < alternatives.length; i += 1) {
                if (!(/^[a-z0-9][a-z0-9\-_ ]*$/).test(alternatives[i])) {
                    return callback(new Error("Bad alternative name: " + alternatives[i]));
                }
            }
            var params = {client_id: this.client_id,
                          experiment: experiment_name,
                          alternatives: alternatives};
            if (!on_node && force == null) {
                var regex = new RegExp("[\\?&]sixpack-force-" + experiment_name + "=([^&#]*)");
                var results = regex.exec(window.location.search);
                if(results != null) {
                    force = decodeURIComponent(results[1].replace(/\+/g, " "));
                }
            }
            if (traffic_fraction !== null && !isNaN(traffic_fraction)) {
                params.traffic_fraction = traffic_fraction;
            }
            if (force != null && _in_array(alternatives, force)) {
                return callback(null, {"status": "ok", "alternative": {"name": force}, "experiment": {"version": 0, "name": experiment_name}, "client_id": this.client_id});
            }
            if (this.ip_address) {
                params.ip_address = this.ip_address;
            }
            if (this.user_agent) {
                params.user_agent = this.user_agent;
            }
            console.log(this.base_url, "participate")
            return _request(this.base_url + "/participate", params, this.timeout, function(err, res) {
                if (err) {
                    res = {status: "failed",
                           error: err,
                           alternative: {name: alternatives[0]}};
                }
                return callback(null, res);
            });
        },
        convert: function(experiment_name, kpi, callback) {
            if (typeof kpi === 'function') {
                callback = kpi;
                kpi = null;
            }
            if (!(/^[a-z0-9][a-z0-9\-_ ]*$/).test(experiment_name)) {
                return callback(new Error("Bad experiment_name"));
            }

            var params = {client_id: this.client_id,
                          experiment: experiment_name};
            if (this.ip_address) {
                params.ip_address = this.ip_address;
            }
            if (this.user_agent) {
                params.user_agent = this.user_agent;
            }
            if (kpi) {
                params.kpi = kpi;
            }
            return _request(this.base_url + "/convert", params, this.timeout, function(err, res) {
                console.log(res)
                if (err) {
                    res = {status: "failed",
                           error: err,};
                }
                return callback(null, res);
            });
        }
    };

    var counter = 0;

    var _request = function(uri, params, timeout, callback) {
        var timed_out = false;
        var timeout_handle = setTimeout(function () {
            timed_out = true;
            return callback(new Error("request timed out"));
        }, timeout);

        if (!on_node) {
            var cb = "callback" + (++counter);
            params.callback = "sixpack." + cb
            sixpack[cb] = function (res) {
                if (!timed_out) {
                    clearTimeout(timeout_handle);
                    return callback(null, res);
                }
            }
        }
        var url = _request_uri(uri, params);
        console.log(url)
        if (!on_node) {
            script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = url;
            script.async = true;
            document.body.appendChild(script);
        } else {
            var http = require('http');
            var req = http.get(url, function(res) {
                var body = "";
                res.on('data', function(chunk) {
                    return body += chunk;
                });
                return res.on('end', function() {
                    var data;
                    if (res.statusCode == 500) {
                        data = {status: "failed", response: body};
                    } else {
                        data = JSON.parse(body);
                    }
                    if (!timed_out) {
                        clearTimeout(timeout_handle);
                        return callback(null, data);
                    }
                });
            });
            req.on('error', function(err) {
                if (!timed_out) {
                    clearTimeout(timeout_handle);
                    return callback(err);
                }
            });
        }
    };

    var _request_uri = function(endpoint, params) {
        var query_string = [];
        var e = encodeURIComponent;
        for (var key in params) {
            if (params.hasOwnProperty(key)) {
                var vals = params[key];
                if (Object.prototype.toString.call(vals) !== '[object Array]') {
                    vals = [vals];
                }
                for (var i = 0; i < vals.length; i += 1) {
                    query_string.push(e(key) + '=' + e(vals[i]));
                }
            }
        }
        if (query_string.length) {
            endpoint += '?' + query_string.join('&');
        }
        return endpoint;
    };

    var _in_array = function(a, v) {
        for(var i = 0; i < a.length; i++) {
            if(a[i] === v) {
                return true;
            }
        }
        return false;
    };
})();