/**
 * @fileOverview TwitSideModule
 * @name twitside.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

if (!TwitSideModule) var TwitSideModule = {};

TwitSideModule.debug = {
    log : (message) => {
        if (TwitSideModule.config.debug) console.trace(message);
    }
};

TwitSideModule.windows = {
    receivers : [],
    addReceiver : function(windowId, windowType, receiverFunction) {
        this.receivers.push({
            windowType : windowType,
            windowId   : windowId,
            receiver   : receiverFunction
        });
    },
    removeReceiver : function(windowId) {
        for (let i=0; i<this.receivers.length; i++)
            if (this.receivers[i].windowId == windowId) {
                delete this.receivers.splice(i, 1);
            }
    },
    sendMessage : async function(message, windowId, windowType) {
        const functions = [];
        for (let item of this.receivers) {
            // 全対象
            if (windowId == null && windowType == null) {
                functions.push(item.receiver(message));
            }
            // ウィンドウID特定
            else if (windowId != null && item.windowId == windowId) {
                functions.push(item.receiver(message));
                break; // 終了
            }
            // ウィンドウタイプ指定
            else if (windowType != null && item.windowType == windowType)
                functions.push(item.receiver(message));
        }
        return await Promise.all(functions);
    },
    hasReceiver : function(windowId) {
        return this.receivers.find(el => el.windowId == windowId) != undefined
            ? true : false;
    }
};

TwitSideModule.config = {
    _initialized : false,
    _debug       : false,
    _config      : {},
    get debug() { return this._debug; },
    get initialized() { return this._initialized; },
    initialize : async function() {
        this._config = Object.assign({},
                                     defaultconfig,
                                     await browser.storage.local.get());
        this._debug = this._config.debug ? true : false;
        this._initialized = true;
    },
    getPref : function(key) {
        if (!this.initialized)
            throw new Error('CONFIG_MUST_BE_INITIALIZED');

        return key == null ? this._config : this._config[key];
    },
    setPref : function(key, val) {
        if (!this._initialized)
            throw new Error('CONFIG_MUST_BE_INITIALIZED');

        if (!key) return Promise.reject();

        // only debug value
        if (key == 'debug')
            this._debug = val === true ? true : false;

        if (val == null) {
            this._config[key] = defaultconfig[key] || null;
            return browser.storage.local.remove(key);
        }
        else {
            this._config[key] = val;
            const set = {};
            set[key] = val;
            return browser.storage.local.set(set);
        }
    }
};

TwitSideModule.browsers = {
    openURL : (url, suffix) => {
        const active = TwitSideModule.config.getPref('URL_tabactive');

        if (TwitSideModule.ManageWindows.getOpenerId(suffix)) {
            return browser.tabs.create({
                url      : url,
                active   : active,
                windowId : TwitSideModule.ManageWindows.getOpenerId(suffix).windowId
            }).catch(() => {
                // no specified window
                return browser.tabs.create({
                    url    : url,
                    active : active
                });
            });
        }
        else
            return browser.tabs.create({
                url    : url,
                active : active
            });
    },
},

TwitSideModule.hash = {
    // ハッシュをソートしてフォーム形式
    hash2sortedForm : (hash) => {
        const keys = Object.keys(hash).sort(),
              len = keys.length,
              form = [];

        for (let key of keys) {
            form.push(key+'=' + TwitSideModule.text.encodeURI(hash[key]));
        }
        return form.join('&');
    },

    // ハッシュをOAuthヘッダー形式
    hash2oauthHeader : (hash) => {
        const keys = Object.keys(hash).sort(),
              len = keys.length,
              param = [];

        for(let i=0; i<len; i++) {
            param.push(encodeURIComponent(keys[i])
                       + '="'
                       + encodeURIComponent(hash[keys[i]])
                       + '"');
        }

        return 'OAuth ' + param.join(", ");
    }
};
