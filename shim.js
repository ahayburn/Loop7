/* Loop Previs offline shim.
   Gives the page the same two services it gets inside claude.ai:
   'db' (films / scenes / shots) and 'downloads' (save a file).
   Data is kept on the device in IndexedDB. No network is used.
   If the real claude.ai runtime is present, this file does nothing. */
(function () {
  'use strict';
  if (window.claude) return;

  var DB_NAME = 'loop-previs-local', STORE = 'docs';
  var idb = null, cache = {}, subs = {}, pending = {};

  function clone(o) {
    return (typeof structuredClone === 'function') ? structuredClone(o) : JSON.parse(JSON.stringify(o));
  }

  function openDb() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }

  function loadAll() {
    return new Promise(function (res, rej) {
      var tx = idb.transaction(STORE, 'readonly');
      var req = tx.objectStore(STORE).openCursor();
      req.onsuccess = function () {
        var c = req.result;
        if (c) {
          var k = String(c.key), i = k.indexOf('/');
          var col = k.slice(0, i), id = k.slice(i + 1);
          (cache[col] = cache[col] || new Map()).set(id, c.value);
          c.continue();
        } else res();
      };
      req.onerror = function () { rej(req.error); };
    });
  }

  function persist(op, col, id, body) {
    return new Promise(function (res, rej) {
      var tx = idb.transaction(STORE, 'readwrite');
      var st = tx.objectStore(STORE);
      if (op === 'put') st.put(body, col + '/' + id); else st.delete(col + '/' + id);
      tx.oncomplete = function () { res(); };
      tx.onerror = function () { rej(tx.error); };
      tx.onabort = function () { rej(tx.error || { code: 'aborted' }); };
    });
  }

  function notify(col) {
    if (pending[col]) return;
    pending[col] = true;
    Promise.resolve().then(function () {
      pending[col] = false;
      var m = cache[col] || new Map();
      var docs = [];
      m.forEach(function (body, id) {
        docs.push({ id: id, data: function () { return clone(body); } });
      });
      (subs[col] || []).forEach(function (cb) { try { cb({ docs: docs }); } catch (e) { console.error(e); } });
    });
  }

  function newId() {
    var a = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', s = '';
    var buf = new Uint8Array(20);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(buf) : buf.forEach(function (_, i) { buf[i] = Math.random() * 256; });
    for (var i = 0; i < 20; i++) s += a[buf[i] % a.length];
    return s;
  }

  function collection(col) {
    return {
      doc: function (id) {
        id = id || newId();
        return {
          id: id,
          set: function (body) {
            var b = clone(body);
            (cache[col] = cache[col] || new Map()).set(id, b);
            notify(col);
            return persist('put', col, id, b);
          },
          update: function (patch) {
            var m = cache[col] = cache[col] || new Map();
            if (!m.has(id)) return Promise.resolve();
            var b = Object.assign({}, m.get(id), clone(patch));
            Object.keys(b).forEach(function (k) { if (b[k] === undefined) delete b[k]; });
            m.set(id, b);
            notify(col);
            return persist('put', col, id, b);
          },
          delete: function () {
            if (cache[col]) cache[col].delete(id);
            notify(col);
            return persist('del', col, id);
          }
        };
      },
      onSnapshot: function (cb) {
        (subs[col] = subs[col] || []).push(cb);
        notify(col);
        return function () { subs[col] = (subs[col] || []).filter(function (f) { return f !== cb; }); };
      }
    };
  }

  /* ---- saving files ---- */
  function toBase64(data) {
    return new Promise(function (res, rej) {
      var blob = (data instanceof Blob) ? data : new Blob([data], { type: 'application/json' });
      var fr = new FileReader();
      fr.onload = function () { res(String(fr.result).split(',')[1] || ''); };
      fr.onerror = function () { rej(fr.error); };
      fr.readAsDataURL(blob);
    });
  }

  function webSave(filename, data) {
    var blob = (data instanceof Blob) ? data : new Blob([data], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    return Promise.resolve();
  }

  var downloads = {
    save: function (opts) {
      var filename = opts.filename, data = opts.data;
      var cap = window.Capacitor, P = cap && cap.Plugins;
      var native = cap && cap.isNativePlatform && cap.isNativePlatform() && P && P.Filesystem && P.Share;
      if (!native) return webSave(filename, data);
      return toBase64(data).then(function (b64) {
        return P.Filesystem.writeFile({ path: filename, data: b64, directory: 'CACHE' });
      }).then(function (r) {
        return P.Share.share({ title: filename, url: r.uri });
      }).catch(function (e) {
        var msg = String((e && e.message) || e).toLowerCase();
        if (msg.indexOf('cancel') >= 0 || msg.indexOf('dismiss') >= 0) throw { code: 'declined' };
        throw e;
      });
    }
  };

  var dbReady = null;
  function getDb() {
    if (!dbReady) {
      dbReady = openDb().then(function (d) { idb = d; return loadAll(); }).then(function () {
        try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
        return { collection: collection };
      });
    }
    return dbReady;
  }

  window.claude = {
    use: function (name) {
      if (name === 'db') return getDb();
      if (name === 'downloads') return Promise.resolve(downloads);
      return Promise.reject({ code: 'unavailable' });
    }
  };
})();
