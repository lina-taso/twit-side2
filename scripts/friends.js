/**
 * @fileOverview Managing friends
 * @name friends.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

const FRIENDS_INTERVAL = 600,
      FRIENDS_COUNT    = 200;

if (!TwitSideModule) var TwitSideModule = {};

TwitSideModule.Friends = {

    _follows       : {},
    // {userid: { ids: [userid, userid,...], cursor: next, loading: true/false, updated}, userid: {}...}
    _followers     : {},
    _mutes         : {},
    _blocks        : {},
    _noretweets    : {}, // {userid: { ids: [userid, userid,...], updated}, userid: {}...}
    _latestfriends : [], // [ userinfo_hash, ... ]

    // 続きの有無
    hasMoreFollow : function(userid) {
        return this._follows[userid]
            && this._follows[userid].cursor != null
            && this._follows[userid].cursor != '0'
            ? true : false;
    },

    // 続きの有無
    hasMoreFollower : function(userid) {
        return this._followers[userid]
            && this._followers[userid].cursor != null
            && this._followers[userid].cursor != '0'
            ? true : false;
    },

    // 続きの有無
    hasMoreMute : function(ownid) {
        return this._mutes[ownid]
            && this._mutes[ownid].cursor != null
            && this._mutes[ownid].cursor != '0'
            ? true : false;
    },

    // 続きの有無
    hasMoreBlock : function(ownid) {
        return this._blocks[ownid]
            && this._blocks[ownid].cursor != null
            && this._blocks[ownid].cursor != '0'
            ? true : false;
    },

    // 続きの有無
    hasMoreNoretweet : (ownid) => { return false; },

    // フレンド一覧初期化
    clearFriends : function(type, userid) {
        switch (type) {
        case TwitSideModule.FRIEND_TYPE.FOLLOW:
            if (this._follows[userid]) delete this._follows[userid];
            break;
        case TwitSideModule.FRIEND_TYPE.FOLLOWER:
            if (this._followers[userid]) delete this._followers[userid];
            break;
        case TwitSideModule.FRIEND_TYPE.MUTE:
            if (this._mutes[userid]) delete this._mutes[userid];
            break;
        case TwitSideModule.FRIEND_TYPE.BLOCK:
            if (this._blocks[userid]) delete this._blocks[userid];
            break;
        case TwitSideModule.FRIEND_TYPE.NORETWEET:
            if (this._noretweets[userid]) delete this._noretweets[userid];
            break;
        }
    },

    getFollows : function(userid) {
        if (this._follows[userid]) return this._follows[userid].ids;
        else return null;
    },
    getFollowers : function(userid) {
        if (this._followers[userid]) return this._followers[userid].ids;
        else return null;
    },
    getMutes : function(ownid) {
        if (this._mutes[ownid]) return this._mutes[ownid].ids;
        else return null;
    },
    getBlocks : function(ownid) {
        if (this._blocks[ownid]) return this._blocks[ownid].ids;
        else return null;
    },
    getNoretweets : function(ownid) {
        if (this._noretweets[ownid]) return this._noretweets[ownid].ids;
        else return null;
    },
    get latestfriends() {
        return this._latestfriends.map(v => '@' + v.screen_name);
    },
    searchFriendFromId : function(userid) {
        return this._latestfriends.find((v) => v.id_str == userid);
    },
    searchFriendFromSn : function(screenname) {
        screenname = screenname.replace(/^@/, '').replace(/[ ]+$/, '');
        return this._latestfriends.find((v) => v.screen_name == screenname);
    },
    // 友達のユーザID一覧を取得
    loadFriendIdList : async function(type, tweet, userid) {
        userid = userid || tweet.user_id;
        const optionsHash = { user_id : userid };

        switch (type) {
        case TwitSideModule.FRIEND_TYPE.FOLLOW:
            // 読み込み中なら終了
            if (this._follows[userid] && this._follows[userid].loading) return;
            // 未取得時
            if (this._follows[userid] == null)
                this._follows[userid] = {
                    ids     : [],
                    cursor  : null,
                    loading : false,
                    updated : 0
                };
            // 取得済み（カーソル）
            else if (this._follows[userid].cursor != '0')
                optionsHash['cursor'] = this._follows[userid].cursor;
            // 取得完了時（最終取得から時間経過）
            else if (this._follows[userid].updated + FRIENDS_INTERVAL < TwitSideModule.text.getUnixTime()) {
                delete this._follows[userid];
                this._follows[userid] = {
                    ids     : [],
                    cursor  : null,
                    loading : false,
                    updated : 0
                };
            }
            // 取得完了時
            else return;
            // 取得実施
            this._follows[userid].loading = true;
            const result_follow = await tweet.followlist(optionsHash)
                  .catch(() => {
                      this._follows[userid].loading = false;
                      return Promise.reject();
                  });
            this._follows[userid].loading = false;
            this._follows[userid].ids     = this._follows[userid].ids.concat(result_follow.data.ids);
            this._follows[userid].cursor  = result_follow.data.next_cursor_str;
            this._follows[userid].updated = TwitSideModule.text.getUnixTime();
            return;

        case TwitSideModule.FRIEND_TYPE.FOLLOWER:
            // 読み込み中なら終了
            if (this._followers[userid] && this._followers[userid].loading) return;
            // 未取得時
            if (this._followers[userid] == null) {
                this._followers[userid] = {
                    ids     : [],
                    cursor  : null,
                    loading : false,
                    updated : 0,
                };
            }
            // 取得済み（カーソル）
            else if (this._followers[userid].cursor != '0')
                optionsHash['cursor'] = this._followers[userid].cursor;
            // 取得完了時（最終取得から時間経過）
            else if (this._followers[userid].updated + FRIENDS_INTERVAL < TwitSideModule.text.getUnixTime()) {
                delete this._followers[userid];
                this._followers[userid] = {
                    ids     : [],
                    cursor  : null,
                    loading : false,
                    updated : 0,
                };
            }
            // 取得完了時
            else return;
            // 取得実施
            this._followers[userid].loading = true;
            const result_follower = await tweet.followerlist(optionsHash)
                  .catch(() => {
                      this._followers[userid].loading = false;
                      return Promise.reject();
                  });
            this._followers[userid].loading = false;
            this._followers[userid].ids     = this._followers[userid].ids.concat(result_follower.data.ids);
            this._followers[userid].cursor  = result_follower.data.next_cursor_str;
            this._followers[userid].updated = TwitSideModule.text.getUnixTime();
            return;

        case TwitSideModule.FRIEND_TYPE.MUTE:
            // 読み込み中なら終了
            if (this._mutes[userid] && this._mutes[userid].loading) return;
            // 未取得時
            if (this._mutes[userid] == null) {
                this._mutes[userid] = {
                    ids     : [],
                    cursor  : null,
                    loading : false,
                    updated : 0
                };
            }
            // 取得済み（カーソル）
            else if (this._mutes[userid].cursor != 0)
                optionsHash['cursor'] = this._mutes[userid].cursor;
            // 取得完了時（最終取得から時間経過）
            else if (this._mutes[userid].updated + FRIENDS_INTERVAL < TwitSideModule.text.getUnixTime()) {
                delete this._mutes[userid];
                this._mutes[userid] = {
                    ids     : [],
                    cursor  : null,
                    loading : false,
                    updated : 0
                };
            }
            // 取得完了時
            else return;
            // 取得実施
            this._mutes[userid].loading = true;
            const result_mute = await tweet.mutelist(optionsHash)
                  .catch(() => {
                      this._mutes[userid].loading = false;
                      return Promise.reject();
                  });
            this._mutes[userid].loading = false;
            this._mutes[userid].ids     = this._mutes[userid].ids.concat(result_mute.data.ids);
            this._mutes[userid].cursor  = result_mute.data.next_cursor_str;
            this._mutes[userid].updated = TwitSideModule.text.getUnixTime();

            // カーソルがある場合は続きのIDを取得
            if (result_mute.data.next_cursor_str != '0')
                await this.loadFriendIdList(type, tweet, userid);
            return;

        case TwitSideModule.FRIEND_TYPE.BLOCK:
            // 読み込み中なら終了
            if (this._blocks[userid] && this._blocks[userid].loading) return;
            // 未取得時
            if (this._blocks[userid] == null) {
                this._blocks[userid] = {
                    ids     : [],
                    cursor  : null,
                    loading : false,
                    updated : 0
                };
            }
            // 取得済み（カーソル）
            else if (this._blocks[userid].cursor != 0)
                optionsHash['cursor'] = this._blocks[userid].cursor;
            // 取得完了時（最終取得から時間経過）
            else if (this._blocks[userid].updated + FRIENDS_INTERVAL < TwitSideModule.text.getUnixTime()) {
                delete this._blocks[userid];
                this._blocks[userid] = {
                    ids     : [],
                    cursor  : null,
                    loading : false,
                    updated : 0
                };
            }
            // 取得完了時
            else return;
            // 取得実施
            this._blocks[userid].loading = true;
            const result_block = await tweet.blocklist(optionsHash)
                  .catch(() => {
                      this._blocks[userid].loading = false;
                      return Promise.reject();
                  });
            this._blocks[userid].loading = false;
            this._blocks[userid].ids     = this._blocks[userid].ids.concat(result_block.data.ids);
            this._blocks[userid].cursor  = result_block.data.next_cursor_str;
            this._blocks[userid].updated = TwitSideModule.text.getUnixTime();

            // カーソルがある場合は続きのIDを取得
            if (result_block.data.next_cursor_str != '0')
                await this.loadFriendIdList(type, tweet, userid);
            return;

        case TwitSideModule.FRIEND_TYPE.NORETWEET:
            // 読み込み中なら終了
            if (this._noretweets[userid] && this._noretweets[userid].loading) return;
            // 未取得時
            if (this._noretweets[userid] == null) {
                this._noretweets[userid] = {
                    ids     : [],
                    loading : false,
                    updated : 0
                };
            }
            // 取得完了時（最終取得から時間経過）
            else if (this._noretweets[userid].updated + FRIENDS_INTERVAL < TwitSideModule.text.getUnixTime()) {
                delete this._noretweets[userid];
                this._noretweets[userid] = {
                    ids     : [],
                    loading : false,
                    updated : 0
                };
            }
            // 取得完了時
            else return;
            // 取得実施
            this._noretweets[userid].loading = true;
            const result_noretweet = await tweet.noretweets(optionsHash)
                  .catch(() => {
                      this._noretweets[userid].loading = false;
                      return Promise.reject();
                  });
            this._noretweets[userid].loading = false;
            this._noretweets[userid].ids     = result_noretweet.data;
            this._noretweets[userid].updated = TwitSideModule.text.getUnixTime();
            return;

        default:
            return;
        }
    },

    // ユーザのフレンドシップ（ミュート、リツイート非表示）を変更
    updateFriendship : async function(type, userid, value_bool, tweet) {
        const ownid = tweet.user_id;

        switch (type) {
        case TwitSideModule.FRIEND_TYPE.FOLLOW:
            return value_bool
                ? await tweet.follow({ user_id : userid })
                : await tweet.unfollow({ user_id : userid });

        case TwitSideModule.FRIEND_TYPE.MUTE:
            if (value_bool) {
                const result_mute = await tweet.mute({ user_id : userid });
                const result_idx  = this._mutes[ownid].ids.indexOf(userid);
                if (result_idx < 0) this._mutes[ownid].ids.push(userid);
                return result_mute;
            }
            else {
                const result_mute = await tweet.unmute({ user_id : userid });
                const result_idx  = this._mutes[ownid].ids.indexOf(userid);
                if (result_idx >=0) this._mutes[ownid].ids.splice(result_idx, 1);
                return result_mute;
            }

        case TwitSideModule.FRIEND_TYPE.BLOCK:
            if (value_bool) {
                const result_block = await tweet.block({ user_id : userid });
                const result_idx  = this._blocks[ownid].ids.indexOf(userid);
                if (result_idx < 0) this._blocks[ownid].ids.push(userid);
                return result_block;
            }
            else {
                const result_block = await tweet.unblock({ user_id : userid });
                const result_idx  = this._blocks[ownid].ids.indexOf(userid);
                if (result_idx >=0) this._blocks[ownid].ids.splice(result_idx, 1);
                return result_block;
            }

        case TwitSideModule.FRIEND_TYPE.NORETWEET:
            {
                const result_noretweet = await tweet.updateFriendship({
                    user_id  : userid,
                    retweets : !value_bool
                });
                const result_idx = this._noretweets[ownid].ids.indexOf(userid);
                if (value_bool && result_idx < 0)
                    this._noretweets[ownid].ids.push(userid);
                else if (!value_bool && result_idx >= 0)
                    this._noretweets[ownid].ids.splice(result_idx, 1);
                return result_noretweet;
            }

        default:
            return Promise.reject();
        }
    },

    // 最近のスクリーンネーム
    updateLatestFriends : function(userinfo) {
        // useridを検索して存在すれば削除
        const idx = this._latestfriends.findIndex((v) => v.id_str == userinfo.id_str);
        if (idx >= 0) this._latestfriends.splice(idx, 1);

        this._latestfriends.unshift(JSON.parse(JSON.stringify(userinfo)));
        if (this._latestfriends.length > FRIENDS_COUNT) this._latestfriends.pop();
    },

    // ユーザIDからユーザ情報取得（最初の100件）
    lookup : async function(userids, tweet) {
        return await tweet.userLookup({ user_id : userids.join(',') });
    }
};
