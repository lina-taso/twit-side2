/**
 * @fileOverview Timeline module
 * @name timeline.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

const networkWait        = 250,
      apiWait            = 60000,
      httpWait           = 5000,
      infWait            = 300000,
      autoClearWait      = 60000,
      LIMIT_RETWEET_CNT  = 5,
      LIMIT_RETWEET_TERM = 60,
      ZERO_FILL          = '0000000000000000000000000',
      NINE_FILL          = '9999999999999999999999999',
      ZERO_FILL_LEN      = 25;

class Timeline {

    constructor(tl_type, columnid, userinfo_hash, win_type) {

        // 個別設定
        this._tl_type        = tl_type;
        this._columnid       = columnid;
        this._own_userid     = userinfo_hash.user_id;
        this._own_screenname = userinfo_hash.screen_name;
        this._win_type       = win_type;
        this._tweet          = new Tweet(userinfo_hash);

        // 初期値
        // レコード保持
        this.record = {
            data : {}, // 順序無視生データ { meta, raw }
            ids  : []  // ソートされたid一覧
        };
        this.hiddenRecordIDs    = [];
        // 自動更新タイマー
        this._autoReloadTimer   = null;
        // 自動削除タイマー
        this._autoClearTimer    = null;
        // オプション
        this._autoReloadEnabled = false;
        this._notifEnabled      = false;
        // ステータス
        this._state  = TwitSideModule.TL_STATE.STOPPED;
        this._state2 = TwitSideModule.TL_STATE.STOPPED;
        // options_hash
        this._getNewerHash = {};
        this._getOlderHash = {};
        // 回数制限（1分間）
        this._limitCount = {
            retweet : {
                limit   : LIMIT_RETWEET_CNT,
                history : []
            }
        };

        // オートクリア開始
        this._autoClearCount = 0;
        this.startAutoClear();

        TwitSideModule.debug.log('timeline.js: initialized columnid '+ JSON.stringify(columnid || {}));
    }

    // オブジェクト削除前のお掃除
    beforeDestroy() {
        this.stopAutoReload();
        this.stopAutoClear();
        // ツイートオブジェクト削除
        delete this._tweet;

        TwitSideModule.debug.log('timeline.js: unloaded columnid '+ JSON.stringify(this.columnid || {}));
    }
    // カラムID文字列取得
    get columnid() { return this._columnid; }
    // userid取得
    get userid() { return this._own_userid; }
    // screenname取得
    get screenname() { return this._own_screenname; }
    // targetid取得
    get targetid() { return this._targetid || null; }
    // type取得
    get type() { return this._tl_type; }
    // Newer state
    get loadingState() { return this._state; }
    // Older/More state
    get loadingState2() { return this._state2; }
    // リスト使用
    get isList() { return false; }
    // リストメンバー、購読者
    get isListMember() { return false; }
    // フォロー、フォロワー
    get isFriend() { return false; }
    // 検索
    get isSearch() {
        if (this._tl_type === TwitSideModule.TL_TYPE.SEARCH) return true;
        if (this._tl_type === TwitSideModule.TL_TYPE.TEMP_SEARCH) return true;
        return false;
    }
    // ダイレクトメッセージ
    get isDirectMessage() { return false; }
    // 読み込みパラメータ
    set getNewerHash(options_hash) {
        this._getNewerHash = Object.assign({}, options_hash);
    }
    get getNewerHash() {
        return Object.assign({}, this._getNewerHash);
    }
    // 読み込みパラメータ
    set getOlderHash(options_hash) {
        this._getOlderHash = Object.assign({}, options_hash);
    }
    get getOlderHash() {
        return Object.assign({}, this._getOlderHash);
    }
    // 全ツイート取得
    get allTweets() {
        return this.record.ids.slice();
    }
    // 1ツイート取得
    tweetInfo(boxid) {
        const idPath  = boxid.split('_'),
              isMore  = /_more$/.test(boxid),
              isQuote = /_inline_/.test(boxid),
              isReply = /_reply_/.test(boxid);

        // morebox
        if (isMore) {
            const idx    = this.record.ids.indexOf(boxid),
                  nextid = this.record.ids[idx+1] != null
                  ? this.record.ids[idx+1] : null;
            return {
                tweetinfo : JSON.parse(JSON.stringify(this.record.data[boxid])),
                nextid    : nextid
            };
        }
        else if (isQuote) {
            // reply of quoted tweet
            if (isReply) {
                const idx    = this.record.data[idPath[0]].quoted.replies.findIndex(reply => reply.meta.boxid === boxid),
                      nextid = this.record.data[idPath[0]].quoted.replies[idx+1] != null
                      ? this.record.data[idPath[0]].quoted.replies[idx+1]
                      : null;
                return {
                    tweetinfo : JSON.parse(JSON.stringify(this.record.data[idPath[0]].quoted.replies[idx])),
                    nextid    : nextid
                };
            }
            // quoted tweet
            else
                return {
                    tweetinfo : JSON.parse(JSON.stringify(this.record.data[idPath[0]].quoted)),
                    nextid    : null
                };
        }
        else {
            // reply
            if (isReply) {
                const idx    = this.record.data[idPath[0]].replies.findIndex(reply => reply.meta.boxid === boxid),
                      nextid = this.record.data[idPath[0]].replies[idx+1] != null
                      ? this.record.data[idPath[0]].replies[idx+1]
                      : null;
                return {
                    tweetinfo : JSON.parse(JSON.stringify(this.record.data[idPath[0]].replies[idx])),
                    nextid    : nextid
                };
            }
            // tweet
            else {
                const idx    = this.record.ids.indexOf(boxid),
                      nextid = this.record.ids[idx+1] != null
                      ? this.record.ids[idx+1] : null;
                return {
                    tweetinfo : JSON.parse(JSON.stringify(this.record.data[boxid])),
                    nextid    : nextid
                };
            }
        }
    }
    // タイムラインオプション
    updateOptions(options) {
        // 通知
        this._notifEnabled = options.notif || false;
        // mute
        this._muteEnabled = options.mute || false;
        // noretweet
        this._noretweetEnabled = options.noretweet || false;

        // 自動再読込
        this._autoReloadEnabled = options.autoreload || false;
        if (!options.autoreload) this.stopAutoReload();

        // 起動時読み込み
        if (options.onstart
            && this._state === TwitSideModule.TL_STATE.STOPPED)
            this.getNewer(false);

        // 自動再読込だけ開始
        if (!options.onstart && options.autoreload) this.startAutoReload();
    }
    // タイムラインステータスの再通知
    renotifyStatus(winid) {
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.STATE_CHANGED,
            columnid : this._columnid,
            state    : this._state
        }, winid, this._win_type);
    }
    // エラー処理
    _reportError(message) {
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.ERROR,
            message  : TwitSideModule.Message.transMessage(message),
            columnid : this._columnid
        }, null, this._win_type);
    }

    /**
     * 取得系
     */
    async getNewer(notif) {
        const error = (result) => {
            // 状態遷移
            this._state = TwitSideModule.TL_STATE.STOPPED;
            TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.STATE_CHANGED,
                columnid : this._columnid,
                state    : this._state
            }, null, this._win_type);

            this._reportError(result);
            return Promise.reject();
        };

        // 通知
        notif = notif == null ? true : notif;
        // Twitterに送信するオプション
        const optionsHash = this.getNewerHash;

        // 重複読み込み禁止
        if (this._state !== TwitSideModule.TL_STATE.STOPPED
            && this._state !== TwitSideModule.TL_STATE.STARTED)
            return;
        // 自動再読込停止
        this.stopAutoReload();

        // 状態遷移
        this._state = TwitSideModule.TL_STATE.STARTING;
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.STATE_CHANGED,
            columnid : this._columnid,
            state    : this._state
        }, null, this._win_type);

        // 読み込み
        const result = await this._sendQuery(optionsHash).catch(error);

        // フィルタ（読み込み済以外の件数）
        const filteredLength = result.data.filter((el) => {
            return this.record.ids.indexOf((ZERO_FILL + el.id_str).slice(-ZERO_FILL_LEN)) < 0;
        }).length;

        // more確認
        const more = this.record.ids.length
              ? (filteredLength > Math.ceil(optionsHash.count * 0.5))
              : (result.data.length > 5);

        // 受信データを登録
        const tweets = await this._saveTweets(result.data, more, notif);
        await TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.TWEET_LOADED,
            tweets   : tweets,
            tl_type  : this._tl_type,
            columnid : this._columnid,
            keep_position : true
        }, null, this._win_type);

        // 状態遷移
        this._state = TwitSideModule.TL_STATE.STOPPED;
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.STATE_CHANGED,
            columnid : this._columnid,
            state    : this._state
        }, null, this._win_type);

        // 自動再読込開始
        if (this._autoReloadEnabled) this.startAutoReload();
    }
    async getOlder() {
        const error = (result) => {
            // 状態遷移
            this._state2 = TwitSideModule.TL_STATE.STOPPED;
            TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.STATE_CHANGED,
                columnid : this._columnid,
                state    : TwitSideModule.TL_STATE.LOADED
            }, null, this._win_type);

            this._reportError(result);
            return Promise.reject();
        };

        const moreid = this.record.ids[this.record.ids.length-1],
              maxid  = this.record.ids[this.record.ids.length-2];
        // moreidがmoreじゃないとき（読み込み完了時）
        if (!/_more$/.test(moreid)) return;

        // Twitterに送信するオプション
        const optionsHash = this.getOlderHash;
        // 読み込み範囲（これより小さい＝古い）
        optionsHash.max_id = maxid;

        // 重複読み込み禁止
        if (this._state2 !== TwitSideModule.TL_STATE.STOPPED) return;

        // 状態遷移
        this._state2 = TwitSideModule.TL_STATE.LOADING;
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.STATE_CHANGED,
            columnid : this._columnid,
            state    : this._state2
        }, null, this._win_type);

        // 読み込み
        const result = await this._sendQuery(optionsHash).catch(error);

        // フィルタ（読み込み済のものは除去）
        result.data = result.data.filter((el) => {
            return this.record.ids.indexOf((ZERO_FILL + el.id_str).slice(-ZERO_FILL_LEN)) < 0;
        });

        // more確認
        const more = this.record.ids.length
              ? (result.data.length > Math.ceil(optionsHash.count * 0.5))
              : (result.data.length > 5);

        // 受信データを登録
        const tweets = await this._saveTweets(result.data, more);
        await TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.TWEET_LOADED,
            tweets   : tweets,
            tl_type  : this._tl_type,
            columnid : this._columnid
        }, null, this._win_type);

        await this._removeTweets([moreid]);

        // 状態遷移
        this._state2 = TwitSideModule.TL_STATE.STOPPED;
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.STATE_CHANGED,
            columnid : this._columnid,
            state    : TwitSideModule.TL_STATE.LOADED
        }, null, this._win_type);
    }
    async getMore(moreid) {
        const error = (result) => {
            // 状態遷移
            this._state2 = TwitSideModule.TL_STATE.STOPPED;
            TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.STATE_CHANGED,
                columnid : this._columnid,
                state    : TwitSideModule.TL_STATE.LOADED
            }, null, this._win_type);

            this._reportError(result);
            return Promise.reject();
        };

        // Twitterに送信するオプション
        const optionsHash = this.getOlderHash,
              maxindex    = this.record.ids.indexOf(moreid) - 1,
              minindex    = maxindex + 2;

        if (minindex >= this.record.ids.length) {
            await this.getOlder();
            return;
        }

        const maxid = this.record.ids[maxindex],
              minid = this.record.ids[minindex];
        // 読み込み範囲（これより小さい＝古い）
        optionsHash.max_id = maxid;

        // 重複読み込み禁止
        if (this._state2 !== TwitSideModule.TL_STATE.STOPPED) return;

        // 状態遷移
        this._state2 = TwitSideModule.TL_STATE.LOADING;
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.STATE_CHANGED,
            columnid : this._columnid,
            state    : this._state2
        }, null, this._win_type);

        // 読み込み
        const result = await this._sendQuery(optionsHash).catch(error);

        // フィルタ（読み込み済のものは除去）
        result.data = result.data.filter((el) => {
            return this.record.ids.indexOf((ZERO_FILL + el.id_str).slice(-ZERO_FILL_LEN)) < 0;
        });

        // more確認
        const more = this.record.ids.length
              ? (result.data.length > Math.ceil(optionsHash.count * 0.5))
              : (result.data.length > 5);

        // 受信データを登録
        const tweets = await this._saveTweets(result.data, more);
        await TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.TWEET_LOADED,
            tweets   : tweets,
            tl_type  : this._tl_type,
            columnid : this._columnid
        }, null, this._win_type);

        // 状態遷移
        await this._removeTweets([moreid]);
        this._state2 = TwitSideModule.TL_STATE.STOPPED;
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.STATE_CHANGED,
            columnid : this._columnid,
            state    : TwitSideModule.TL_STATE.LOADED
        }, null, this._win_type);
    }

    /**
     * 自動読み込み
     */
    startAutoReload() {
        // 重複読み込み禁止
        if (this._state === TwitSideModule.TL_STATE.STARTED)
            return;

        const interval = this.isSearch
              ? TwitSideModule.config.getPref('autosearch_time') * 1000
              : TwitSideModule.config.getPref('autoreload_time') * 1000;

        // 自動更新有効化ステータス
        this._state = TwitSideModule.TL_STATE.STARTED;
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.STATE_CHANGED,
            columnid : this._columnid,
            state    : this._state
        }, null, this._win_type);

        this._autoReloadTimer = setTimeout(() => {
            // 取得
            if (!this.getNewer()) {
                // 失敗時
                this._state = TwitSideModule.TL_STATE.STARTED;
                this.startAutoReload();
            }
            // インターバルに1.3倍までのゆらぎ
        }, interval * (Math.floor(Math.random()*3)/10+1));
    }
    stopAutoReload() {
        if (this._autoReloadTimer != null) clearTimeout(this._autoReloadTimer);
        this._autoReloadTimer = null;

        // 自動更新有効化ステータス
        this._state = TwitSideModule.TL_STATE.STOPPED;
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.STATE_CHANGED,
            columnid : this._columnid,
            state    : this._state
        }, null, this._win_type);
    }

    /**
     * 自動クリア
     */
    startAutoClear() {
        // MAIN以外はは対象外
        if (this._win_type != TwitSideModule.WINDOW_TYPE.MAIN) return;

        // タイマー設定
        this._autoClearTimer = setInterval(async () => {
            // 投票依頼
            const result = await TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.VOTE_REQUIRED,
                columnid : this._columnid
            }, null, this._win_type);

            // 過去ツイート削除
            if (!result.includes(false)) this._clearOlder();
        }, autoClearWait);
    }
    stopAutoClear() {
        if (this._autoClearTimer != null) clearInterval(this._autoClearTimer);
        this._autoClearTimer = null;
    }

    /**
     * ツイート操作系
     */
    async retweet(boxid) {
        const error = (result) => {
            TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.ACTION_COMPLETED,
                action   : 'retweet',
                result   : 'failed',
                boxid    : boxid,
                columnid : this._columnid,
                message  : TwitSideModule.Message.transMessage(result)
            }, null, this._win_type);

            return Promise.reject();
        };

        // 回数制限
        const limitHistory = JSON.parse(TwitSideModule.config.getPref('limit_retweet'));
        if (!TwitSideModule.config.debug
            && limitHistory.length >= LIMIT_RETWEET_CNT
            && TwitSideModule.text.getUnixTime() - (limitHistory[0] || 0) < LIMIT_RETWEET_TERM) {
            this._reportError('retweetLimit');
            return;
        }

        const idPath   = boxid.split('_'),
              isQuote  = /_inline_/.test(boxid),
              parentId = idPath[0],
              targetId = idPath.pop();

        const result = await this._tweet.retweet({}, targetId).catch(error);

        // アクション完了
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.ACTION_COMPLETED,
            action   : 'retweet',
            result   : 'success',
            boxid    : boxid,
            columnid : this._columnid
        }, null, this._win_type);

        // 回数制限
        while (limitHistory.length >= LIMIT_RETWEET_CNT) limitHistory.shift();
        limitHistory.push(TwitSideModule.text.getUnixTime());
        await TwitSideModule.config.setPref('limit_retweet', JSON.stringify(limitHistory));

        // ツイート再読込
        const result_show = await this._tweet.show({ id : parentId });

        // 受信データを登録
        const tweets = await this._saveTweets([result_show.data]);
        await TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.REPLACE_LOADED,
            tweets   : tweets,
            tl_type  : this._tl_type,
            columnid : this._columnid
        }, null, this._win_type);
    }
    async favorite(boxid, sw) {
        const error = (result) => {
            TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.ACTION_COMPLETED,
                action   : sw ? 'favorite' : 'unfavorite',
                result   : 'failed',
                boxid    : boxid,
                columnid : this._columnid,
                message  : TwitSideModule.Message.transMessage(result)
            }, null, this._win_type);

            return Promise.reject();
        };

        const idPath   = boxid.split('_'),
              isQuote  = /_inline_/.test(boxid),
              parentId = idPath[0],
              targetId = idPath.pop();

        const result = sw
              ? await this._tweet.favorite({ id : targetId }).catch(error)
              : await this._tweet.unfavorite({ id : targetId }).catch(error);

        // アクション完了
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.ACTION_COMPLETED,
            action   : sw ? 'favorite' : 'unfavorite',
            result   : 'success',
            boxid    : boxid,
            columnid : this._columnid
        }, null, this._win_type);

        if (this._tl_type === TwitSideModule.TL_TYPE.FAVORITE
            || this._tl_type === TwitSideModule.TL_TYPE.TEMP_FAVORITE)
            await this._removeTweets([boxid]);
        else {
            // ツイート再読込
            const result_show = await this._tweet.show({ id : parentId });

            // 受信データを登録
            const tweets = await this._saveTweets([result_show.data]);
            await TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.REPLACE_LOADED,
                tweets   : tweets,
                tl_type  : this._tl_type,
                columnid : this._columnid
            }, null, this._win_type);
        }
    }
    async replies(boxid, replyid) {
        const error = (result) => {
            this._reportError(result);
            return Promise.reject();
        };

        const idPath      = boxid.split('_'),
              isQuote     = /_inline_/.test(boxid),
              parentTweet = this.record.data[idPath[0]];

        let targetReplies;

        // 最初のツイート
        if (!replyid) {
            // 引用ツイートの会話
            if (isQuote) {
                targetReplies = parentTweet.quoted.replies = [];
                replyid = parentTweet.raw.retweeted_status
                    ? parentTweet.raw.retweeted_status.quoted_status.in_reply_to_status_id_str
                    : parentTweet.raw.quoted_status.in_reply_to_status_id_str;
            }
            // 通常ツイートの会話
            else {
                targetReplies = parentTweet.replies = [];
                replyid = parentTweet.raw.retweeted_status
                    ? parentTweet.raw.retweeted_status.in_reply_to_status_id_str
                    : parentTweet.raw.in_reply_to_status_id_str;
            }
        }
        // リプライ2つめ以降
        else
            targetReplies = isQuote
            ? parentTweet.quoted.replies
            : parentTweet.replies;

        const result   = await this._tweet.show({ id : replyid }).catch(error);

        const targetId = boxid + '_reply_' + this._zeroFillId(result.data);
        targetReplies.push({
            meta : this._getMetadata(result.data, targetId),
            raw  : result.data
        });
        await TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.REPLY_LOADED,
            boxid    : targetId,
            tl_type  : this._tl_type,
            columnid : this._columnid
        }, null, this._win_type);

        // 続きを読み込み
        if (result.data.in_reply_to_status_id_str)
            await this.replies(boxid, result.data.in_reply_to_status_id_str);
    }
    async destroy(boxid) {
        const error = (result) => {
            TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.ACTION_COMPLETED,
                action   : 'destroy',
                result   : 'failed',
                boxid    : boxid,
                columnid : this._columnid,
                message  : TwitSideModule.Message.transMessage(result)
            }, null, this._win_type);

            return Promise.reject();
        };

        const idPath   = boxid.split('_'),
              isQuote  = /_inline_/.test(boxid),
              parentId = idPath[0],
              targetId = idPath.pop();

        const targetTweet = isQuote
              ? this.record.data[parentId].quoted
              : this.record.data[parentId];

        // ツイート取得
        const callback_show = async (result) => {
            // リツイートしたことが確認出来た
            if (result.data.current_user_retweet) {
                const result_destroy = await this._tweet.destroy({ }, result.data.current_user_retweet.id_str);
                // アクション完了
                TwitSideModule.windows.sendMessage({
                    reason   : TwitSideModule.UPDATE.ACTION_COMPLETED,
                    action   : 'destroy',
                    result   : 'success',
                    boxid    : boxid,
                    columnid : this._columnid
                }, null, this._win_type);

                // リツイートされたツイートの再読込
                const result_show = await this._tweet.show({ id : parentId });

                // 受信データを登録
                const tweets = await this._saveTweets([result_show.data]);
                await TwitSideModule.windows.sendMessage({
                    reason   : TwitSideModule.UPDATE.REPLACE_LOADED,
                    tweets   : tweets,
                    tl_type  : this._tl_type,
                    columnid : this._columnid
                }, null, this._win_type);
            }
        };
        // ツイート取得
        const callback_show_mine = async (result) => {
            // リツイートしたことが確認出来た
            if (result.data.current_user_retweet) {
                const result_destroy = await this._tweet.destroy({ }, result.data.current_user_retweet.id_str);
                // アクション完了
                TwitSideModule.windows.sendMessage({
                    reason   : TwitSideModule.UPDATE.ACTION_COMPLETED,
                    action   : 'destroy',
                    result   : 'success',
                    boxid    : boxid,
                    columnid : this._columnid
                }, null, this._win_type);

                if (isQuote) {
                    // 引用元ツイートの再読込
                    const result_show = await this._tweet.show({ id : parentId });

                    // 受信データを登録
                    const tweets = await this._saveTweets([result_show.data]);
                    await TwitSideModule.windows.sendMessage({
                        reason   : TwitSideModule.UPDATE.REPLACE_LOADED,
                        tweets   : tweets,
                        tl_type  : this._tl_type,
                        columnid : this._columnid
                    }, null, this._win_type);
                }
                else
                    // 削除
                    await this._removeTweets([targetId]);
            }
        };
        // 自分のツイートを削除
        const callback_mine = async (result) => {
            // アクション完了
            TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.ACTION_COMPLETED,
                action   : 'destroy',
                result   : 'success',
                boxid    : boxid,
                columnid : this._columnid
            }, null, this._win_type);

            if (isQuote) {
                // 引用元ツイートの再読込
                const result_show = await this._tweet.show({ id : parentId });

                // 受信データを登録
                const tweets = await this._saveTweets([result_show.data]);
                await TwitSideModule.windows.sendMessage({
                    reason   : TwitSideModule.UPDATE.REPLACE_LOADED,
                    tweets   : tweets,
                    tl_type  : this._tl_type,
                    columnid : this._columnid
                }, null, this._win_type);
            }
            else
                // 削除
                await this._removeTweets([targetId]);
        };

        if (targetTweet.meta.isMine) {
            // リツイート
            if (targetTweet.raw.retweeted
                && targetTweet.raw.retweeted_status)
                callback_show_mine(await this._tweet.show({
                    id : targetTweet.raw.retweeted_status.id_str,
                    include_my_retweet : 'true'
                }).catch(error));
            else if (targetTweet.raw.retweeted
                     && !targetTweet.raw.retweeted_status)
                callback_show(await this._tweet.show({
                    id : targetId,
                    include_my_retweet : 'true'
                }).catch(error));
            // 自分のツイートはそのまま削除
            else
                callback_mine(await this._tweet.destroy({ }, targetId))
                .catch(error);
        }
        else {
            // リツイート
            if (targetTweet.raw.retweeted)
                callback_show(await this._tweet.show({
                    id : targetTweet.raw.retweeted_status
                        ? targetTweet.raw.retweeted_status.id_str
                        : targetId,
                    include_my_retweet : 'true'
                }).catch(error));
        }
    }
    async retweeters(boxid) {
        const error = (result) => {
            this._reportError(result);
            return Promise.reject();
        };

        const idPath   = boxid.split('_'),
              isQuote  = /_inline_/.test(boxid),
              parentId = idPath[0];

        const targetTweet = isQuote
              ? this.record.data[parentId].quoted
              : this.record.data[parentId],
              targetId    = targetTweet.raw.retweeted_status
              ? targetTweet.raw.retweeted_status.id_str
              : targetTweet.raw.id_str;

        const result = await this._tweet.retweeters({ id : targetId, count : 100 }).catch(error);

        // メタデータ更新
        targetTweet.meta.retweeters = [];
        for (let rt of (result.data)) {
            targetTweet.meta.retweeters.push({
                src   : rt.user.profile_image_url_https,
                title : '@' + rt.user.screen_name
            });
        }

        await TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.REPLACE_LOADED,
            tweets   : [parentId],
            tl_type  : this._tl_type,
            columnid : this._columnid
        }, null, this._win_type);
    }

    /**
     * ツイート取得
     */
    async _sendQuery(optionsHash) {
        switch (this._tl_type) {
        case TwitSideModule.TL_TYPE.TIMELINE:
        case TwitSideModule.TL_TYPE.TIMELINE_V2:
            return await this._tweet.timeline(optionsHash);
        case TwitSideModule.TL_TYPE.CONNECT:
        case TwitSideModule.TL_TYPE.CONNECT_V2:
            return await this._tweet.connect(optionsHash);
        case TwitSideModule.TL_TYPE.RETWEETED:
            return await this._tweet.retweeted(optionsHash);
        case TwitSideModule.TL_TYPE.LISTTIMELINE:
            return await this._tweet.listTimeline(optionsHash);
        case TwitSideModule.TL_TYPE.TEMP_USERTIMELINE:
        case TwitSideModule.TL_TYPE.TEMP_USERTIMELINE_V2:
            return await this._tweet.userTimeline(optionsHash);
        case TwitSideModule.TL_TYPE.FAVORITE:
        case TwitSideModule.TL_TYPE.FAVORITE_V2:
        case TwitSideModule.TL_TYPE.TEMP_FAVORITE:
        case TwitSideModule.TL_TYPE.TEMP_FAVORITE_V2:
            return await this._tweet.favoritelist(optionsHash);
        case TwitSideModule.TL_TYPE.SEARCH:
        case TwitSideModule.TL_TYPE.TEMP_SEARCH:
            return this._tweet.search(optionsHash)
                .then((result) => {
                    result.data = result.data.statuses;
                    return result;
                });
        }
        return Promise.reject();
    }

    // ツイートを保存して変更があったid一覧を返す
    async _saveTweets(data, more, notif) {
        // 更新したツイートID
        let lastidx = null, // 最新ツイートのインデックス
            i = 0;
        const tweets     = [],
              notified   = [];

        const mutes = this._muteEnabled
              ? TwitSideModule.Friends.getMutes(this._own_userid) || []
              : [],
              noretweets = this._noretweetEnabled
              ? TwitSideModule.Friends.getNoretweets(this._own_userid) || []
              : [];

        // dataは新しいもの順
        for (let datum of data) {
            const target_id = this._zeroFillId(datum);
            if (!target_id) continue;

            // muteの時は破棄
            if (mutes.length
                && mutes.indexOf(
                    datum.retweeted_status
                        ? datum.retweeted_status.user.id_str
                        : datum.user.id_str
                ) >= 0) {
                await this._removeTweets([target_id]);
                continue;
            }

            // noretweetの時は破棄
            if (datum.retweeted_status
                && noretweets.length
                && noretweets.indexOf(datum.user.id_str) >= 0) {
                await this._removeTweets([target_id]);
                continue;
            }

            // TwitSideミュート
            if (this._muteEnabled && TwitSideModule.config.getPref('mute_ts')) {
                if (TwitSideModule.Mutes.checkMuteUsers(
                    datum.retweeted_status
                        ? [ datum.user.id_str,
                            datum.retweeted_status.user.id_str ]
                        : [ datum.user.id_str ]
                )) {
                    await this._removeTweets([target_id]);
                    continue;
                }
                if (TwitSideModule.Mutes.checkMuteKeywords(
                    datum.retweeted_status
                        ? datum.retweeted_status.full_text || datum.retweeted_status.text
                        : datum.full_text || datum.text
                )) {
                    await this._removeTweets([target_id]);
                    continue;
                }
            }

            // メタデータ確認
            const meta = this._getMetadata(datum, target_id);
            this.record.data[target_id] = {
                meta : meta,
                raw  : datum
            };

            // 新規ID
            const exidx = this.record.ids.indexOf(target_id);
            if (exidx < 0) {
                // ID一覧更新
                const len = this.record.ids.length;

                // 挿入ソート（前から、新しいものから）
                for (i; i<=len; i++) {
                    // 末尾
                    if (i == len) {
                        this.record.ids.push(target_id);
                        lastidx = i+1;
                        break;
                    }
                    if (this.record.ids[i] < target_id) {
                        this.record.ids.splice(i, 0, target_id);
                        lastidx = i+1;
                        break;
                    }
                }
            }
            // 既存ID
            else lastidx = exidx + 1;


            // Quoteメタデータ確認
            if (datum.retweeted_status
                && datum.retweeted_status.is_quote_status
                && datum.retweeted_status.quoted_status)
                this.record.data[target_id].quoted = {
                    meta : this._getMetadata(
                        datum.retweeted_status.quoted_status,
                        target_id+'_inline_'+datum.retweeted_status.quoted_status.id_str
                    ),
                    raw  : datum.retweeted_status.quoted_status
                };
            else if (datum.is_quote_status && datum.quoted_status)
                this.record.data[target_id].quoted = {
                    meta : this._getMetadata(
                        datum.quoted_status,
                        target_id+'_inline_'+datum.quoted_status.id_str
                    ),
                    raw  : datum.quoted_status
                };

            // 通知チェック
            if (this._notifEnabled
                && this._tl_type === TwitSideModule.TL_TYPE.TIMELINE
                && target_id > TwitSideModule.ManageColumns.getLastNotifyId(this._columnid)) {
                // 自分宛
                if (meta.isForMe && ! datum.retweeted_status
                    && TwitSideModule.config.getPref('notif_forme')) {

                    // 最終通知
                    notified.push(target_id);

                    notif && TwitSideModule.Message.showNotification({
                        userid  : this._own_userid,
                        title   : browser.i18n.getMessage('newMention', ['@' + datum.user.screen_name]),
                        icon    : datum.user.profile_image_url_https.replace('_normal.', '.'),
                        content : meta.text
                    });
                }
                // 自分宛リツイート
                else if (meta.isForMe && datum.retweeted_status
                         && TwitSideModule.config.getPref('notif_forme_retweeted')) {
                    // 最終通知
                    notified.push(target_id);

                    notif && TwitSideModule.Message.showNotification({
                        userid  : this._own_userid,
                        title   : browser.i18n.getMessage('newRetweet', ['@' + datum.user.screen_name]),
                        icon    : datum.user.profile_image_url_https.replace('_normal.', '.'),
                        content : meta.text
                    });
                }
            }

            // 更新データ（新しいもの順のはず）
            tweets.push(target_id);
        }
        // 更新データ（改めて新しいもの順）
        tweets.sort().reverse();

        // 通知チェック
        // すべてのツイート（1つのみ表示）
        if (notif && this._notifEnabled
            && this._tl_type === TwitSideModule.TL_TYPE.TIMELINE
            && TwitSideModule.config.getPref('notif_all')
            && tweets.length) {

            // 最新ツイートIDが既存のIDより新しい
            if (tweets[0] > this.record.ids[0]) {
                // dataの中からtweets[0]のIDのツイートを探す
                for (let datum of data) {
                    if (tweets[0] != datum.id_str) continue;

                    const target_user = data[0].retweeted_status
                          ? data[0].retweeted_status.user.screen_name
                          : data[0].user.screen_name;
                    const target_user_icon = data[0].retweeted_status
                          ? data[0].retweeted_status.user.profile_image_url_https.replace('_normal.', '.')
                          : data[0].user.profile_image_url_https.replace('_normal.', '.');
                    TwitSideModule.Message.showNotification({
                        userid  : this._own_userid,
                        title   : browser.i18n.getMessage('newTweet', ['@' + target_user]),
                        icon    : target_user_icon,
                        content : this.record.data[data[0].id_str].meta.text
                    }, true);
                    break;
                }
            }
        }
        // 検索
        if (this._notifEnabled
            && this._tl_type === TwitSideModule.TL_TYPE.SEARCH
            && tweets[0] > TwitSideModule.ManageColumns.getLastNotifyId(this._columnid)) {

            // 最新ツイートIDが既存のIDより新しい
            const filteredTweets = tweets.filter(id => id > TwitSideModule.ManageColumns.getLastNotifyId(this._columnid));

            if (filteredTweets.length) {
                // 最終通知
                notified.push(filteredTweets[0]);

                notif && TwitSideModule.Message.showNotification({
                    userid  : this._own_userid,
                    title   : browser.i18n.getMessage('newSearched', [filteredTweets.length]),
                    content : browser.i18n.getMessage('newSearchQuery') + this._getNewerHash.q
                }, true);

            }
        }

        // 最終通知ID更新
        if (notified.length)
            await TwitSideModule.ManageColumns.setLastNotifyId(this._columnid, notified[0]);

        // more格納
        if (more && data.length) {
            // 連続するmoreを防止
            if (/_more$/.test(this.record.ids[lastidx]))
                await this._removeTweets([this.record.ids[lastidx]]);

            const moreid = data[data.length-1].id_str + '_more';
            this.record.data[moreid] = {
                meta : { boxid : moreid },
                raw  : { id_str : moreid }
            };
            this.record.ids.splice(lastidx, 0, moreid);
            tweets.push(moreid);
        }
        return tweets;
    }
    // IDゼロフィル
    _zeroFillId(datum) {
        if (datum.id_str)
            datum.id_str = (ZERO_FILL + datum.id_str).slice(-ZERO_FILL_LEN);
        else return null; // 不正なデータ

        if (datum.retweeted_status)
            datum.retweeted_status.id_str = (ZERO_FILL + datum.retweeted_status.id_str)
            .slice(-ZERO_FILL_LEN);
        if (datum.quoted_status)
            datum.quoted_status.id_str = (ZERO_FILL + datum.quoted_status.id_str)
            .slice(-ZERO_FILL_LEN);
        if (datum.retweeted_status && datum.retweeted_status.quoted_status)
            datum.retweeted_status.quoted_status.id_str =
            (ZERO_FILL + datum.retweeted_status.quoted_status.id_str)
            .slice(-ZERO_FILL_LEN);
        return datum.id_str;
    }
    // メタデータの作成
    _getMetadata(datum, boxid) {
        const meta = {
            boxid   : boxid,
            isMine  : datum.user.id_str === this._own_userid,
            isForMe : false,
            pics    : []
        };

        // エンティティ
        if (datum.retweeted_status) {
            meta.entities = datum.retweeted_status.extended_tweet
                ? datum.retweeted_status.extended_tweet.entities
                : datum.retweeted_status.entities;
            // extened_entitiesが無くても例外を投げない
            Object.assign(meta.entities, datum.retweeted_status.extended_entities || {});
        }
        else {
            meta.entities = datum.extended_tweet
                ? datum.extended_tweet.entities : datum.entities;
            // extened_entitiesが無くても例外を投げない
            Object.assign(meta.entities, datum.extended_entities || {});
        }

        // サードパーティ画像URLの処理
        for (let url of meta.entities.urls)
            this._analyzePicURL(url.expanded_url, meta);

        // pic.twitterの処理
        for (let media of meta.entities.media || [])
            this._procPicTwtrURL(media, meta);

        // テキスト
        meta.text = datum.retweeted_status
            ? datum.retweeted_status.full_text || datum.text
            : datum.full_text || datum.text;
        meta.display_text_range = {};
        Object.assign(meta.display_text_range, datum.retweeted_status
                      ? datum.retweeted_status.display_text_range
                      : datum.display_text_range, {});

        // ユーザ一覧
        const screennamelist = [], // ツイートに含まれるすべてのユーザ（リツイートした人も含む）
              userids        = []; // 投稿者ユーザID（ミュート用）

        // 普通のツイート
        if (!datum.retweeted_status) {
            screennamelist.push('@' + datum.user.screen_name);
            userids.push(datum.user.id_str);
            // 最近のスクリーンネーム
            TwitSideModule.Friends.updateLatestFriends(datum.user);
        }
        // リツイート
        else {
            // 元ツイート
            screennamelist.push('@' + datum.retweeted_status.user.screen_name);
            userids.push(datum.retweeted_status.user.id_str);
            // 最近のスクリーンネーム
            TwitSideModule.Friends.updateLatestFriends(datum.retweeted_status.user);
            // リツイート
            screennamelist.push('@' + datum.user.screen_name);
            userids.push(datum.user.id_str);
            // 最近のスクリーンネーム
            TwitSideModule.Friends.updateLatestFriends(datum.user);
        }
        // メンション
        for (let mention of meta.entities.user_mentions) {
            screennamelist.push('@' + mention.screen_name);
            if (mention.id_str === this._own_userid)
                // 自分宛
                meta.isForMe = true;
        }
        // 自分宛
        if (datum.in_reply_to_user_id_str === this._own_userid)
            meta.isForMe = true;

        meta.screennames = screennamelist.filter((x, i, self) => self.indexOf(x) === i); // 重複削除
        meta.userids = userids;

        return meta;
    }
    // サードパーティ画像URL認識
    _analyzePicURL(url, meta) {
        const urls = {};
        let re;

        const analyzePicApi = async (index) => {
            switch (urls.provider) {
            default:
                return Promise.reject();
            }

            delete urls.loading;

            // 更新通知
            await TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.IMAGE_LOADED,
                boxid    : meta.boxid,
                index    : index,
                columnid : this._columnid
            }, null, this._win_type);
        };

        urls.fullurl = url;
        switch (true) {
        case (re = RegExp('^https?://twitpic[.]com/(\\w+)([?].*)?$')).test(url):
            urls.provider = 'twitpic';
            urls.thumburl = url.replace(re, 'http://twitpic.com/show/thumb/$1');
            urls.rawurl   = url.replace(re, 'http://twitpic.com/show/full/$1');
            urls.id       = RegExp.$1;
            break;

        case (re = RegExp('^https?://p[.]twipple[.]jp/(\\w+)([?].*)?$')).test(url):
            urls.provider = 'twipple';
            urls.thumburl = url.replace(re, 'http://p.twipple.jp/show/large/$1');
            urls.rawurl   = url.replace(re, 'http://p.twipple.jp/show/orig/$1');
            urls.id       = RegExp.$1;
            break;

        // case (re = RegExp('^https?://instagr[.]am/p/([\\w-_]+)/([?].*)?([?].*)?$')).test(url):
        //     urls.provider = 'instagram';
        //     urls.thumburl = url.replace(re, 'http://instagr.am/p/$1/media/?size=l');
        //     urls.rawurl   = url.replace(re, 'http://instagr.am/p/$1/media/?size=l');
        //     urls.id       = RegExp.$1;
        //     break;

        // case (re = RegExp('^https?://(www[.])?instagram.com/p/([\\w-_]+)/([?].*)?$')).test(url):
        //     urls.provider = 'instagram';
        //     urls.thumburl = url.replace(re, 'http://instagr.am/p/$2/media/?size=l');
        //     urls.rawurl   = url.replace(re, 'http://instagr.am/p/$2/media/?size=l');
        //     urls.id       = RegExp.$2;
        //     break;

        case (re = RegExp('^https?://movapic[.]com/pic/(\\w+)([?].*)?$')).test(url):
            urls.provider = 'movapic';
            urls.thumburl = url.replace(re, 'http://image.movapic.com/pic/s_$1.jpeg');
            urls.rawurl   = url.replace(re, 'http://image.movapic.com/pic/m_$1.jpeg');
            urls.id       = RegExp.$1;
            break;

        case (re = RegExp('^https?://ow[.]ly/i/(\\w+)([?].*)?$')).test(url):
            urls.provider = 'owly';
            urls.thumburl = url.replace(re, 'http://static.ow.ly/photos/thumb/$1.jpg');
            urls.rawurl   = url.replace(re, 'http://static.ow.ly/photos/thumb/$1.jpg');
            urls.id       = RegExp.$1;
            break;

        case (re = RegExp('^https?://photozou[.]jp/photo/show/(\\d+)/(\\d+)([?].*)?$')).test(url):
            urls.provider = 'photozou';
            urls.thumburl = url.replace(re, 'http://photozou.jp/p/img/$2');
            urls.rawurl   = url.replace(re, 'http://photozou.jp/bin/photo/$2/org.bin');
            urls.id       = RegExp.$2;
            break;

        case (re = RegExp('^https?://youtu[.]be/([\\w-]+)([?].*)?$')).test(url):
            urls.provider = 'youtube';
            urls.thumburl = url.replace(re, 'https://i.ytimg.com/vi/$1/mqdefault.jpg');
            urls.rawurl   = url.replace(re, 'https://i.ytimg.com/vi/$1/maxresdefault.jpg');
            urls.embedurl = url.replace(re, 'https://youtube.com/embed/$1');
            urls.id       = RegExp.$1;
            break;

        case (re = RegExp('^https?://www[.]youtube[.]com/watch\?.*v=([\\w-]+)([?].*)?$')).test(url):
            urls.provider = 'youtube';
            urls.thumburl = url.replace(re, 'https://i.ytimg.com/vi/$1/mqdefault.jpg');
            urls.rawurl   = url.replace(re, 'https://i.ytimg.com/vi/$1/maxresdefault.jpg');
            urls.embedurl = url.replace(re, 'https://youtube.com/embed/$1');
            urls.id       = RegExp.$1;
            break;

        case (re = RegExp('^https?://moby[.]to/(\\w+)')).test(url):
            urls.provider = 'moby';
            urls.thumburl = url.replace(re, 'http://moby.to/$1:medium');
            urls.rawurl   = url.replace(re, 'http://moby.to/$1:full');
            urls.id       = RegExp.$1;
            break;

        case (re = RegExp('^https?://www[.]pixiv[.]net/member_illust.php[?]([\\w]+=[\\w]+&)*illust_id=([\\d]+)([&].*)?$')).test(url):
            urls.provider = 'pixiv';
            urls.thumburl = url.replace(re, 'http://embed.pixiv.net/decorate.php?illust_id=$2');
            urls.rawurl   = url.replace(re, 'http://embed.pixiv.net/decorate.php?illust_id=$2');
            urls.id       = RegExp.$2;
            break;

        default:
            return null;
        };

        meta.pics.push(urls);
    }
    // pic.twitter画像URL処理
    _procPicTwtrURL(media, meta) {
        const urls = {
            provider : 'twitter',
            fullurl  : media.expanded_url,
            thumburl : media.media_url+':medium',
            rawurl   : media.media_url+':large',
            id       : null,
            variants : media.video_info ? media.video_info.variants : null
        };

        meta.pics.push(urls);
    }

    /**
     * メンテナンス系
     */
    // 過去ツイートの削除
    async _clearOlder() {
        const count = this._getNewerHash.count + this._getOlderHash.count;

         // 削除不要
        if (!this.record.ids.length) return;
        if (this.record.ids.length <= count + 1) return;

        // 過去ツイートの削除
        // 削除後の末尾がmoreの場合は、追加で削除
        if (/_more$/.test(this.record.ids[count*2]))
            await this._removeTweets(this.record.ids.slice(count));
        else
            await this._removeTweets(this.record.ids.slice(count + 1));

        // more追加
        const lastid = this.record.ids[this.record.ids.length - 1];
        if (!/_more$/.test(lastid)) {
            const moreid = lastid + '_more';
            this.record.data[moreid] = {
                meta : { boxid : moreid },
                raw  : { id_str : moreid }
            };
            this.record.ids.push(moreid);

            await TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.TWEET_LOADED,
                tweets   : [moreid],
                tl_type  : this._tl_type,
                columnid : this._columnid
            }, null, this._win_type);
        }
    }

    // 指定したIDのツイートを除去
    async _removeTweets(ids) {
        if (!Array.isArray(ids) || ids.length == 0) return;
        const deleted = [];

        for (let id of ids) {
            const idx = this.record.ids.indexOf(id);
            if (idx < 0) continue;
            this.record.ids.splice(idx, 1);
            delete this.record.data[id];
            deleted.push(id);
        }

        await TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.TWEET_DELETED,
            tweets   : deleted,
            tl_type  : this._tl_type,
            columnid : this._columnid
        }, null, this._win_type);
    }

    // ツイートを全除去
    async _removeAllTweets() {
        if (!this.record.ids.length) return;

        delete this.record;
        this.record = {
            data : {},
            ids  : []
        };

        await TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.TWEET_ALLDELETED,
            tl_type  : this._tl_type,
            columnid : this._columnid
        }, null, this._win_type);
    }
}




/**************
 * TimelineV2 *
 **************/
class TimelineV2 extends Timeline {

    constructor(tl_type, columnid, userinfo_hash, win_type) {
        super(tl_type, columnid, userinfo_hash, win_type);
        this._defaultOptions = () => { return {
            'expansions' : [
                'attachments.poll_ids',
                'attachments.media_keys',
                'author_id',
                'edit_history_tweet_ids',
                'entities.mentions.username',
                'geo.place_id',
                'in_reply_to_user_id',
                'referenced_tweets.id',
                'referenced_tweets.id.author_id'
            ].join(','),

            'media.fields' : [
                'duration_ms',
                'height',
                'media_key',
                'preview_image_url',
                'type',
                'url',
                'width',
                'public_metrics',
                //'non_public_metrics',
                //'organic_metrics',
                //'promoted_metrics',
                'alt_text',
                'variants'
            ].join(','),

            'place.fields' : [
                'contained_within',
                'country',
                'country_code',
                'full_name',
                'geo',
                'id',
                'name',
                'place_type'
            ].join(','),

            'poll.fields' : [
                'duration_minutes',
                'end_datetime',
                'id',
                'options',
                'voting_status'
            ].join(','),

            'tweet.fields' : [
                'attachments',
                'author_id',
                'context_annotations',
                'conversation_id',
                'created_at',
                'edit_controls',
                'entities',
                'geo',
                'id',
                'in_reply_to_user_id',
                'lang',
                'public_metrics',
                //'non_public_metrics',
                //'organic_metrics',
                //'promoted_metrics',
                'possibly_sensitive',
                'referenced_tweets',
                'reply_settings',
                'source',
                'text',
                'withheld'
            ].join(','),

            'user.fields' : [
                'created_at',
                'description',
                'entities',
                'id',
                'location',
                'name',
                'pinned_tweet_id',
                'profile_image_url',
                'protected',
                'public_metrics',
                'url',
                'username',
                'verified',
                'withheld'
            ].join(',')
        }}
        this._target_userid = null;

        TwitSideModule.debug.log('timeline.js: initialized columnid '+ JSON.stringify(columnid || {}) + ' (V2)');
    }

    // 読み込みパラメータ
    set getNewerHashV2(options_hash) {
        this._getNewerHashV2 = Object.assign(this._defaultOptions(), options_hash);
    }
    get getNewerHashV2() {
        return Object.assign({}, this._getNewerHashV2);
    }
    set getOlderHashV2(options_hash) {
        this._getOlderHashV2 = Object.assign(this._defaultOptions(), options_hash);
    }
    get getOlderHashV2() {
        return Object.assign({}, this._getOlderHashV2);
    }
    // TEMP用
    // target_userid
    set target_userid(user_id) {
        this._target_userid = user_id;
    }
    get target_userid() {
        return this._target_userid;
    }


    /**
     * V2 + V1 ツイート取得
     * getNewer
     */
    async getNewer(notif) {
        const error = (result) => {
            // 状態遷移
            this._state = TwitSideModule.TL_STATE.STOPPED;
            TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.STATE_CHANGED,
                columnid : this._columnid,
                state    : this._state
            }, null, this._win_type);

            this._reportError(result);
            return Promise.reject();
        };

        // 通知
        notif = notif == null ? true : notif;

        // Twitterに送信するオプション
        const optionsHashV2 = this.getNewerHashV2;
        const optionsHashV1 = this.getNewerHash;

        // 重複読み込み禁止
        if (this._state !== TwitSideModule.TL_STATE.STOPPED
            && this._state !== TwitSideModule.TL_STATE.STARTED)
            return;
        // 自動再読込停止
        this.stopAutoReload();

        // 状態遷移
        this._state = TwitSideModule.TL_STATE.STARTING;
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.STATE_CHANGED,
            columnid : this._columnid,
            state    : this._state
        }, null, this._win_type);

        // 読み込み
        const [resultV2, resultV1] = await Promise.all([this._sendQueryV2(optionsHashV2), this._sendQuery(optionsHashV1)]).catch(error);

//        // フィルタ（読み込み済以外の件数）
//        const filteredLength = resultV2.data.data.filter((el) => {
//            return this.record.ids.indexOf((ZERO_FILL + el.id).slice(-ZERO_FILL_LEN)) < 0;
//        }).length;
//
//        // more確認
//        const more = this.record.ids.length
//              ? (filteredLength > Math.ceil(optionsHashV2.max_result * 0.5))
//              : (resultV2.data.data.length > 5);

        // more確認 next_token
        const more = resultV2.data.meta.next_token !== null;

        // 受信データを登録
        const tweets = await this._saveTweetsV2(resultV2.data, resultV1, more, notif);
        await TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.TWEET_LOADED,
            tweets   : tweets,
            tl_type  : this._tl_type,
            columnid : this._columnid,
            keep_position : true
        }, null, this._win_type);

        // 状態遷移
        this._state = TwitSideModule.TL_STATE.STOPPED;
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.STATE_CHANGED,
            columnid : this._columnid,
            state    : this._state
        }, null, this._win_type);

        // 自動再読込開始
        if (this._autoReloadEnabled) this.startAutoReload();
    }
    /**
     * V2 + V1 ツイート取得
     * getOlder
     */
    async getOlder() {
        const error = (result) => {
            // 状態遷移
            this._state2 = TwitSideModule.TL_STATE.STOPPED;
            TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.STATE_CHANGED,
                columnid : this._columnid,
                state    : TwitSideModule.TL_STATE.LOADED
            }, null, this._win_type);

            this._reportError(result);
            return Promise.reject();
        };

        const moreid = this.record.ids[this.record.ids.length-1];
        // moreidがmoreじゃないとき（読み込み完了時）
        if (!/_more$/.test(moreid)) return;

        // Twitterに送信するオプション
        const optionsHashV2 = this.getOlderHashV2;
        const optionsHashV1 = this.getOlderHash;

        // 読み込み範囲（これより小さい＝古い）
        if (this.record.data[moreid].meta.next_token)
            optionsHashV2.pagination_token = this.record.data[moreid].meta.next_token;
        else
            optionsHashV2.until_id = this.record.data[moreid].meta.oldest_id;
        optionsHashV1.max_id = this.record.data[moreid].meta.oldest_id;

        // 重複読み込み禁止
        if (this._state2 !== TwitSideModule.TL_STATE.STOPPED) return;

        // 状態遷移
        this._state2 = TwitSideModule.TL_STATE.LOADING;
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.STATE_CHANGED,
            columnid : this._columnid,
            state    : this._state2
        }, null, this._win_type);

        // 読み込み
        const [resultV2, resultV1] = await Promise.all([this._sendQueryV2(optionsHashV2), this._sendQuery(optionsHashV1)]).catch(error);

//        // フィルタ（読み込み済のものは除去）
//        result.data = result.data.filter((el) => {
//            return this.record.ids.indexOf((ZERO_FILL + el.id_str).slice(-ZERO_FILL_LEN)) < 0;
//        });
//
//        // more確認
//        const more = this.record.ids.length
//              ? (result.data.length > Math.ceil(optionsHash.count * 0.5))
//              : (result.data.length > 5);

        // more確認 next_token
        const more = resultV2.data.meta.next_token !== null;

        // 受信データを登録
        const tweets = await this._saveTweetsV2(resultV2.data, resultV1, more);
        await TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.TWEET_LOADED,
            tweets   : tweets,
            tl_type  : this._tl_type,
            columnid : this._columnid
        }, null, this._win_type);

        await this._removeTweets([moreid]);

        // 状態遷移
        this._state2 = TwitSideModule.TL_STATE.STOPPED;
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.STATE_CHANGED,
            columnid : this._columnid,
            state    : TwitSideModule.TL_STATE.LOADED
        }, null, this._win_type);
    }
    /**
     * V2 + V1 ツイート取得
     * getMore
     */
    async getMore(moreid) {
        const error = (result) => {
            // 状態遷移
            this._state2 = TwitSideModule.TL_STATE.STOPPED;
            TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.STATE_CHANGED,
                columnid : this._columnid,
                state    : TwitSideModule.TL_STATE.LOADED
            }, null, this._win_type);

            this._reportError(result);
            return Promise.reject();
        };

        // Twitterに送信するオプション
        const optionsHashV2 = this.getOlderHashV2;
        const optionsHashV1 = this.getOlderHash;

        const minindex = this.record.ids.indexOf(moreid) + 1;
        if (minindex >= this.record.ids.length) {
            await this.getOlder();
            return;
        }

        // 読み込み範囲（これより小さい＝古い）
        if (this.record.data[moreid].meta.next_token)
            optionsHashV2.pagination_token = this.record.data[moreid].meta.next_token;
        else
            optionsHashV2.until_id = this.record.data[moreid].meta.oldest_id;
        optionsHashV1.max_id = this.record.data[moreid].meta.oldest_id;

        // これ以降は読み込み済
        const minid = this.record.data[this.record.ids[minindex]].raw.id;

        // 重複読み込み禁止
        if (this._state2 !== TwitSideModule.TL_STATE.STOPPED) return;

        // 状態遷移
        this._state2 = TwitSideModule.TL_STATE.LOADING;
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.STATE_CHANGED,
            columnid : this._columnid,
            state    : this._state2
        }, null, this._win_type);

        // 読み込み
        const [resultV2, resultV1] = await Promise.all([this._sendQueryV2(optionsHashV2), this._sendQuery(optionsHashV1)]).catch(error);

//        // フィルタ（読み込み済のものは除去）
//        result.data = result.data.filter((el) => {
//            return this.record.ids.indexOf((ZERO_FILL + el.id_str).slice(-ZERO_FILL_LEN)) < 0;
//        });
//
//        // more確認
//        const more = this.record.ids.length
//              ? (result.data.length > Math.ceil(optionsHash.count * 0.5))
//              : (result.data.length > 5);

        // more確認 next_token && minid
        const more = resultV2.data.meta.next_token !== null
              || resultV2.data.meta.oldest_id <= minid;

        // 受信データを登録
        const tweets = await this._saveTweetsV2(resultV2.data, resultV1, more);
        await TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.TWEET_LOADED,
            tweets   : tweets,
            tl_type  : this._tl_type,
            columnid : this._columnid
        }, null, this._win_type);

        // 状態遷移
        await this._removeTweets([moreid]);
        this._state2 = TwitSideModule.TL_STATE.STOPPED;
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.STATE_CHANGED,
            columnid : this._columnid,
            state    : TwitSideModule.TL_STATE.LOADED
        }, null, this._win_type);
    }

    /**
     * V2 ツイート取得
     * _sendQuery
     */
    async _sendQueryV2(optionsHash) {
        // ユーザ指定必須
        switch (this._tl_type) {
        case TwitSideModule.TL_TYPE.TEMP_USERTIMELINE_V2:
        case TwitSideModule.TL_TYPE.TEMP_FAVORITE_V2:
            if (!this._target_userid) Promise.reject();
        }

        switch (this._tl_type) {
        case TwitSideModule.TL_TYPE.TIMELINE_V2:
            return await this._tweet.V2usersTimelineRev(this._own_userid, optionsHash);
        case TwitSideModule.TL_TYPE.CONNECT_V2:
            return await this._tweet.V2mentions(this._own_userid, optionsHash);
        case TwitSideModule.TL_TYPE.FAVORITE_V2:
            return await this._tweet.V2likedtweets(this._own_userid, optionsHash);
        case TwitSideModule.TL_TYPE.TEMP_USERTIMELINE_V2:
            return await this._tweet.V2usersTweets(this._target_userid, optionsHash);
        case TwitSideModule.TL_TYPE.TEMP_FAVORITE_V2:
            return await this._tweet.V2likedtweets(this._target_userid, optionsHash);
        }
        return Promise.reject();
    }

    /**
     * V2 ツイートを保存して変更があったid一覧を返す
     * _sendQuery
     */
    async _saveTweetsV2(dataV2, dataV1, more, notif) {
        // 更新したツイートID
        let lastidx = null, // 最新ツイートのインデックス
            i = 0;
        const tweets   = [],
              notified = [];

        const mutes = this._muteEnabled
              ? TwitSideModule.Friends.getMutes(this._own_userid) || []
              : [],
              noretweets = this._noretweetEnabled
              ? TwitSideModule.Friends.getNoretweets(this._own_userid) || []
              : [];

        if (!dataV2.data) return tweets;

        // dataは新しいもの順
        for (let datum of dataV2.data) {
            // legacyツイートマージ
            const legacy = dataV1.data.find(e => e.id_str === datum.id);
            if (!legacy) continue;
            else {
                datum._legacy = {
                    favorited : legacy.favorited,
                    retweeted : legacy.retweeted,
                    source    : legacy.source
                };
            }

            // リファレンスの埋め込み
            this._includeReferences(datum, dataV2, dataV1);
            // retweetのlegacyツイートマージ
            if (datum._retweeted_status_idx !== null) {
                const ref_retweet = datum.referenced_tweets[datum._retweeted_status_idx];
                ref_retweet._tweet.raw._legacy = {
                    favorited : legacy.retweeted_status.favorited,
                    retweeted : legacy.retweeted_status.retweeted,
                    source    : legacy.retweeted_status.source
                };
                // retweetのquoteのlegacyツイートマージ
                if (ref_retweet._tweet.raw._quoted_status_idx !== null) {
                    if (ref_retweet._tweet.raw.referenced_tweets[ref_retweet._tweet.raw._quoted_status_idx]._tweet) {
                        ref_retweet._tweet.raw.referenced_tweets[ref_retweet._tweet.raw._quoted_status_idx]._tweet.raw._legacy = {
                            favorited : legacy.retweeted_status.quoted_status.favorited,
                            retweeted : legacy.retweeted_status.quoted_status.retweeted,
                            source    : legacy.retweeted_status.quoted_status.source
                        };
                    }
                    else console.log(datum);
                }

            }
            // quoteのlegacyツイートマージ
            if (datum._quoted_status_idx !== null) {
                datum.referenced_tweets[datum._quoted_status_idx]._tweet.raw._legacy = {
                    favorited : legacy.quoted_status.favorited,
                    retweeted : legacy.quoted_status.retweeted,
                    source    : legacy.quoted_status.source
                };
            }

            // ID正規化
            const target_id = this._zeroFillIdV2(datum);
            if (!target_id) continue;

            // muteの時は破棄
            if (mutes.length) {
                // ツイート
                if (mutes.indexOf(datum.author_id) >= 0) {
                    await this._removeTweets([target_id]);
                    continue;
                }
                // リツイート
                if (datum.referenced_tweets) {
                    let ref_retweet = datum.referenced_tweets.find(e => e.type === 'retweeted');
                    if (ref_retweet && mutes.indexOf(ref_retweet._tweet.raw.author_id) >= 0) {
                        await this._removeTweets([target_id]);
                        continue;
                    }
                }
            }

            // noretweetの時は破棄
            if (noretweets.length && datum.referenced_tweets) {
                let ref_retweet = datum.referenced_tweets.find(e => e.type === 'retweeted');
                if (ref_retweet && noretweets.indexOf(ref_retweet._tweet.raw.author_id) >= 0) {
                    await this._removeTweets([target_id]);
                    continue;
                }
            }

            // TwitSideミュート
            if (this._muteEnabled && TwitSideModule.config.getPref('mute_ts')) {
                // リツイート
                if (datum.referenced_tweets) {
                    let ref_retweet = datum.referenced_tweets.find(e => e.type === 'retweeted');
                    // 投稿者
                    if (ref_retweet && TwitSideModule.Mutes.checkMuteUsers([ref_retweet._tweet.raw.author_id])) {
                        await this._removeTweets([target_id]);
                        continue;
                    }
                    // テキスト
                    if (ref_retweet && TwitSideModule.Mutes.checkMuteKeywords(ref_retweet._tweet.meta.text)) {
                        await this._removeTweets([target_id]);
                        continue;
                    }
                }
                // 投稿者
                if (TwitSideModule.Mutes.checkMuteUsers([datum.author_id])) {
                    await this._removeTweets([target_id]);
                    continue;
                }
                // テキスト
                if (TwitSideModule.Mutes.checkMuteKeywords(datum.text)) {
                    await this._removeTweets([target_id]);
                    continue;
                }
            }

            // メタデータ確認
            const meta = this._getMetadataV2(datum, target_id);
            this.record.data[target_id] = {
                meta : meta,
                raw  : structuredClone(datum)
            };

            // 新規ID
            const exidx = this.record.ids.indexOf(target_id);
            if (exidx < 0) {
                // ID一覧更新
                const len = this.record.ids.length;

                // 挿入ソート（前から、新しいものから）
                for (i; i<=len; i++) {
                    // 末尾
                    if (i == len) {
                        this.record.ids.push(target_id);
                        lastidx = i+1;
                        break;
                    }
                    if (this.record.ids[i] < target_id) {
                        this.record.ids.splice(i, 0, target_id);
                        lastidx = i+1;
                        break;
                    }
                }
            }
            // 既存ID
            else lastidx = exidx + 1;

            // 通知チェック
            if (this._notifEnabled
                && this._tl_type === TwitSideModule.TL_TYPE.TIMELINE_V2
                && target_id > TwitSideModule.ManageColumns.getLastNotifyId(this._columnid)) {
                // 自分宛
                if (meta.isForMe && typeof datum._retweeted_status_idx === null
                    && TwitSideModule.config.getPref('notif_forme')) {

                    // 最終通知
                    notified.push(target_id);

                    notif && TwitSideModule.Message.showNotification({
                        userid  : this._own_userid,
                        title   : browser.i18n.getMessage('newMention', ['@' + datum._userinfo.username]),
                        icon    : datum._userinfo.profile_image_url.replace('_normal.', '.'),
                        content : meta.text
                    });
                }
                // 自分宛リツイート
                else if (meta.isForMe && typeof datum._retweeted_status_idx !== null
                         && TwitSideModule.config.getPref('notif_forme_retweeted')) {
                    // 最終通知
                    notified.push(target_id);

                    notif && TwitSideModule.Message.showNotification({
                        userid  : this._own_userid,
                        title   : browser.i18n.getMessage('newRetweet', ['@' + datum._userinfo.username]),
                        icon    : datum._userinfo.profile_image_url.replace('_normal.', '.'),
                        content : meta.text
                    });
                }
            }

            // 更新データ（新しいもの順のはず）
            tweets.push(target_id);
        }
        // 更新データ（改めて新しいもの順）
        tweets.sort().reverse();

        // 通知チェック
        // すべてのツイート（1つのみ表示）
        if (notif && this._notifEnabled
            && this._tl_type === TwitSideModule.TL_TYPE.TIMELINE_V2
            && TwitSideModule.config.getPref('notif_all')
            && tweets.length) {

            // 最新ツイートIDが既存のIDより新しい
            if (tweets[0] > this.record.ids[0]) {
                const target_user = tweets[0]._userinfo.username;
                const target_user_icon = tweets[0]._userinfo.profile_image_url.replace('_normal.', '.');
                TwitSideModule.Message.showNotification({
                    userid  : this._own_userid,
                    title   : browser.i18n.getMessage('newTweet', ['@' + target_user]),
                    icon    : target_user_icon,
                    content : tweets[0].text
                }, true);
            }
        }
//        // 検索
//        if (this._notifEnabled
//            && this._tl_type === TwitSideModule.TL_TYPE.SEARCH
//            && tweets[0] > TwitSideModule.ManageColumns.getLastNotifyId(this._columnid)) {
//
//            // 最新ツイートIDが既存のIDより新しい
//            const filteredTweets = tweets.filter(id => id > TwitSideModule.ManageColumns.getLastNotifyId(this._columnid));
//
//            if (filteredTweets.length) {
//                // 最終通知
//                notified.push(filteredTweets[0]);
//
//                notif && TwitSideModule.Message.showNotification({
//                    userid  : this._own_userid,
//                    title   : browser.i18n.getMessage('newSearched', [filteredTweets.length]),
//                    content : browser.i18n.getMessage('newSearchQuery') + this._getNewerHash.q
//                }, true);
//
//            }
//        }

        // 最終通知ID更新
        if (notified.length)
            await TwitSideModule.ManageColumns.setLastNotifyId(this._columnid, notified[0]);

        // more格納
        if (more && dataV2.data.length) {
            // 連続するmoreを防止
            if (/_more$/.test(this.record.ids[lastidx]))
                await this._removeTweets([this.record.ids[lastidx]]);

            const oldestid = dataV2.data[dataV2.data.length-1].id;
            const moreid = (ZERO_FILL + oldestid).slice(-ZERO_FILL_LEN) + '_more';
            this.record.data[moreid] = {
                meta : { boxid      : moreid,
                         oldest_id  : oldestid,
                         next_token : dataV2.meta.next_token },
                raw  : { id         : moreid,
                         id_str     : moreid }
            };
            this.record.ids.splice(lastidx, 0, moreid);
            tweets.push(moreid);
        }
        return tweets;
    }

    /**
     * V2 IDゼロフィル
     * _zeroFillIdV2
     */
    _zeroFillIdV2(datum) {
        if (datum.id)
            datum.id_str = (ZERO_FILL + datum.id).slice(-ZERO_FILL_LEN);
        else return null; // 不正なデータ
        return datum.id_str;
    }

    /**
     * V2 メタデータの作成
     * _getMetadataV2
     */
    _getMetadataV2(datum, boxid) {
        if (!datum._includedReferences) return;

        const meta = {
            V2      : true,
            boxid   : boxid,
            isMine  : datum.author_id === this._own_userid,
            isForMe : false
        };

        if (datum._retweeted_status_idx !== null) {
            let ref_retweet = datum.referenced_tweets[datum._retweeted_status_idx]._tweet;
            if (ref_retweet) ref_retweet.meta = this._getMetadataV2(ref_retweet.raw, boxid+'_inline_'+ref_retweet.raw.id);
        }
        else if (datum._quoted_status_idx !== null) {
            let ref_retweet = datum.referenced_tweets[datum._quoted_status_idx]._tweet;
            if (ref_retweet) ref_retweet.meta = this._getMetadataV2(ref_retweet.raw, boxid+'_inline_'+ref_retweet.raw.id);
        }

        meta.entities = datum.entities;
        meta.text = datum.text;
        // display_text_range
        meta.start = 0;
        if (datum.entities && datum.entities.mentions) {
            datum.entities.mentions.forEach((ref, i) => {
                if (i === 0 && ref.start === 0) meta.start = ref.end + 1;
                else if (ref.start === meta.start) meta.start = ref.end + 1;
            });
        }
        // ユーザ一覧
        meta.screennames = ['@' + datum._userinfo.username];
        meta.userids = [datum._userinfo.id];
        // 最近のスクリーンネーム更新
        TwitSideModule.Friends.updateLatestFriends(datum._userinfo);

        // メンション
        if (meta.entities && meta.entities.mentions) {
            for (let mention of meta.entities.mentions) {
                meta.screennames.push('@' + mention.username);
                if (mention.id === this._own_userid)
                    // 自分宛
                    meta.isForMe = true;
            }
        }
        // 自分宛
        if (datum.in_reply_to_user_id && datum.in_reply_to_user_id === this._own_userid)
            meta.isForMe = true;

        meta.screennames = meta.screennames.filter((x, i, self) => self.indexOf(x) === i); // 重複削除
        meta.userids = meta.userids;

        return meta;
    }

    // リファレンスツイート埋め込み (V2)
    _includeReferences(datum, data) {
        datum._retweeted_status_idx = null;
        datum._quoted_status_idx = null;
        // tweet
        if (datum.referenced_tweets) {
            datum.referenced_tweets.forEach((ref, i) => {
                const raw = structuredClone(data.includes.tweets.find(e => e.id === ref.id));
                if (raw) {
                    // ID正規化
                    this._zeroFillIdV2(raw);
                    ref._tweet = {
                        meta : {},
                        raw  : raw
                    };
                    // リファレンスのリファレンス
                    this._includeReferences(ref._tweet.raw, data);
                }
                if (ref.type === 'retweeted') datum._retweeted_status_idx = i;
                if (ref.type === 'quoted')    datum._quoted_status_idx = i;
            });
        }
        if (data.includes) {
            // mention
            if (datum.entities && datum.entities.mentions && data.includes.users) {
                datum.entities.mentions.forEach((ref, i) => {
                    ref._userinfo = structuredClone(data.includes.users.find(e => e.id === ref.id));
                    if (ref._userinfo) ref._userinfo.id_str = ref._userinfo.id;
                });
            }
            // media (attachments._media)
            if (datum.attachments && datum.attachments.media_keys && data.includes.media) {
                datum.attachments._media = [];
                datum.attachments.media_keys.forEach((key, i) => {
                    datum.attachments._media[i] = structuredClone(data.includes.media.find(e => e.media_key === key));
                });
            }
            // poll (attachments._polls)
            if (datum.attachments && datum.attachments.poll_ids && data.includes.polls) {
                datum.attachments._polls = [];
                datum.attachments.poll_ids.forEach((id, i) => {
                    datum.attachments._polls[i] = structuredClone(data.includes.polls.find(e => e.id === id));
                });
            }
            // place (_place)
            if (datum.geo && data.includes.places)
                datum._place = structuredClone(data.includes.places.find(e => e.id === datum.geo.place_id));

            // userinfo (_userinfo)
            if (datum.author_id && data.includes.users) {
                datum._userinfo = structuredClone(data.includes.users.find(e => e.id === datum.author_id));
                if (datum._userinfo) datum._userinfo.id_str = datum._userinfo.id;
            }
        }

        datum._includedReferences = true;
        return;
    }

    /**
     * V2 メンテナンス系 過去ツイートの削除
     * _clearOlder
     */
    async _clearOlder() {
        const count = this.getNewerHashV2.max_results + this.getOlderHashV2.max_results;

         // 削除不要
        if (!this.record.ids.length) return;
        if (this.record.ids.length <= count + 1) return;

        // 過去ツイートの削除
        // 削除後の末尾がmoreの場合は、追加で削除
        if (/_more$/.test(this.record.ids[count*2]))
            await this._removeTweets(this.record.ids.slice(count));
        else
            await this._removeTweets(this.record.ids.slice(count + 1));

        // more追加
        const lastid = this.record.ids[this.record.ids.length - 1];
        if (!/_more$/.test(lastid)) {
            // レコードの最終IDから
            const moreid   = lastid + '_more',
                  oldestid = this.record.data[lastid].raw.id;
            this.record.data[moreid] = {
                meta : { boxid     : moreid,
                         oldest_id : oldestid },
                raw  : { id        : moreid,
                         id_str    : moreid }
            };
            this.record.ids.push(moreid);

            await TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.TWEET_LOADED,
                tweets   : [moreid],
                tl_type  : this._tl_type,
                columnid : this._columnid
            }, null, this._win_type);
        }
    }
    /**
     * V2 リツイート
     * retweet
     */
    async retweet(boxid) {
        const error = (result) => {
            TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.ACTION_COMPLETED,
                action   : 'retweet',
                result   : 'failed',
                boxid    : boxid,
                columnid : this._columnid,
                message  : TwitSideModule.Message.transMessage(result)
            }, null, this._win_type);

            return Promise.reject();
        };

        // 回数制限
        const limitHistory = JSON.parse(TwitSideModule.config.getPref('limit_retweet'));
        if (!TwitSideModule.config.debug
            && limitHistory.length >= LIMIT_RETWEET_CNT
            && TwitSideModule.text.getUnixTime() - (limitHistory[0] || 0) < LIMIT_RETWEET_TERM) {
            this._reportError('retweetLimit');
            return;
        }

        const idPath   = boxid.split('_'),
              //isQuote  = /_inline_/.test(boxid),
              parentId = idPath[0].replace(/^0+/, ''),
              targetId = idPath.pop().replace(/^0+/, '');

        const result = await this._tweet.retweet({}, targetId).catch(error);

        // アクション完了
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.ACTION_COMPLETED,
            action   : 'retweet',
            result   : 'success',
            boxid    : boxid,
            columnid : this._columnid
        }, null, this._win_type);

        // 回数制限
        while (limitHistory.length >= LIMIT_RETWEET_CNT) limitHistory.shift();
        limitHistory.push(TwitSideModule.text.getUnixTime());
        await TwitSideModule.config.setPref('limit_retweet', JSON.stringify(limitHistory));

        // ツイート再読込
        const [resultV2_show, resultV1_show] = await Promise.all([this._tweet.V2tweet(parentId, this._defaultOptions()), this._tweet.show({ id : parentId })]).catch(error);
        // 配列化
        resultV2_show.data.data = [resultV2_show.data.data];
        resultV1_show.data = [resultV1_show.data];

        // 受信データを登録
        const tweets = await this._saveTweetsV2(resultV2_show.data, resultV1_show);
        await TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.REPLACE_LOADED,
            tweets   : tweets,
            tl_type  : this._tl_type,
            columnid : this._columnid
        }, null, this._win_type);
    }
// TODO
    /**
     * V2 リツイート取り消し
     * destroyRetweet
     */
    async destroyRetweet(boxid) {
    }
}




/**************
 * DmTimeline *
 **************/
class DmTimeline extends Timeline {

    constructor(tl_type, columnid, userinfo_hash, win_type) {
        super(tl_type, columnid, userinfo_hash, win_type);

        // initialize
        this._dm = new DM(this._tweet, this._tl_type);
    }

    beforeDestroy() {
        delete this._dm;
        super.beforeDestroy();
    }

    get isDirectMessage() {
        if (this._tl_type === TwitSideModule.TL_TYPE.DIRECTMESSAGE) return true;
        if (this._tl_type === TwitSideModule.TL_TYPE.TEMP_DIRECTMESSAGE) return true;
        return false;
    }

    async getNewer(notif) {
        const error = (result) => {
            // 状態遷移
            this._state = TwitSideModule.TL_STATE.STOPPED;
            TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.STATE_CHANGED,
                columnid : this._columnid,
                state    : this._state
            }, null, this._win_type);

            this._reportError(result);
            return Promise.reject();
        };

        // 一覧クリア
        await this._removeAllTweets();
        // カーソルリセット
        this._dm.resetDmCursor();

        // 通知
        notif = notif == null ? true : notif;
        // Twitterに送信するオプション
        const optionsHash = this.getNewerHash;

        // 重複読み込み禁止
        if (this._state !== TwitSideModule.TL_STATE.STOPPED
            && this._state !== TwitSideModule.TL_STATE.STARTED)
            return;
        // 自動再読込停止
        this.stopAutoReload();

        // 状態遷移
        this._state = TwitSideModule.TL_STATE.STARTING;
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.STATE_CHANGED,
            columnid : this._columnid,
            state    : this._state
        }, null, this._win_type);

        // 読み込み
        const result = await this._sendQuery(optionsHash).catch(error);

        // more確認
        const more = result.more;

        // 受信データを登録
        const tweets = await this._saveTweets(result.data, more, notif);
        await TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.TWEET_LOADED,
            tweets   : tweets,
            tl_type  : this._tl_type,
            columnid : this._columnid,
            keep_position : true
        }, null, this._win_type);

        // 状態遷移
        this._state = TwitSideModule.TL_STATE.STOPPED;
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.STATE_CHANGED,
            columnid : this._columnid,
            state    : this._state
        }, null, this._win_type);

        // 自動再読込開始
        if (this._autoReloadEnabled) this.startAutoReload();
    }
    async getOlder() {
        const error = (result) => {
            // 状態遷移
            this._state2 = TwitSideModule.TL_STATE.STOPPED;
            TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.STATE_CHANGED,
                columnid : this._columnid,
                state    : TwitSideModule.TL_STATE.LOADED
            }, null, this._win_type);

            this._reportError(result);
            return Promise.reject();
        };

        const moreid = this.record.ids[this.record.ids.length-1],
              maxid  = this.record.ids[this.record.ids.length-2];
        // moreidがmoreじゃないとき（読み込み完了時）
        if (!/_more$/.test(moreid)) return;

        // Twitterに送信するオプション
        const optionsHash = this.getOlderHash;

        // 重複読み込み禁止
        if (this._state2 !== TwitSideModule.TL_STATE.STOPPED) return;

        // 状態遷移
        this._state2 = TwitSideModule.TL_STATE.LOADING;
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.STATE_CHANGED,
            columnid : this._columnid,
            state    : this._state2
        }, null, this._win_type);

        // 読み込み
        let result = await this._sendQuery(optionsHash).catch(error);

        // more確認
        let more = result.more;

        // DMの読み込み件数が0件の場合
        while (result.data.length == 0 && more) {
            result = await this._sendQuery(optionsHash).catch(error);
            more   = result.more;
        }

        // 受信データを登録
        const tweets = await this._saveTweets(result.data, more);
        await TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.TWEET_LOADED,
            tweets   : tweets,
            tl_type  : this._tl_type,
            columnid : this._columnid
        }, null, this._win_type);

        // 状態遷移
        this._state2 = TwitSideModule.TL_STATE.STOPPED;
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.STATE_CHANGED,
            columnid : this._columnid,
            state    : TwitSideModule.TL_STATE.LOADED
        }, null, this._win_type);
    }
    async getMore() {
        await this.getOlder();
        return;
    }
    async destroy(boxid) {
        const error = (result) => {
            TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.ACTION_COMPLETED,
                action   : 'destroy',
                result   : 'failed',
                boxid    : boxid,
                columnid : this._columnid,
                message  : TwitSideModule.Message.transMessage(result)
            }, null, this._win_type);

            return Promise.reject();
        };

        // 自分のツイートを削除
        const callback_mine = async (result) => {
            // アクション完了
            TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.ACTION_COMPLETED,
                action   : 'destroy',
                result   : 'success',
                boxid    : boxid,
                columnid : this._columnid
            }, null, this._win_type);

            // 削除
            await this._removeTweets([boxid]);
        };

        callback_mine(await this._tweet.destroyDm2({ id : boxid }).catch(error));
    }
    async _sendQuery(optionsHash) {
        return await this._dm.getDm(optionsHash);
    }

    // ツイートを保存して変更があったid一覧を返す
    async _saveTweets(data, more, notif) {
        const tweets     = [],
              notified   = [];

        // dataは新しいもの順
        for (let datum of data) {
            const target_id = this._zeroFillId(datum);
            if (!target_id) continue;

            // メタデータ確認
            const meta = await this._getDmMetadata(datum, target_id).catch(r => r);
            if (!meta) continue;
            this.record.data[target_id] = {
                meta : meta,
                raw  : datum
            };

            this.record.ids.push(target_id);

            // 通知チェック
            if (this._notifEnabled
                && this._tl_type === TwitSideModule.TL_TYPE.DIRECTMESSAGE
                && target_id > TwitSideModule.ManageColumns.getLastNotifyId(this._columnid)) {
                // 自分宛
                if (meta.isForMe && TwitSideModule.config.getPref('notif_directmessage')) {
                    // 通知済（新しいもの順）
                    notified.push(target_id);

                    notif && TwitSideModule.Message.showNotification({
                        userid  : this._own_userid,
                        title   : browser.i18n.getMessage('newDirectMessage', ['@' + meta.sender.screen_name]),
                        icon    : meta.sender.profile_image_url_https.replace('_normal.', '.'),
                        content : datum.message_create.message_data.text
                    });
                }
            }

            // 更新データ（新しいもの順のはず）
            tweets.push(target_id);
        }
        // 更新データ（改めて新しいもの順）
        tweets.sort().reverse();

        // 最終通知ID更新
        if (notified.length)
            await TwitSideModule.ManageColumns.setLastNotifyId(this._columnid, notified[0]);

        const moreid = NINE_FILL + '_more';
        await this._removeTweets([moreid]);

        // more格納
        if (more) {
            this.record.data[moreid] = {
                meta : { boxid : moreid },
                raw  : { id_str : moreid }
            };
            this.record.ids.push(moreid);
            tweets.push(moreid);
        }
        return tweets;
    }
    // IDゼロフィル
    _zeroFillId(datum) {
        if (datum.id) // DM向け
            datum.id_str = (ZERO_FILL + datum.id).slice(-ZERO_FILL_LEN);
        else return null; // 不正なデータ
        return datum.id_str;
    }
    // メタデータの作成（DM）
    async _getDmMetadata(datum, boxid) {
        const error = (result) => {
            this._reportError(result);
            return Promise.reject(null);
        };

        const meta = {
            boxid   : boxid,
            isMine  : datum.message_create.sender_id === this._own_userid,
            isForMe : datum.message_create.target.recipient_id === this._own_userid,
            pics    : []
        };

        // エンティティ
        if (datum.message_create.message_data.entities) {
            meta.entities = datum.message_create.message_data.entities;
            // サードパーティ画像URLの処理
            for (let url of meta.entities.urls || [])
                this._analyzePicURL(url.expanded_url, meta);
        }
        // 添付
        if (datum.message_create.message_data.attachment) {
            meta.attachment = datum.message_create.message_data.attachment;
            // メディア
            for (let media of [meta.attachment.media] || [])
                // Twitter
                this._procPicTwtrURL(media, meta);
        }

        const screennamelist = [],
              sender         = TwitSideModule.Friends.searchFriendFromId(datum.message_create.sender_id),
              recipient      = TwitSideModule.Friends.searchFriendFromId(datum.message_create.target.recipient_id);

        // スクリーンネームがすぐに判明する場合
        if (sender && recipient) {
            if (sender !== recipient) {
                screennamelist.push('@' + sender.screen_name);
                screennamelist.push('@' + recipient.screen_name);
            }
            else {
                screennamelist.push('@' + sender.screen_name);
            }
            meta.sender      = sender;
            meta.recipient   = recipient;
            meta.screennames = screennamelist;
        }

        // スクリーンネームを取得する必要がある場合
        else {
            const lookup = [];
            if (!sender) lookup.push(datum.message_create.sender_id);
            if (!recipient) lookup.push(datum.message_create.target.recipient_id);

            const result = await TwitSideModule.Friends.lookup(lookup, this._tweet).catch(error);
            for (let user of result.data) TwitSideModule.Friends.updateLatestFriends(user);

            // メタデータ更新
            return await this._getDmMetadata(datum, boxid).catch(error);
        }
        return meta;
    }
    // pic.twitter画像URL処理
    _procPicTwtrURL(media, meta) {
        const analyzePicApi = async (index) => {
            switch (urls.provider) {
            case 'twitter':
                const [thumb, response] = await Promise.all([
                    this._tweet.dmOAuth(urls.id+':medium', {}),
                    this._tweet.dmOAuth(urls.id+':large', {})
                ]);

                if (thumb && thumb.data
                    && response && response.data) {
                    urls.thumburl = URL.createObjectURL(thumb.data);
                    urls.rawurl   = URL.createObjectURL(response.data);
                };
                break;
            default:
                return Promise.reject();
            }

            delete urls.loading;

            // 更新通知
            await TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.IMAGE_LOADED,
                boxid    : meta.boxid,
                index    : index,
                columnid : this._columnid
            }, null, this._win_type);
        };

        const url  = media.media_url_https,
              urls = {};
        let re;

        switch (true) {
        case (re = RegExp('^https?://ton[.]twitter[.]com/1[.]1([\\w/.]+)$')).test(url):
            // twitter (for DM picture)
            urls.provider = 'twitter';
            urls.loading  = true;
            urls.thumburl = url.replace(re, browser.runtime.getURL('images/loading.svg')
                                        + '?' + urls.provider + '#' + urls.id);
            urls.rawurl   = '';
            urls.id       = RegExp.$1;
            analyzePicApi(meta.pics.length);
            break;

        case (re = RegExp('^https?://pbs[.]twimg[.]com/dm_video_preview/([\\w/.]+)$')).test(url):
            // twitter (for DM video)
            urls.provider = 'twitter';
            urls.fullurl  = media.expanded_url,
            urls.thumburl = media.media_url_https;
            urls.rawurl   = media.media_url_https;
            urls.id       = null;
            urls.variants = media.video_info ? media.video_info.variants : null;
            break;

        case (re = RegExp('^https?://pbs[.]twimg[.]com/dm_gif_preview/([\\w/.]+)$')).test(url):
            // twitter (for DM gif)
            urls.provider = 'twitter';
            urls.fullurl  = media.expanded_url,
            urls.thumburl = media.media_url_https;
            urls.rawurl   = media.media_url_https;
            urls.id       = null;
            urls.variants = media.video_info ? media.video_info.variants : null;
            break;

        default:
            return null;
        }

        meta.pics.push(urls);
    }

} //DmTimeline


/****************
 * ListTimeline *
 ****************/
class ListTimeline extends Timeline {

    constructor(tl_type, columnid, userinfo_hash, win_type, targetid) {
        super(tl_type, columnid, userinfo_hash, win_type);

        // initialize
        this._lists = new Lists(this._tweet, this._tl_type, targetid);
    }

    beforeDestroy() {
        delete this._lists;
        super.beforeDestroy();
    }

    get isList() {
        if (this._tl_type === TwitSideModule.TL_TYPE.TEMP_OWNERSHIPLISTS) return true;
        if (this._tl_type === TwitSideModule.TL_TYPE.TEMP_SUBSCRIPTIONLISTS) return true;
        if (this._tl_type === TwitSideModule.TL_TYPE.TEMP_MEMBERSHIPLISTS) return true;
        return false;
    }
    get isListMember() {
        if (this._tl_type === TwitSideModule.TL_TYPE.TEMP_LISTMEMBER) return true;
        if (this._tl_type === TwitSideModule.TL_TYPE.TEMP_LISTSUBSCRIBER) return true;
        return false;
    }

    async getNewer(notif) {
        const error = (result) => {
            // 状態遷移
            this._state = TwitSideModule.TL_STATE.STOPPED;
            TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.STATE_CHANGED,
                columnid : this._columnid,
                state    : this._state
            }, null, this._win_type);

            this._reportError(result);
            return Promise.reject();
        };

        switch (true) {
        case this.isList:
            // 一覧クリア
            await this._removeAllTweets();
            // カーソルリセット
            this._lists.resetListsCursor();
            break;
        case this.isListMember:
            // 一覧クリア
            await this._removeAllTweets();
            // カーソルリセット
            this._lists.resetListMembersCursor();
            break;
        }

        // 通知
        notif = notif == null ? true : notif;
        // Twitterに送信するオプション
        const optionsHash = this.getNewerHash;

        // 重複読み込み禁止
        if (this._state !== TwitSideModule.TL_STATE.STOPPED
            && this._state !== TwitSideModule.TL_STATE.STARTED)
            return;
        // 自動再読込停止
        this.stopAutoReload();

        // 状態遷移
        this._state = TwitSideModule.TL_STATE.STARTING;
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.STATE_CHANGED,
            columnid : this._columnid,
            state    : this._state
        }, null, this._win_type);

        // 読み込み
        const result = await this._sendQuery(optionsHash).catch(error);

        // more確認
        const more = result.more;

        // 受信データを登録
        const tweets = await this._saveTweets(result.data, more, notif);
        await TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.TWEET_LOADED,
            tweets   : tweets,
            tl_type  : this._tl_type,
            columnid : this._columnid,
            keep_position : true
        }, null, this._win_type);

        // 状態遷移
        this._state = TwitSideModule.TL_STATE.STOPPED;
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.STATE_CHANGED,
            columnid : this._columnid,
            state    : this._state
        }, null, this._win_type);

        // 自動再読込開始
        if (this._autoReloadEnabled) this.startAutoReload();
    }
    async getOlder() {
        const error = (result) => {
            // 状態遷移
            this._state2 = TwitSideModule.TL_STATE.STOPPED;
            TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.STATE_CHANGED,
                columnid : this._columnid,
                state    : TwitSideModule.TL_STATE.LOADED
            }, null, this._win_type);

            this._reportError(result);
            return Promise.reject();
        };

        const moreid = this.record.ids[this.record.ids.length-1],
              maxid  = this.record.ids[this.record.ids.length-2];
        // moreidがmoreじゃないとき（読み込み完了時）
        if (!/_more$/.test(moreid)) return;

        const optionsHash = {};

        // 重複読み込み禁止
        if (this._state2 !== TwitSideModule.TL_STATE.STOPPED) return;

        // 状態遷移
        this._state2 = TwitSideModule.TL_STATE.LOADING;
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.STATE_CHANGED,
            columnid : this._columnid,
            state    : this._state2
        }, null, this._win_type);

        // 読み込み
        const result = await this._sendQuery(optionsHash).catch(error);

        // more確認
        const more = result.more;

        // 受信データを登録
        const tweets = await this._saveTweets(result.data, more);
        await TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.TWEET_LOADED,
            tweets   : tweets,
            tl_type  : this._tl_type,
            columnid : this._columnid
        }, null, this._win_type);

        // 状態遷移
        this._state2 = TwitSideModule.TL_STATE.STOPPED;
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.STATE_CHANGED,
            columnid : this._columnid,
            state    : TwitSideModule.TL_STATE.LOADED
        }, null, this._win_type);
    }
    async getMore() {
        await this.getOlder();
        return;
    }
    async destroy(boxid) {
        const error = (result) => {
            TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.ACTION_COMPLETED,
                action   : 'destroy',
                result   : 'failed',
                boxid    : boxid,
                columnid : this._columnid,
                message  : TwitSideModule.Message.transMessage(result)
            }, null, this._win_type);

            return Promise.reject();
        };

        // リストの削除
        const callback_list = async (result) => {
            // アクション完了
            TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.ACTION_COMPLETED,
                action   : 'destroyList',
                result   : 'success',
                boxid    : boxid,
                columnid : this._columnid
            }, null, this._win_type);

            await this._removeTweets([boxid]);
        };

        callback_list(await this._tweet.destroyList({ list_id : boxid }).catch(error));
    }

    /**
     * リスト系
     */
    // リスト作成
    async createList(listinfo) {
        const error = (result) => {
            TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.ACTION_COMPLETED,
                action   : 'createList',
                result   : 'failed',
                listinfo : listinfo,
                columnid : this._columnid,
                message  : TwitSideModule.Message.transMessage(result)
            }, null, this._win_type);

            return Promise.reject();
        };

        const result = await this._tweet.createList(listinfo).catch(error);

        // アクション完了
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.ACTION_COMPLETED,
            action   : 'createList',
            result   : 'success',
            listid   : result.data.id_str,
            columnid : this._columnid
        }, null, this._win_type);
    }

    async updateList(listinfo) {
        const error = (result) => {
            TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.ACTION_COMPLETED,
                action   : 'updateList',
                result   : 'failed',
                listinfo : listinfo,
                columnid : this._columnid,
                message  : TwitSideModule.Message.transMessage(result)
            }, null, this._win_type);

            return Promise.reject();
        };

        const result = await this._tweet.updateList(listinfo).catch(error);

        // アクション完了
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.ACTION_COMPLETED,
            action   : 'updateList',
            result   : 'success',
            listid   : result.data.id_str,
            columnid : this._columnid
        }, null, this._win_type);
    }

    // リストの購読
    async subscribeList(listid) {
        const error = (result) => {
            TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.ACTION_COMPLETED,
                action   : 'subscribeList',
                result   : 'failed',
                listid   : listid,
                columnid : this._columnid,
                message  : TwitSideModule.Message.transMessage(result)
            }, null, this._win_type);

            return Promise.reject();
        };

        const result = await this._tweet.subscribeList({ list_id : listid }).catch(error);

        // アクション完了
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.ACTION_COMPLETED,
            action   : 'subscribeList',
            result   : 'success',
            listid   : listid,
            columnid : this._columnid
        }, null, this._win_type);
    }
    // リストの購読解除
    async unsubscribeList(listid) {
        const error = (result) => {
            TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.ACTION_COMPLETED,
                action   : 'unsubscribeList',
                result   : 'failed',
                listid   : listid,
                columnid : this._columnid,
                message  : TwitSideModule.Message.transMessage(result)
            }, null, this._win_type);

            return Promise.reject();
        };

        const result = await this._tweet.unsubscribeList({ list_id : listid });

        // アクション完了
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.ACTION_COMPLETED,
            action   : 'unsubscribeList',
            result   : 'success',
            listid   : listid,
            columnid : this._columnid
        }, null, this._win_type);

        await this._removeTweets([listid]);
    }
    async _sendQuery(optionsHash) {
        switch (this._tl_type) {
        case TwitSideModule.TL_TYPE.TEMP_OWNERSHIPLISTS:
        case TwitSideModule.TL_TYPE.TEMP_SUBSCRIPTIONLISTS:
        case TwitSideModule.TL_TYPE.TEMP_MEMBERSHIPLISTS:
            return await this._lists.getListsList(optionsHash);
        case TwitSideModule.TL_TYPE.TEMP_LISTMEMBER:
        case TwitSideModule.TL_TYPE.TEMP_LISTSUBSCRIBER:
            return await this._lists.getListMembers(optionsHash);
        }
        return Promise.reject();
    }

    // ツイートを保存して変更があったid一覧を返す
    async _saveTweets(data, more, notif) {
        // 更新したツイートID
        const tweets = [];

        for (let datum of data) {
            const target_id = this._zeroFillId(datum);
            if (!target_id) continue;

            // メタデータ確認
            let meta;
            if (this.isList)
                meta = this._getListMetadata(datum, target_id);
            else if (this.isListMember)
                meta = this._getListMemberMetadata(datum, target_id);
            this.record.data[target_id] = {
                meta : meta,
                raw  : datum
            };

            this.record.ids.push(target_id);

            // 更新データ（取得順）
            tweets.push(target_id);
        }

        const moreid = NINE_FILL + '_more';
        await this._removeTweets([moreid]);

        // more格納
        if (more) {
            this.record.data[moreid] = {
                meta : { boxid : moreid },
                raw  : { id_str : moreid }
            };
            this.record.ids.push(moreid);
            tweets.push(moreid);
        }
        return tweets;
    }

    // メタデータの作成（リスト）
    _getListMetadata(datum, boxid) {
        const meta = { boxid : boxid };

        // 自分のリスト
        if (this._own_userid === this._lists.targetid
            && this._tl_type === TwitSideModule.TL_TYPE.TEMP_OWNERSHIPLISTS)
            meta.isMine = (datum.user.id_str === this._own_userid);

        // 購読可能
        if (datum.user.id_str != this._own_userid) {
            if (this._own_userid === this._lists.targetid
                && this._tl_type === TwitSideModule.TL_TYPE.TEMP_MEMBERSHIPLISTS
                || this._own_userid != this._lists.targetid)
                meta.subscriptionable = true;
        }
        // 購読解除可能
        if (this._own_userid === this._lists.targetid
            && this._tl_type === TwitSideModule.TL_TYPE.TEMP_SUBSCRIPTIONLISTS)
            meta.unsubscriptionable = true;

        // カラムに追加可能
        if (this._own_userid === this._lists.targetid
            && (this._tl_type === TwitSideModule.TL_TYPE.TEMP_OWNERSHIPLISTS
                || this._tl_type === TwitSideModule.TL_TYPE.TEMP_SUBSCRIPTIONLISTS))
            meta.registrable = true;

        return meta;
    }

    // メタデータの作成（リスト）
    _getListMemberMetadata(datum, boxid) {
        const meta = { boxid : boxid };
        return meta;
    }

} //ListTimeline


/******************
 * FriendTimeline *
 ******************/
class FriendTimeline extends Timeline {

    constructor(tl_type, columnid, userinfo_hash, win_type, targetid) {
        super(tl_type, columnid, userinfo_hash, win_type);
        this._targetid = targetid;
        this._index    = 0;
    }

    beforeDestroy() {
        if (this._own_userid != this._targetid)
            switch(this._tl_type) {
            case TwitSideModule.TL_TYPE.TEMP_FOLLOW:
                TwitSideModule.Friends.clearFriends(
                    TwitSideModule.FRIEND_TYPE.FOLLOW, this._targetid
                );
                break;
            case TwitSideModule.TL_TYPE.TEMP_FOLLOWER:
                TwitSideModule.Friends.clearFriends(
                    TwitSideModule.FRIEND_TYPE.FOLLOWER, this._targetid
                );
                break;
            }
        super.beforeDestroy();
    }

    get isFriend() {
        if (this._tl_type === TwitSideModule.TL_TYPE.TEMP_FOLLOW) return true;
        if (this._tl_type === TwitSideModule.TL_TYPE.TEMP_FOLLOWER) return true;
        if (this._tl_type === TwitSideModule.TL_TYPE.TEMP_MUTE) return true;
        if (this._tl_type === TwitSideModule.TL_TYPE.TEMP_BLOCK) return true;
        if (this._tl_type === TwitSideModule.TL_TYPE.TEMP_NORETWEET) return true;
        return false;
    }

    async getNewer(notif) {
        const error = (result) => {
            // 状態遷移
            this._state = TwitSideModule.TL_STATE.STOPPED;
            TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.STATE_CHANGED,
                columnid : this._columnid,
                state    : this._state
            }, null, this._win_type);

            this._reportError(result);
            return Promise.reject();
        };

        // 一覧クリア
        await this._removeAllTweets();
        // カーソルリセット
        switch (this._tl_type) {
        case TwitSideModule.TL_TYPE.TEMP_FOLLOW:
            TwitSideModule.Friends.clearFriends(
                TwitSideModule.FRIEND_TYPE.FOLLOW, this._targetid
            );
            break;
        case TwitSideModule.TL_TYPE.TEMP_FOLLOWER:
            TwitSideModule.Friends.clearFriends(
                TwitSideModule.FRIEND_TYPE.FOLLOWER, this._targetid
            );
            break;
        case TwitSideModule.TL_TYPE.TEMP_MUTE:
            TwitSideModule.Friends.clearFriends(
                TwitSideModule.FRIEND_TYPE.MUTE, this._targetid
            );
            break;
        case TwitSideModule.TL_TYPE.TEMP_BLOCK:
            TwitSideModule.Friends.clearFriends(
                TwitSideModule.FRIEND_TYPE.BLOCK, this._targetid
            );
            break;
        case TwitSideModule.TL_TYPE.TEMP_NORETWEET:
            TwitSideModule.Friends.clearFriends(
                TwitSideModule.FRIEND_TYPE.NORETWEET, this._own_userid
            );
            break;
        }
        // Lookupインデックスリセット
        this._index = 0;

        // 通知
        notif = notif == null ? true : notif;
        // Twitterに送信するオプション
        const optionsHash = this.getNewerHash;

        // 重複読み込み禁止
        if (this._state !== TwitSideModule.TL_STATE.STOPPED
            && this._state !== TwitSideModule.TL_STATE.STARTED)
            return;
        // 自動再読込停止
        this.stopAutoReload();

        // 状態遷移
        this._state = TwitSideModule.TL_STATE.STARTING;
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.STATE_CHANGED,
            columnid : this._columnid,
            state    : this._state
        }, null, this._win_type);

        // 読み込み
        const result = await this._sendQuery(optionsHash).catch(error);

        // more確認
        const more = result.more;

        // 受信データを登録
        const tweets = await this._saveTweets(result.data, more, notif);
        await TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.TWEET_LOADED,
            tweets   : tweets,
            tl_type  : this._tl_type,
            columnid : this._columnid,
            keep_position : true
        }, null, this._win_type);

        // 状態遷移
        this._state = TwitSideModule.TL_STATE.STOPPED;
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.STATE_CHANGED,
            columnid : this._columnid,
            state    : this._state
        }, null, this._win_type);

        // 自動再読込開始
        if (this._autoReloadEnabled) this.startAutoReload();
    }
    async getOlder() {
        const error = (result) => {
            // 状態遷移
            this._state2 = TwitSideModule.TL_STATE.STOPPED;
            TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.STATE_CHANGED,
                columnid : this._columnid,
                state    : TwitSideModule.TL_STATE.LOADED
            }, null, this._win_type);

            this._reportError(result);
            return Promise.reject();
        };

        const moreid = this.record.ids[this.record.ids.length-1],
              maxid  = this.record.ids[this.record.ids.length-2];
        // moreidがmoreじゃないとき（読み込み完了時）
        if (!/_more$/.test(moreid)) return;

        const optionsHash = {};

        // 重複読み込み禁止
        if (this._state2 !== TwitSideModule.TL_STATE.STOPPED) return;

        // 状態遷移
        this._state2 = TwitSideModule.TL_STATE.LOADING;
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.STATE_CHANGED,
            columnid : this._columnid,
            state    : this._state2
        }, null, this._win_type);

        // 読み込み
        const result = await this._sendQuery(optionsHash).catch(error);

        // more確認
        const more = result.more;

        // 受信データを登録
        const tweets = await this._saveTweets(result.data, more);
        await TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.TWEET_LOADED,
            tweets   : tweets,
            tl_type  : this._tl_type,
            columnid : this._columnid
        }, null, this._win_type);

        // 状態遷移
        this._state2 = TwitSideModule.TL_STATE.STOPPED;
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.STATE_CHANGED,
            columnid : this._columnid,
            state    : TwitSideModule.TL_STATE.LOADED
        }, null, this._win_type);
    }
    async getMore() {
        await this.getOlder();
        return;
    }
    async destroy(boxid) {
        const error = (result) => {
            TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.ACTION_COMPLETED,
                action   : 'destroy',
                result   : 'failed',
                boxid    : boxid,
                columnid : this._columnid,
                message  : TwitSideModule.Message.transMessage(result)
            }, null, this._win_type);

            return Promise.reject();
        };

        // フレンドの削除
        const callback_friend = async (result) => {
            // アクション完了
            TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.ACTION_COMPLETED,
                action   : 'destroyUser',
                result   : 'success',
                boxid    : boxid,
                columnid : this._columnid
            }, null, this._win_type);

            await this._removeTweets([boxid]);
        };

        // ミュート一覧
        if (this._tl_type === TwitSideModule.TL_TYPE.TEMP_MUTE)
            callback_friend(await TwitSideModule.Friends.updateFriendship(
                TwitSideModule.FRIEND_TYPE.MUTE,
                boxid,
                false,
                this._tweet
            ).catch(error));

        // ブロック一覧
        if (this._tl_type === TwitSideModule.TL_TYPE.TEMP_BLOCK)
            callback_friend(await TwitSideModule.Friends.updateFriendship(
                TwitSideModule.FRIEND_TYPE.BLOCK,
                boxid,
                false,
                this._tweet
            ).catch(error));

        // リツイート非表示一覧
        else if (this._tl_type === TwitSideModule.TL_TYPE.TEMP_NORETWEET)
            callback_friend(await TwitSideModule.Friends.updateFriendship(
                TwitSideModule.FRIEND_TYPE.NORETWEET,
                boxid,
                false,
                this._tweet
            ).catch(error));
    }
    async follow(boxid, sw) {
        const error = (result) => {
            TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.ACTION_COMPLETED,
                action   : sw ? 'follow' : 'unfollow',
                result   : 'failed',
                boxid    : boxid,
                columnid : this._columnid,
                message  : TwitSideModule.Message.transMessage(result)
            }, null, this._win_type);

            return Promise.reject();
        };

        const idPath   = boxid.split('_'),
              targetId = idPath.pop();

        const result = await TwitSideModule.Friends.updateFriendship(
            TwitSideModule.FRIEND_TYPE.FOLLOW,
            targetId,
            sw,
            this._tweet
        ).catch(error);

        // アクション完了
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.ACTION_COMPLETED,
            action   : sw ? 'follow' : 'unfollow',
            result   : 'success',
            boxid    : boxid,
            columnid : this._columnid
        }, null, this._win_type);

        if (!sw && this._tl_type === TwitSideModule.TL_TYPE.TEMP_FOLLOW)
            await this._removeTweets([boxid]);
        else {
            // ツイート再読込
            const result = await TwitSideModule.Friends.lookup(
                [targetId],
                this._tweet
            );

            // 受信データを登録
            const more   = this.record.ids.includes(NINE_FILL + '_more'),
                  tweets = await this._saveTweets(result.data, more);
            await TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.TWEET_LOADED,
                tweets   : tweets,
                tl_type  : this._tl_type,
                columnid : this._columnid
            }, null, this._win_type);
        }
    }
    async block(boxid) {
        const error = (result) => {
            TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.ACTION_COMPLETED,
                action   : 'block',
                result   : 'failed',
                boxid    : boxid,
                columnid : this._columnid,
                message  : TwitSideModule.Message.transMessage(result)
            }, null, this._win_type);

            return Promise.reject();
        };

        const idPath   = boxid.split('_'),
              targetId = idPath.pop();

        const result = await TwitSideModule.Friends.updateFriendship(
            TwitSideModule.FRIEND_TYPE.BLOCK,
            targetId,
            true,
            this._tweet
        ).catch(error);

        // アクション完了
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.ACTION_COMPLETED,
            action   : 'block',
            result   : 'success',
            boxid    : boxid,
            columnid : this._columnid
        }, null, this._win_type);

        // ブロックしたらフォロー・フォロワーが外れる
        await this._removeTweets([boxid]);
    }
    async _sendQuery(optionsHash) {
        return await this._getFriends(optionsHash);
    }
    // フォロー、フォロワー向け（tweetの代わり）
    async _getFriends(optionsHash) {
        switch (this._tl_type) {
        case TwitSideModule.TL_TYPE.TEMP_FOLLOW:
            // ID未取得時
            const follows = TwitSideModule.Friends.getFollows(this._targetid);
            if (!follows) {
                await TwitSideModule.Friends.loadFriendIdList(
                    TwitSideModule.FRIEND_TYPE.FOLLOW,
                    this._tweet,
                    this._targetid
                );
                return this._getFriends(optionsHash);
            }
            // ID取得済み
            // 続きLookup
            else if (follows.length > this._index) {
                const result = await TwitSideModule.Friends.lookup(
                    follows.slice(this._index, this._index+100),
                    this._tweet
                );
                this._index += (result.data).length;
                // more確認
                const more = (TwitSideModule.Friends.hasMoreFollow(this._targetid)
                              || TwitSideModule.Friends.getFollows(this._targetid).length > this._index)
                      ? true
                      : false;
                return {
                    status : result.status,
                    data   : (result.data),
                    more   : more
                };
            }
            // 取得分Lookup済み
            else {
                if (TwitSideModule.Friends.hasMoreFollow(this._targetid)) {
                    await TwitSideModule.Friends.loadFriendIdList(
                        TwitSideModule.FRIEND_TYPE.FOLLOW,
                        this._tweet,
                        this._targetid
                    );
                    return this._getFriends(optionsHash);
                }
                else return {
                    status : null,
                    data   : [],
                    more   : false
                };
            }

        case TwitSideModule.TL_TYPE.TEMP_FOLLOWER:
            // ID未取得時
            const followers = TwitSideModule.Friends.getFollowers(this._targetid);
            if (!followers) {
                await TwitSideModule.Friends.loadFriendIdList(
                    TwitSideModule.FRIEND_TYPE.FOLLOWER,
                    this._tweet,
                    this._targetid
                );
                return this._getFriends(optionsHash);
            }
            // ID取得済み
            // 続きLookup
            else if (followers.length > this._index) {
                const result = await TwitSideModule.Friends.lookup(
                    followers.slice(this._index, this._index+100),
                    this._tweet
                );
                this._index += (result.data).length;
                // more確認
                const more = (TwitSideModule.Friends.hasMoreFollower(this._targetid)
                              || TwitSideModule.Friends.getFollowers(this._targetid).length > this._index)
                      ? true
                      : false;
                return {
                    status : result.status,
                    data   : (result.data),
                    more   : more
                };
            }
            // 取得分Lookup済み
            else {
                if (TwitSideModule.Friends.hasMoreFollower(this._targetid)) {
                    await TwitSideModule.Friends.loadFriendIdList(
                        TwitSideModule.FRIEND_TYPE.FOLLOWER,
                        this._tweet,
                        this._targetid
                    );
                    return this._getFriends(optionsHash);
                }
                else return {
                    status : null,
                    data   : [],
                    more   : false
                };
            }

        case TwitSideModule.TL_TYPE.TEMP_MUTE:
            // ID未取得時
            const mutes = TwitSideModule.Friends.getMutes(this._own_userid);
            if (!mutes) {
                await TwitSideModule.Friends.loadFriendIdList(
                    TwitSideModule.FRIEND_TYPE.MUTE,
                    this._tweet,
                    this._own_userid
                );
                return this._getFriends(optionsHash);
            }
            // ID取得済み
            // 続きLookup
            else if (mutes.length > this._index) {
                const result = await TwitSideModule.Friends.lookup(
                    mutes.slice(this._index, this._index+100),
                    this._tweet
                );
                this._index += (result.data).length;
                // more確認
                const more = (TwitSideModule.Friends.hasMoreMute(this._own_userid)
                              || TwitSideModule.Friends.getMutes(this._own_userid).length > this._index)
                      ? true
                      : false;
                return {
                    status : result.status,
                    data   : (result.data),
                    more   : more
                };
            }
            // 取得分Lookup済み
            else {
                // （muteは全IDを取得しているはずなので基本的に続きはない）
                if (TwitSideModule.Friends.hasMoreMute(this._own_userid)) {
                    await TwitSideModule.Friends.loadFriendIdList(
                        TwitSideModule.FRIEND_TYPE.MUTE,
                        this._tweet,
                        this._own_userid
                    );
                    return this._getFriends(optionsHash);
                }
                else return {
                    status : null,
                    data   : [],
                    more   : false
                };
            }

        case TwitSideModule.TL_TYPE.TEMP_BLOCK:
            // ID未取得時
            const blocks = TwitSideModule.Friends.getBlocks(this._own_userid);
            if (!blocks) {
                await TwitSideModule.Friends.loadFriendIdList(
                    TwitSideModule.FRIEND_TYPE.BLOCK,
                    this._tweet,
                    this._own_userid
                );
                return this._getFriends(optionsHash);
            }
            // ID取得済み
            // 続きLookup
            else if (blocks.length > this._index) {
                const result = await TwitSideModule.Friends.lookup(
                    blocks.slice(this._index, this._index+100),
                    this._tweet
                );
                this._index += (result.data).length;
                // more確認
                const more = (TwitSideModule.Friends.hasMoreBlock(this._own_userid)
                              || TwitSideModule.Friends.getBlocks(this._own_userid).length > this._index)
                      ? true
                      : false;
                return {
                    status : result.status,
                    data   : (result.data),
                    more   : more
                };
            }
            // 取得分Lookup済み
            else {
                // （blockは全IDを取得しているはずなので基本的に続きはない）
                if (TwitSideModule.Friends.hasMoreBlock(this._own_userid)) {
                    await TwitSideModule.Friends.loadFriendIdList(
                        TwitSideModule.FRIEND_TYPE.BLOCK,
                        this._tweet,
                        this._own_userid
                    );
                    return this._getFriends(optionsHash);
                }
                else return {
                    status : null,
                    data   : [],
                    more   : false
                };
            }

        case TwitSideModule.TL_TYPE.TEMP_NORETWEET:
            // ID未取得時
            const noretweets = TwitSideModule.Friends.getNoretweets(this._own_userid);
            if (!noretweets) {
                await TwitSideModule.Friends.loadFriendIdList(
                    TwitSideModule.FRIEND_TYPE.NORETWEET,
                    this._tweet,
                    this._own_userid
                );
                return this._getFriends(optionsHash);
            }
            // ID取得済み
            // 続きLookup
            else if (noretweets.length > this._index) {
                const result = await TwitSideModule.Friends.lookup(
                    noretweets.slice(this._index, this._index+100),
                    this._tweet
                );
                this._index += (result.data).length;
                // more確認
                const more = (TwitSideModule.Friends.hasMoreNoretweet(this._own_userid)
                              || TwitSideModule.Friends.getNoretweets(this._own_userid).length > this._index)
                      ? true
                      : false;
                return {
                    status : result.status,
                    data   : (result.data),
                    more   : more
                };
            }
            // 取得分Lookup済み（noretweetはcursorがない）
            else return {
                status : null,
                data   : [],
                more   : false
            };

        default:
            return Promise.reject();
        }
    }

    // ツイートを保存して変更があったid一覧を返す
    async _saveTweets(data, more, notif) {
        // 更新したツイートID
        const tweets = [];

        for (let datum of data) {
            const target_id = this._zeroFillId(datum);
            if (!target_id) continue;

            // メタデータ確認
            const meta = this._getFriendMetadata(datum, target_id);
            this.record.data[target_id] = {
                meta : meta,
                raw  : datum
            };

            // 更新じゃない場合
            if (!this.record.ids.includes(target_id))
                this.record.ids.push(target_id);

            // 更新データ（取得順）
            tweets.push(target_id);
        }

        const moreid = NINE_FILL + '_more';
        await this._removeTweets([moreid]);

        // more格納
        if (more) {
            this.record.data[moreid] = {
                meta : { boxid : moreid },
                raw  : { id_str : moreid }
            };
            this.record.ids.push(moreid);
            tweets.push(moreid);
        }
        return tweets;
    }

    // メタデータの作成（リスト）
    _getFriendMetadata(datum, boxid) {
        const meta = { boxid : boxid };
        return meta;
    }

} //FriendTimeline
