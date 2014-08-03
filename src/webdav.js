/* Copyright (C)  Todd Fon(tilfon@live.com). All Rights Reserved.
 */

// Web dav protocal javascript lib.
// Require svnjs.util.
(function () {
    "use strict";

    var fmt  = svnjs.fmt;
    var log  = svnjs.log;
    var ajax = svnjs.ajax;
    var uuid = svnjs.uuid;

    var regs = {
        "activity":            /<D:activity-collection-set><D:href>([^<]+)<\/D:href>/,
        'checked_in':          /:checked-in><D:href>([^<]+)<\/D:href>/,
        'checked_out':         /<\w+>Checked-out resource (\S+) has been created/,
        'version_ctrl_conf':   /version-controlled-configuration><D:href>([^<]+)<\/D:href>/,
        'baseline_collection': /:baseline-collection><D:href>([^<]+)<\/D/,
        'baseline_rel_path':   /:baseline-relative-path>([^<]+)<\//
    };

    svnjs.WebDav = function WebDav(auth, base) {
        this._auth = "Basic " + auth;
        this._base = base; // base url

        this.activity = null;
    };

    svnjs.WebDav.prototype.options = function (ok, err) {
        var self = this;
        var opts = {
            headers: {"Content-type": "text/xml;charset=utf-8"},
            url: this._base,
            type: "OPTIONS",
            data: '<?xml version="1.0" encoding="utf-8"?><D:options xmlns:D="DAV:">' +
                  '<D:activity-collection-set/></D:options>',
            done: function (stat, ststr, res) {
                if (stat === '200') {
                    log.ok("OPTIONS");
                    self.activity = res.match(regs.activity) + uuid();
                    log.ok("Activity path is: ", self.activity);
                    ok && ok(stat, ststr, text);
                }
                else {
                    log.err("OPTIONS: %s %s", stat, ststr);
                    err && err();
                }
            }
        };
        ajax(opts);
    };

    svnjs.WebDav.prototype.propfind = function (url, handler, property) {
        var self = this;
        var opts = {
            type: "PROPPATCH",
            url: url,
            headers: {'Depth': 0, 'Content-type': 'text/xml;charset=utf-8'},
            data: '<?xml version="1.0" encoding="utf-8"?><D:propfind xmlns:D="DAV:">' +
                property ? property : '<D:allprop />' +'</D:propfind>',
            done: function (stat, ststr, text) {
                log.ok("PROPPATCH");
                log.ok("    path: ", url);
                log.ok("    stat: ", ststr);
                if (stat === "207") {
                    self._parseResponse(text);
                }
                handler(stat, ststr, text);
            }
        };
        ajax(opts);
    };

    svnjs.WebDav.prototype.mkactivity = function (ok, err) {
        var self = this;
        var opts = {
            type: "MKACTIVITY",
            url: self.activity,
            headers: {"Authorization": auth},
            done: function (stat, ststr, text) {
                if (stat === "201") {
                    log.ok("MKACTIVITY: %s %s", stat, ststr);
                    log.ok("    Activity:", self.activity);
                    ok && ok(stat, ststr, text);
                }
                else {
                    log.err("MKACTIVITY: %s %s", stat, ststr);
                    err && err();
                }
            }
        };
        ajax(opts);
    };

    svnjs.WebDav.prototype.checkout = function (url, ok, err) {
        var self = this;
        var opts = {
            type: "CHECKOUT",
            url: url,
            data: [
                '<?xml version="1.0" encoding="utf-8"?>',
                '<D:checkout xmlns:D="DAV:">',
                '<D:activity-set><D:href>', this.activity, '</D:href>',
                '</D:activity-set><D:apply-to-version/></D:checkout>'
            ].join(''),
            done: function (stat, ststr, text) {
                if (stat === "201") {
                    log.ok("CHECKOUT: %s %s", stat, ststr);
                    log.ok("    path: %s", url);
                    self._parseResponse(text);
                    ok && ok(stat, ststr, text);
                }
                else {
                    log.err("CHECKOUT: %s %s", stat, ststr);
                    self.removeActivity();
                }
            }
        };
        ajax(opts);
    };

    svnjs.WebDav.prototype.proppatch = function (url, properties, ok, err) {
        properties = this._getPropPatchXML(properties.set, properties.del);
        var self = this;
        var opts = {
            type: "PROPPATCH",
            url: url,
            headers: {
                'Content-type': 'text/xml;charset=utf-8',
                'Authorization': this.auth
            },
            data: [
                '<?xml version="1.0" encoding="utf-8" ?>',
                '<D:propertyupdate xmlns:D="DAV:"',
                ' xmlns:V="http://subversion.tigris.org/xmlns/dav/"',
                ' xmlns:C="http://subversion.tigris.org/xmlns/custom/"', 
                ' xmlns:S="http://subversion.tigris.org/xmlns/svn/">',
                properties,
                '</D:propertyupdate>'
            ].join(''),
            done: function (stat, ststr, text) {
                if (stat === "207") {
                    log.ok("PROPPATCH: %s %s", stat, ststr);
                    ok && ok(stat, ststr, text);
                }
                else {
                    log.err("PROPPATCH [%s] %s", stat, ststr);
                    self.removeActivity();
                    err && err();
                }
            }
        };
        ajax(opts);
    };

    svnjs.WebDav.prototype.put = function (file_path, content, ok, err) {
        var chko = this.checked_out;
        var path = chko.indexOf(file_path) !== -1 ? chko : chko + "/" + file_path;
        var self = this;
        var opts = {
            type: "PUT",
            url: path,
            headers: {"Content-type": "text/plain", "Authorization": this.auth},
            data: content,
            done: function (stat, ststr, text) {
                if (stat >= 200 && stat < 300) {
                    log.ok("PUT [%s] %s", stat, ststr);
                    log.ok("    path: ", path);
                }
                else {
                    log.err("PUT [%s] %s", stat, ststr);
                    log.err("   path: ", path);
                    self.removeActivity();
                    err && err();
                }
            }
        };
        ajax(opts);
    }

    svnjs.WebDav.prototype["delete"] = function (file_path, ok, err) {
        var chko = this.checked_out;
        var path = "string" === typeof(file_path) ? chko + "/" + file_path : file_path.join("");
        var opts = {
            type: "DELETE",
            url: path,
            headers: {"Authorization": this.auth},
            done: function (stat, ststr, text) {
                if (stat >= 200 && stat < 300) {
                    log.ok("DELETE [%s] %s", stat, ststr);
                    log.ok("    path: ", path);
                    ok && ok(stat, ststr, text);
                }
                else {
                    log.err("DELETE [%s] %s", stat, ststr);
                    log.err("   path: ", path);
                    err && err();
                }
            }
        };
        ajax(opts);
    };

    svnjs.WebDav.prototype.move = function (url, dest, ok, err) {
        var self = this;
        var opts = {
            type: "MOVE",
            url: url,
            headers: {
                "Destination": dest,
                "Overwrite": "F",
                "Authorization": this.auth
            },
            done: function (stat, ststr, text) {
                if (stat >= 200 && stat < 300) {
                    log.ok("MOVE [%s] %s", stat, ststr);
                    log.ok("    path: ", url);
                    log.ok("    dest: ", dest);
                    ok && ok(stat, ststr, text);
                }
                else {
                    log.err("MOVE [%s] %s", stat, ststr);
                    log.err("    path: ", url);
                    log.err("    dest: ", dest);
                    err && err();
                    self.removeActivity();
                }
            }
        };
        ajax(opts);
    }

    svnjs.WebDav.prototype.copy = function (url, dest, ok, err) {
        var self = this;
        var opts = {
            type: "COPY",
            url: url,
            headers: {
                "Destination": dest,
                "Overwrite": "F",
                "Authorization": this.auth
            },
            done: function (stat, ststr, text) {
                if (stat >= 200 && stat < 300) {
                    log.ok("MOVE [%s] %s", stat, ststr);
                    log.ok("    path: ", url);
                    log.ok("    dest: ", dest);
                    ok && ok(stat, ststr, text);
                }
                else {
                    log.err("MOVE [%s] %s", stat, ststr);
                    log.err("    path: ", url);
                    log.err("    dest: ", dest);
                    err && err();
                    self.removeActivity();
                }
            }
        };
        ajax(opts);
    }

    svnjs.WebDav.prototype.mkcol = function (url, ok, err) {
        var self = this;
        var opts = {
            type: "MKCOL",
            url: url,
            headers: {"Authorization": this.auth},
            done: function (stat, ststr, text) {
                if (stat >= 200 && stat < 300) {
                    log.ok("MKCOL [%s] %s", stat, ststr);
                    log.ok("    path: ", url);
                    ok && ok(stat, ststr, text);
                }
                else {
                    log.err("MKCOL [%s] %s", stat, ststr);
                    log.err("   path: ", url);
                    self.removeActivity();
                    err && err();
                }
            }
        };
        ajax(opts);
    };

    // @TODO
    svnjs.WebDav.prototype.lock = function (url, ok, err) {
        var opts = {
            type: "LOCK",
            url: url,
            headers: {},
            done: function (stat, ststr, text) {
            
            }
        };
        //ajax(opts);
    };

    // @TODO
    svnjs.WebDav.prototype.unlock = function (url, ok, err) {
        var opts = {
            type: "UNLOCK",
            url: url,
            headers: {},
            done: function (stat, ststr, text) {
            
            }
        };
        //ajax(opts);
    };

    svnjs.WebDav.prototype.merge = function (ok, err) {
        var url = this.activity;
        var self = this;
        var opts = {
            type: "MERGE",
            url: url,
            headers: {
                'X-SVN-Options': 'release-locks',
                'Content-type': 'text/xml;charset=utf-8',
                'Authorization': this.auth
            },
            data: [
                '<?xml version="1.0" encoding="utf-8"?>',
                '<D:merge xmlns:D="DAV:"><D:source>',
                '<D:href>', url, '</D:href>',
                '</D:source><D:no-auto-merge/><D:no-checkout/>',
                '<D:prop><D:checked-in/><D:version-name/>',
                '<D:resourcetype/><D:creationdate/>',
                '<D:creator-displayname/></D:prop></D:merge>'
            ].join(''),
            done: function (stat, ststr, text) {
                if (stat === "200") {
                    log.ok("MERGE [%s] %s", stat, ststr);
                    log.ok("    path: ", url);
                    self.removeActivity(ok);
                }
                else {
                    log.err("MERGE [%s] %s", stat, ststr);
                    log.err("   path: ", url);
                    self.removeActivity();
                    err && err(stat, ststr, text);
                }
            }
        };
        ajax(opts);
    };

    svnjs.WebDav.prototype._parseResponse = function (text) {
        for (var name in regs) {
            var reg = regs[name];
            var match = text.match(reg);
            if (match) {
                this[name] = match[1];
            }
        }
    };

    svnjs.WebDav.prototype.removeActivity = function (callback) {
        function deleteOk() {
            callback && callback.apply(null, arguments);
        }
        function deleteErr() {
            log.err("%s: remove activity fail", this.activity);
        }
        this['delete'](this.activity, deleteOk, deleteErr);
    };

    svnjs.WebDav.prototype._getPropPatchXML = function (propset, propdel) {
        var xml = [];
        if (propset) {
            xml.push('<D:set>');
            for (var ns in propset) {
                xml.push('<D:prop>');
                xml.push('<S:' + ns + ' >');
                xml.push(propset[ns]);
                xml.push('</S:' + ns + '>');
                xml.push('</D:prop>');
            }
            xml.push('</D:set>');
        }
        if (propdel) {
            xml.push('<D:remove>');
            for (var i = 0, ns; ns = propdel[i]; i++)
                xml.push(
                    '<D:prop>' +
                    '<S:' + ns + ' />' +
                    '</D:prop>'
                );
            xml.push('</D:remove>');
        }
        return xml.join('');
    };

})();
