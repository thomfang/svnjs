this.SVN = function (usname, passwd, base) {
    var auth = btoa(usname + ':' + passwd);
    this.dav = new Dav(auth, base);
    this.handlers = [];
};
this.SVN.prototype = {
    add: function (path, content) {
        this.handlers.push({
            method: 'PUT',
            params: [path, content]
        });
    },
    del: function (path) {
        this.handlers.push({
            method: 'DELETE',
            params: [path]
        });
    },
    copy: function (path, topath) {
        // todo copy
    },
    move: function (path, topath) {
        // todo move
    },
    lock: function () {
        // todo lock
    },
    unlock: function () {
        // todo unlock
    },
    mkdir: function (name) {
        this.handlers.push({
            method: 'MKCOL',
            params: [name]
        });
    },
    propset: function (path, props) {
        this.handlers.push({
            method: 'PROPPATCH',
            params: [
                path, { set: props }
            ]
        });
    },
    propdel: function (path, props) {
        this.handlers.push({
            method: 'PROPPATCH',
            params: [
                path, { del: props }
            ]
        });
    },
    commit: function (message, ok, err) {
        var self = this;
        var dav = self.dav;
        self.message = message;
        self.ok = ok;
        self.err = err;
        dav.log('================================================');
        dav.OPTIONS(function () {
            dav.PROPFIND(dav.base, function (stat) {
                if (stat == '207')
                    self._mkAct();
                else
                    self.err && self.err();
            });
        });
    },
    log: function () {
        Dav.console.style.display = 'block';
    },
    _mkAct: function () {
        var self = this;
        var dav = self.dav;
        dav.MKACTIVITY(function () {
            dav.CHECKOUT(dav.vcc, function () {
                self._patchLog();
            }, function () {
                self.err && self.err();
            });
        }, function () {
            self.err && self.err();
        });
    },
    _patchLog: function () {
        var self = this;
        var dav = self.dav;
        var message = self.message;
        dav.PROPPATCH(dav.cko, {
            set: {
                log: message
            }
        }, function () {
            self._process();
        }, function () {
            self.err && self.err();
        });
    },
    _process: function () {
        var self = this;
        var dav = self.dav;
        var handler = self.handlers.shift();
        var method = handler.method;
        var params = handler.params;
        params.push(function () {
            if (self.handlers.length)
                self._process();
            else
                self._merge();
        }, function () {
            self.err && self.err();
        });
        var url = self._getCheckoutUrl(method, params[0]);
        dav.CHECKOUT(url, function () {
            if (method == 'COPY')
                return self._prepareCopy(params);
            if (method == 'PROPPATCH')
                params[0] = dav.cko;
            else if (method == 'MKCOL')
                params[0] = dav.cko + '/' + params[0];
            dav[method].apply(dav, params);
        }, function () {
            self.err && self.err();
        });
    },
    _prepareCopy: function (params) {
        var self = this;
        var dav = self.dav;
        var path = params[1];
        var success = params[2];
        dav.PROPFIND(path, function () {
            dav.PROPFIND(dav.vcc, function (stat, statstr, cont) {
                var rbc = /:baseline-collection><D:href>([^<]+)<\/D/;
                var rbr = /:baseline-ralative-path>([^<]+)<\//;
                var topath = params[0];
                topath = dav.cko + '/' + (topath == './' ? '' : topath);
                path = cont.match(rbc)[1] +
                       cont.match(rbr)[1] + '/' + path;
                dav.COPY(path, topath, success);
            }//, ['<D:prop><D:baseline-collection xmlns="DAV:"/>',
              //  '<D:version-name xmlns="DAV:"/></D:prop>'
              // ].join('')
            );
        });
    },
    _getCheckoutUrl: function (method, path) {
        var dav = this.dav;
        var url = dav.cki;
        if (path == './' && method == 'COPY')
            return dav.cki;
        var pos = path.indexOf('/');
        if (method == 'PROPPATCH' || pos > -1)
            url += '/' + path;
        return url;
    },
    _merge: function () {
        var self = this;
        var dav = self.dav;
        dav.MERGE(function () {
            dav.log('ALL DONE!');
            dav.log('================================================');
            self.ok && self.ok();
        }, function () {
            self.err && self.err();
        });
    }
};

!function (proto) {
    proto.rm = proto.remove = proto['delete'] = proto.del;
    proto.mv = proto.rename = proto.ren = proto.move;
    proto.up = proto.update;
    proto.pset = proto.ps = proto.propset;
    proto.pdel = proto.pd = proto.propdel;
}(this.SVN.prototype);
