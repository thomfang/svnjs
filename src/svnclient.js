/* Copyright (C)  Todd Fon(tilfon@live.com). All Rights Reserved.
 */

// SVN client

(function () {
    "use strict";

    var log = svnjs.log;

    svnjs.Client = function SVNClient(username, password, base_url) {
        if (arguments.length !== 3) {
            throw new Error("new svnjs.Client: args required 3");
        }

        var auth = svnjs.encrypt(username, password);
        this._webdav   = new svnjs.WebDav(auth, base_url);
        this._baseurl  = base_url;
        this._handlers = [];
        this._tocancel = false;
    };

    svnjs.Client.prototype.cancel = function () {
        this._handlers.length = 0;
        this._tocancel = true;
    };

    svnjs.Client.prototype.add = function (file_path, content) {
        this._handlers.push({
            method: "put",
            params: [file_path, content]
        });
    };

    svnjs.Client.prototype.del = function (file_path) {
        this._handlers.push({
            method: "delete",
            params: [file_path]
        });
    };

    svnjs.Client.prototype.mkdir = function (dirname) {
        this._handlers.push({
            method: "mkcol",
            params: [dirname]
        });
    };

    svnjs.Client.prototype.propset = function (file_path, props) {
        this._handlers.push({
            method: "proppatch",
            params: [file_path, {set: props}]
        });
    };

    svnjs.Client.prototype.propdel = function (file_path, props) {
        this._handlers.push({
            method: "proppatch",
            params: [file_path, {del: props}]
        });
    };

    svnjs.Client.prototype.commit = function (message) {
        this._message = message;

        this._doneHandler = null;
        this._failHandler = null;

        var self = this;
        var webdav = this._webdav;

        // Send options type request to make a handshake.
        // Send propfind type request to prepare make activity.
        webdav.options(function onoptionsOK() {
            webdav.propfind(self._baseurl, function (stat) {
                if (stat === "207") {
                    self._makeActivity();
                }
                else {
                    self._failHandler && self.failHandler();
                }
            });
        });

        return {
            done: function (handler) {
                self._doneHandler = handler;
                return this;
            },
            fail: function (handler) {
                self._failHandler = handler;
                return this;
            }
        };
    };

    svnjs.Client.prototype.copy = function () {
        // TODO
    };

    svnjs.Client.prototype.move = function () {
        // TODO
    };

    svnjs.Client.prototype.lock = function () {
        // TODO
    };

    svnjs.Client.prototype.unlock = function () {
        // TODO
    };

    svnjs.Client._makeActivity = function () {
        var self = this;
        var webdav = this._webdav;

        function onActivityMaked() {
            webdav.checkout(dav.version_ctrl_conf, onCheckoutOk, onCheckoutErr);
        }

        function onCheckoutOk() {
            self._patchlog();
        }

        function onCheckoutErr() {
            "function" === typeof(self._failHandler) && self._failHandler();
        }
        webdav.mkactivity(onActivityMaked);
    };

    svnjs.Client.prototype._patchlog = function () {
        var self = this;
        var webdav = this._webdav;
        var propset = {set: {log: self._message}};

        function onPatchOk() {
            self._processAll();
        }
        
        function onPatchErr() {
            self._failHandler && self._failHandler();
        }

        webdav.proppatch(webdav.checked_out, propset, onPatchOk, onPatchErr);
    };

    svnjs.Client.prototype._processAll = function () {
        if (this._tocancel) {
            this._tocancel = false;
            return;
        }
        var self = this;
        var webdav = this._webdav;
        var handler = this._handler.shift();
        var method = handler.method;
        var params = handler.params;

        function onOk() {
            if (self._handlers.length) {
                self._processAll();
            }
            else {
                self._merge();
            }
        }

        function onErr() {
            self._failHandler && self._failHandler();
        }

        function onCheckoutOk() {
            if (method === "copy") {
                return self._prepareCopy(params);
            }
            if (method === "proppatch") {
                params[0] = webdav.checked_out;
            }
            else if (method === "mkcol") {
                params[0] = webdav.checked_out + "/" + params[0];
            }
            webdav[method].apply(webdav, params);
        }

        params.push(onOk);
        params.push(onErr);

        webdav.checkout(this._getCheckoutUrl(method, params[0]), onCheckoutOk, onErr);
    };

    svnjs.Client.prototype._getCheckoutUrl = function (method, path) {
        var url = this._webdav.checked_in;
        if (path === "./" && method === "copy") {
            return url;
        }
        if (method === "proppatch" || path.indexOf("/") > -1) {
            url += "/" + path;
        }
        return url
    };

    svnjs.Client.prototype._prepareCopy = function (params) {
        var webdav = this._webdav;
        var path = params[1];
        
        function onPropfindOk(stat, ststr, text) {
            var topath = params[0];
            topath = webdav.checked_out + "/" + (topath === "./" ? "" : topath);
            path = webdav.baseline_collection + webdav.baseline_rel_path + "/" + path;
            webdav.copy(path, topath, params[2]);
        }

        webdav.propfind(path, function () {
            webdav.propfind(webdav.version_ctrl_conf, onPropfindOk);
        });
    };

    svnjs.Client.prototype._merge = function () {
        var self = this;
        var webdav = self._webdav;

        function onOk() {
            log.ok(self._message, " done!");
            self._doneHandler && self.doneHandler();
        }

        function onErr() {
            self._failHandler && self._failHandler();
        }

        webdav.merge(onOk, onErr);
    };

    svnjs.Client.prototype.rm =
        svnjs.Client.prototype.remove =
        svnjs.Client.prototype["delete"] = svnjs.Client.prototype.del;

    svnjs.Client.prototype.mv =
        svnjs.Client.prototype.rename = 
        svnjs.Client.prototype.ren = svnjs.Client.prototype.move;

    svnjs.Client.prototype.cp = svnjs.Client.prototype.copy;

    svnjs.Client.prototype.pset = svnjs.Client.prototype.ps = svnjs.Client.prototype.propset;
    svnjs.Client.prototype.pdel = svnjs.Client.prototype.pd = svnjs.Client.prototype.propdel;

})();
