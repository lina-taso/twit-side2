/**
 * @fileOverview Lists module
 * @name lists.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

const LISTS_COUNT       = 200,
      LISTMEMBERS_COUNT = 500;

class Lists {

    constructor(tweet_obj, tl_type, targetid) {

        // 個別設定
        this._tweet      = tweet_obj;
        this._own_userid = tweet_obj.user_id;
        this._tl_type    = tl_type;

        switch (tl_type) {
        case TwitSideModule.TL_TYPE.TEMP_OWNERSHIPLISTS:
        case TwitSideModule.TL_TYPE.TEMP_SUBSCRIPTIONLISTS:
        case TwitSideModule.TL_TYPE.TEMP_MEMBERSHIPLISTS:
            this._mode         = 'list';
            this._userid       = targetid;
            this._lists_cursor = '-1';
            break;
        case TwitSideModule.TL_TYPE.TEMP_LISTMEMBER:
        case TwitSideModule.TL_TYPE.TEMP_LISTSUBSCRIBER:
            this._mode           = 'listmember';
            this._listid         = targetid;
            this._members_cursor = '-1';
            break;
        }
    }

    // userid取得
    get userid() {
        if (this._own_userid) return this._own_userid;
        else return null;
    }
    // target_userid / target_listid取得
    get targetid() {
        if (this._mode == 'list') return this._userid;
        else if (this._mode == 'listmember') return this._listid;
        return null;
    }
    get mode() { return this._mode; }
    // 続きの有無（リスト）
    get hasMoreList() { return this._lists_cursor != '0'; }
    // 続きの有無（メンバー）
    get hasMoreListMember() { return this._members_cursor != '0'; }
    // 最初から読み込む（リスト）
    resetListsCursor() { this._lists_cursor = '-1'; }
    // 最初から読み込む（メンバー）
    resetListMembersCursor() { this._members_cursor = '-1'; }
    // リスト一覧
    async getListsList(optionsHash) {
        if (this._lists_cursor == '0')
            return { status : null, data : [] };

        // Twitterに送信するオプション
        optionsHash.count   = LISTS_COUNT;
        optionsHash.cursor  = this._lists_cursor;
        optionsHash.user_id = this._userid;

        const result = await (() => {
            switch (this._tl_type) {
            case TwitSideModule.TL_TYPE.TEMP_OWNERSHIPLISTS:
                return this._tweet.ownershipListsList(optionsHash);
            case TwitSideModule.TL_TYPE.TEMP_SUBSCRIPTIONLISTS:
                return this._tweet.subscriptionListsList(optionsHash);
            case TwitSideModule.TL_TYPE.TEMP_MEMBERSHIPLISTS:
                return this._tweet.membershipListsList(optionsHash);
            }
            return Promise.reject();
        })();

        TwitSideModule.debug.log('got lists: next_cursor = ' + result.data.next_cursor_str);

        this._lists_cursor = result.data.next_cursor_str;
        return { status : result.status,
                 data   : result.data.lists,
                 more   : this.hasMoreList };
    }
    // リストメンバー一覧
    async getListMembers(optionsHash) {
        if (this._members_cursor == '0')
            return { status : null, data : [] };

        // Twitterに送信するオプション
        optionsHash.count   = LISTMEMBERS_COUNT;
        optionsHash.cursor  = this._members_cursor;
        optionsHash.list_id = this._listid;

        const result = await (() => {
            switch (this._tl_type) {
            case TwitSideModule.TL_TYPE.TEMP_LISTMEMBER:
                return this._tweet.listMembers(optionsHash);
            case TwitSideModule.TL_TYPE.TEMP_LISTSUBSCRIBER:
                return this._tweet.listSubscribers(optionsHash);
            }
            return Promise.reject();
        })();

        TwitSideModule.debug.log('got listmembers: next_cursor = ' + result.data.next_cursor_str);

        this._members_cursor = result.data.next_cursor_str;
        return { status : result.status,
                 data   : result.data.users,
                 more   : this.hasMoreListMember };
    }

    // リストにメンバー追加
    addMember2List(optionsHash) {
    }
    // リストからメンバー削除
    delMemberFromList(optionsHash) {
    }
};
