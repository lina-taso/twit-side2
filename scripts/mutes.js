/**
 * @fileOverview Managing Original Mute Function
 * @name mutes.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

const MUTES_INTERVAL = 60 * 1000; // 1min

if (!TwitSideModule) var TwitSideModule = {};

TwitSideModule.Mutes = {

    initialize : function() {
        // [{ type, data, until }, ...]
        this._keywords    = JSON.parse(TwitSideModule.config.getPref('mute_keywords') || '[]');
        // [ { userid, until } ... ]
        this._users       = JSON.parse(TwitSideModule.config.getPref('mute_users') || '[]');

        this._checkExpired();
        this._autoCheckExpired = setInterval(() => {
            this._checkExpired();
        }, MUTES_INTERVAL);

        TwitSideModule.debug.log('Mute initialized');
    },

    // 期限切れ削除
    _checkExpired : async function() {
        for (let i=0; i<this._keywords.length; ) {
            if (this._keywords[i].until
            && this._keywords[i].until < TwitSideModule.text.getUnixTime())
                this._keywords.splice(i, 1);
            else
                i++;
        }
        for (let i=0; i<this._users.length; ) {
            if (this._users[i].until
            && this._users[i].until < TwitSideModule.text.getUnixTime())
                this._users.splice(i, 1);
            else
                i++;
        }
        await this._writeMutes();
    },

    // 更新
    _writeMutes : async function() {
        await Promise.all([
            TwitSideModule.config.setPref('mute_keywords', JSON.stringify(this._keywords)),
            TwitSideModule.config.setPref('mute_users',    JSON.stringify(this._users))
        ]);
    },

    // ミュートキーワード一覧
    get muteKeywords() { return JSON.parse(JSON.stringify(this._keywords)); },

    // ミュートユーザID一覧
    get muteUsers() { return JSON.parse(JSON.stringify(this._users)); },

    // ミュートキーワード追加
    addMuteKeyword : async function(regexp, data, until) {
        if (until
            && until < TwitSideModule.text.getUnixTime())
            return;

        this._keywords.push({
            type  : regexp ? 'Regexp' : 'Text',
            data  : data,
            until : until
        });
        await this._writeMutes();
    },

    // ミュートユーザID追加
    addMuteUser : async function(userid, until) {
        if (until
            && until < TwitSideModule.text.getUnixTime())
            return;

        this._users.push({
            userid : userid,
            until  : until
        });
        await this._writeMutes();
    },

    // ミュートキーワード削除
    removeMuteKeyword : async function(index) {
        if (index < this._keywords.length && index >= 0)
            this._keywords.splice(index, 1);
        await this._writeMutes();
    },

    // ミュートユーザID削除
    removeMuteUser : async function(index) {
        if (index < this._users.length && index >= 0)
            this._users.splice(index, 1);
        await this._writeMutes();
    },

    // ミュートキーワード一致チェック
    checkMuteKeywords : function(content) {
        for (let keyword of this._keywords) {
            switch (keyword.type) {
            case 'Text':
                // 文字列の場合
                if (content.includes(keyword.data))
                    return true;
                break;
            case 'Regexp':
                // 正規表現の場合
                if ((new RegExp(keyword.data, 'i')).test(content))
                    return true;
                break;
            }
        }
        return false;
    },

    // ミュートユーザチェック
    checkMuteUsers : function(userids) {
        const users = [];
        this._users.forEach((el) => { users.push(el.userid); });

        for (let userid of userids)
            if (users.indexOf(userid) >= 0) return true;
        return false;
    }
};
