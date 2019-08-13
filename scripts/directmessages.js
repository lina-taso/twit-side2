/**
 * @fileOverview DirectMessages module
 * @name directmessges.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

class DM {

    constructor(tweet_obj, tl_type) {
        // 個別設定
        this._tweet      = tweet_obj;
        this._own_userid = tweet_obj.user_id;
        this._tl_type    = tl_type;

        switch (tl_type) {
        case TwitSideModule.TL_TYPE.DIRECTMESSAGE:
        case TwitSideModule.TL_TYPE.TEMP_DIRECTMESSAGE:
            this._mode      = 'directmessage';
            this._dm_cursor = null;
            break;
        }
    }

    // userid取得
    get userid() {
        if (this._own_userid) return this._own_userid;
        else return null;
    }
    get mode() { return this._mode; }
    // 続きの有無
    get hasMoreDm() { return this._dm_cursor != undefined; }
    // 最初から読み込む（メンバー）
    resetDmCursor() {
        this._dm_cursor = null;
    }
    // リストメンバー一覧
    async getDm(optionsHash) {
        if (this._dm_cursor == '')
            return { status : null, data : [] };

        // Twitterに送信するオプション
        if (this._dm_cursor) optionsHash.cursor = this._dm_cursor;

        const result = await (() => {
            switch (this._tl_type) {
            case TwitSideModule.TL_TYPE.DIRECTMESSAGE:
            case TwitSideModule.TL_TYPE.TEMP_DIRECTMESSAGE:
                return this._tweet.dmList2(optionsHash);
            }
            return Promise.reject();
        })();

        TwitSideModule.debug.log('got directmessages: next_cursor = ' + result.data.next_cursor);

        this._dm_cursor = result.data.next_cursor;
        return { status : result.status,
                 data   : result.data.events,
                 more   : this.hasMoreDm };
    }
};
