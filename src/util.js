/* Copyright (C)  Todd Fon(tilfon@live.com). All Rights Reserved.
 */

// Utilitily

(function () {
    "use strict";

    if ("undefined" === typeof JSON) {
        // IE6 ~ IE7 not support JSON, so you would add the JSON2.js lib in your project.
        throw "Browser not support JSON, 'JSON2.js' required in your project.";
    }

    var STATUS = svnjs.STATUS_CODES;
    
    // String format
    svnjs.fmt = function fmt(f) {
        var args = arguments;
        var len = args.length;
        if (len <= 1) {
            return String(f);
        }
        var i = 1;
        var str = String(f).replace(/%[sdj]/g, function (x) {
            if (i > len) return x;
            switch (x) {
                case "%s":
                    return String(args[i++]);
                case "%d":
                    return Number(args[i++]);
                case "%j":
                    return JSON.stringfy(args[i++]);
                default:
                    return x;
            }
        });
        for (var x; i < len; i++) {
            x = args[i];
            str += ' ' + x;
        }
        return str;
    };

    // Get xml http request
    var getxhr = function () {
        if ("undefined" !== typeof XMLHttpRequest) {
            return function () {
                return new XMLHttpRequest;
            };
        }
        if ("undefined" !== typeof ActiveXObject) {
            return function () {
                return new ActiveXObject("Microsoft.XMLHTTP");
            };
        }
        throw "Browser not support XMLHTTP.";
    }();

    // Ajax util
    svnjs.ajax = function (options) {
        var xhr = getxhr();
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                var stat = xhr.status.toString();
                var text = xhr.responseText;
                xhr = null;
                if ("function" === typeof options.done) {
                    options.done(stat, STATUS[stat], text);
                }
            }
        };
        xhr.open(options.type.toUpperCase(), options.url, true);
        if (options.headers) {
            for (var key in options.headers) {
                xhr.setRequestHeader(key, options.headers[key]);
            }
        }
        xhr.send(options.data);
    };

    var fixed = function (n) {
        return (n < 10 ? '0' : '') + n;
    };

    // Get format time
    svnjs.now = function () {
        var d = new Date();
        var Y = d.getFullYear();
        var M = fixed(d.getMonth() + 1);
        var D = fixed(d.getDate());
        var H = fixed(d.getHours());
        var m = fixed(d.getMinutes());
        var s = fixed(d.getSeconds());
        return svnjs.fmt("%s-%s-%s %s:%s:%s", Y, M, D, H, m, s);
    };

    // Message log
    svnjs.log = {
        ok:  function () {},
        err: function () {}
    };
    if ("undefined" !== console && "function" === typeof console.log) {
        svnjs.log.ok = function () {
            var str = svnjs.fmt.apply(null, arguments);
            console.log("[OK]%s %s", svnjs.now(), str);
        };
        svnjs.log.err = function () {
            var str = svnjs.fmt.apply(null, arguments);
            console.log("[ERR]%s %s", svnjs.now(), str);
        };
    }

    // uuid generator
    svnjs.uuid = function () {
        var str = "0123456789abcdefghijklmnopqrstuvwxyz";
        var key = [];
        var lens = [8, 4, 4, 4, 12];
        for (var i = 0; i < 5; i++) {
            var len = lens[i];
            var arr = [];
            for (var j = 0; j < len; j++) {
                arr.push(str[Math.random() * 36 | 0]);
            }
            key.push(arr.join(''));
        }
        return key.join('-');
    };

    if ("undefined" === typeof(btoa)) {
        svnjs.log.err(
            "Base64 to ASC not support, you need to require a lib, ",
            "and override svnjs.encrypt method."
        );
    }

    // Authorization encrypt
    svnjs.encrypt = function (usname, passwd) {
        var str = usname + ":" + passwd;
        return typeof(btoa) !== "undefined" ? "Basic " + btoa(str) : str;
    };

    

})();
