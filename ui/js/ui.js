/**
 * @fileOverview UI operation
 * @name ui.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

/**
 * 全ウィンドウ向け変数
 */
const UI = {
    _initialized  : false,
    _win_type     : null,
    $activecolumn : null,

    tweetMenuFuncList : {
        retweet             : (obj) => { onClickRetweet($(obj).closest('.tweetBox')[0]); },
        quote               : (obj) => { onClickQuote($(obj).closest('.tweetBox')[0]); },
        rt                  : (obj) => { onClickRt($(obj).closest('.tweetBox')[0]); },
        showtext            : (obj) => { onClickShowtext($(obj).closest('.tweetBox')[0]); },
        opentweeturl        : (obj) => { onClickOpentweeturl($(obj).closest('.tweetBox')[0]); },
        reply               : (obj) => { onClickReply($(obj).closest('.tweetBox')[0]); },
        replyall            : (obj) => { onClickReplyall($(obj).closest('.tweetBox')[0]); },
        favorite            : (obj) => { onClickFavorite($(obj).closest('.tweetBox')[0]); },
        showreply           : (obj) => { onClickShowreply($(obj).closest('.tweetBox')[0]); },
        destroy             : (obj) => { onClickDestroy($(obj).closest('.tweetBox')[0]); },
        showretweetedusers  : (obj) => { onClickShowretweetedusers($(obj).closest('.tweetBox')[0]); },
        replydm             : (obj) => { onClickReplydm($(obj).closest('.tweetBox')[0]); },
        destroyuser         : (obj) => { onClickDestroyUser($(obj).closest('.tweetBox')[0]); },
        updatelist          : (obj) => { onClickEditList($(obj).closest('.tweetBox')[0]); },
        showmembers         : (obj) => { onClickShowMembers($(obj).closest('.tweetBox')[0]); },
        showsubscribers     : (obj) => { onClickShowSubscribers($(obj).closest('.tweetBox')[0]); },
        subscribe           : (obj) => { onClickSubscribe($(obj).closest('.tweetBox')[0]); },
        unsubscribe         : (obj) => { onClickUnsubscribe($(obj).closest('.tweetBox')[0]); },
        addlist2column      : (obj) => { onClickAddList2Column($(obj).closest('.tweetBox')[0]); }
    },

    get initialized() { return this._initialized; },

    initialize : function(win_type) {
        this._win_type = win_type;
        this.setStyleSheets();

        // レシーバー
        TwitSideModule.windows.addReceiver(fg.id, win_type, this.receiver);

        switch (win_type) {
        case TwitSideModule.WINDOW_TYPE.MAIN:
            // テンプレート
            this.$tweetUserTemplate  = $('#templateContainer .tweetUserOption');
            this.$menuItemTemplate   = $('#templateContainer .menuProfileItem');
            // コンテナ
            this.$tweetUserSelection = $('#tweetUserSelection');
            this.$leftC              = $('#leftContainer');
            this.$leftCmenuList      = $('#leftContainer .menuList');
            break;
        case TwitSideModule.WINDOW_TYPE.PROFILE:
            // テンプレート
            this.$friendTemplate     = $('#templateFriendBox');
            break;
        case TwitSideModule.WINDOW_TYPE.SEARCH:
            break;
        case TwitSideModule.WINDOW_TYPE.MUTE:
        case TwitSideModule.WINDOW_TYPE.BLOCK:
        case TwitSideModule.WINDOW_TYPE.NORETWEET:
            // テンプレート
            this.$tweetUserTemplate  = $('#templateContainer .tweetUserOption');
            // コンテナ
            this.$tweetUserSelection = $('#tweetUserSelection');
            break;
        case TwitSideModule.WINDOW_TYPE.LISTMEMBER:
            break;
        }

        // 共通テンプレート
        this.$tweetBoxTemplate       = $('#templateContainer .tweetBox');
        this.$tweetMoreBoxTemplate   = $('#templateContainer .tweetMoreBox');
        this.$columnTabTemplate      = $('#templateContainer .columnTab');
        this.$columnTemplate         = $('#templateContainer .column');
        // 共通コンテナ
        this.$mainC                  = $('#mainContainer'); // 横スクロール
        this.$columnC                = $('#columnContainer');
        this.$columnTabC             = $('#columnTabContainer');

        // 右クリックメニュー
        $.contextMenu({
            selector : '.tweetBox',
            zindex : 10,
            build : ($trigger, e) => {
                // リプライは機能制限
                if ($(e.currentTarget).closest('.replyTweetBox').length)
                    return false;
                return {
                    callback : (key, options) => { UI.tweetMenuFuncList[key]($trigger); },
                    items    : $trigger[0].contextMenuItems
                };
            }});

        // 初期化済
        this._initialized = true;

        // 初期UI作成
        switch (win_type) {
        case TwitSideModule.WINDOW_TYPE.MAIN:
            {
                // カラムを左端へ初期化
                this.$mainC.scrollLeft(0);
                // ドロップダウンメニュー
                this.$tweetUserSelection.select2({
                    minimumResultsForSearch : Infinity,
                    width                   : 'off',
                    templateSelection       : (state) => {
                        const $i = $('<img class="tweetUserItemImage" />')
                              .attr('src', state.element.dataset.image),
                              $l = $('<span />').text(state.text);
                        return $('<span class="tweetUserItemBox" />').append($i, $l);
                    }
                });

                const all_tlinfo   = TwitSideModule.ManageColumns.getTimelineInfo(),
                      all_colinfo  = TwitSideModule.ManageColumns.getColumnInfo();

                // ユーザ
                UI.updateTweetUsers();
                // カラム
                for (let columnidx in all_tlinfo) {
                    UI._makeColumn(
                        all_tlinfo[columnidx].id,
                        all_colinfo[columnidx],
                        columnidx
                    );
                    // タイムラインの状態からボタンとプログレスバー
                    TwitSideModule.ManageColumns.getTimelineInfo(columnidx, 'timeline').renotifyStatus(fg.id);
                }
                // 通知取得
                updateNotifications();
            }
            break;

        case TwitSideModule.WINDOW_TYPE.MUTE:
        case TwitSideModule.WINDOW_TYPE.BLOCK:
        case TwitSideModule.WINDOW_TYPE.NORETWEET:
            {
                // ドロップダウンメニュー
                this.$tweetUserSelection.select2({
                    minimumResultsForSearch : Infinity,
                    width                   : 'off',
                    templateSelection       : (state) => {
                        const $i = $('<img class="tweetUserItemImage" />')
                              .attr('src', state.element.dataset.image),
                              $l = $('<span />').text(state.text);
                        return $('<span class="tweetUserItemBox" />').append($i, $l);
                    }
                });

                // ツイートユーザ
                const all_userinfo = TwitSideModule.ManageUsers.getUserInfo();

                UI.updateTweetUserSelection(this.$tweetUserSelection, this.$tweetUserTemplate, all_userinfo);
            }
            break;

        default:
            return Promise.resolve();
        }
    },

    finish : function() {
        TwitSideModule.windows.removeReceiver(fg.id);
    },

    receiver : function(data) {
        // debug
        TwitSideModule.debug.log(data);

        /**
         * STATE_CHANGED
         */
        const stateChanged = () => {
            const columnid = data.columnid;

            const $column        = $('#'+columnid),
                  $update_button = $column.find('.updateButton');

            switch (data.state) {
            case TwitSideModule.TL_STATE.STOPPED:
                showLoadingProgressbar(false, columnid);
                $update_button.attr('data-disabled', 'false');
                break;
            case TwitSideModule.TL_STATE.STARTING:
                showLoadingProgressbar(true, columnid);
                $update_button.attr('data-disabled', 'true');
                break;
            case TwitSideModule.TL_STATE.STARTED:
                showLoadingProgressbar(false, columnid);
                $update_button.attr('data-disabled', 'false');
                break;
            case TwitSideModule.TL_STATE.LOADING:
                showLoadingProgressbar(true, columnid);
                break;
            case TwitSideModule.TL_STATE.LOADED:
                $column.attr('data-more', '');
                showLoadingProgressbar(false, columnid);
                break;
            }
        };

        /**
         * MESSAGE_RCVD
         */
        const messageReceived = () => {
            UI.showMessage(data.message);
        };

        /**
         * NOTIF_CHANGED
         */
        const notifChanged = async () => {
            updateNotifications(data.unread, data.count, data.notifications);
        };

        /**
         * VOTE_REQUIRED
         */
        const voteRequired = () => {
            const $column  = $('#'+data.columnid),
                  timeline = $column.find('.timelineBox')[0];

            // 最上部
            if (timeline.scrollTop == 0) return true;
            else return false;
        };

        /**
         * COLUMN_CHANGED
         */
        const columnChanged = () => {
            switch (data.action) {
            case TwitSideModule.ACTION.ADD:
                UI._makeColumn(
                    data.columnid,
                    data.columninfo,
                    data.index
                );
                break;
            case TwitSideModule.ACTION.EDIT:
                UI._changeColumnConf(
                    data.columnid,
                    data.columninfo
                );
                break;
            case TwitSideModule.ACTION.SORT:
                UI._sortColumn(
                    data.old_index,
                    data.new_index
                );
                break;
            case TwitSideModule.ACTION.DELETE:
                UI._deleteColumn(
                    data.columnid,
                    data.old_index
                );
                break;
            case TwitSideModule.ACTION.DELETE_ALL:
                UI.$columnC.empty();
                UI.$columnTabC.empty();
                break;
            }
        };

        /**
         * USER_CHANGED
         */
        const userChanged = () => {
            UI.updateTweetUsers();
        };

        /**
         * RUN_FUNCTION
         */
        const runFunction = () => {
            switch (data.function) {
            case TwitSideModule.FUNCTION_TYPE.QUOTE:
                onClickQuote(data.tweetBox, data.tweetinfo, data.userid);
                break;
            case TwitSideModule.FUNCTION_TYPE.RT:
                onClickRt(data.tweetBox, data.userid);
                break;
            case TwitSideModule.FUNCTION_TYPE.REPLY:
                onClickReply(data.tweetBox, data.tweetinfo, data.userid);
                break;
            case TwitSideModule.FUNCTION_TYPE.REPLYALL:
                onClickReplyall(data.tweetBox, data.tweetinfo, data.userid);
                break;
            case TwitSideModule.FUNCTION_TYPE.NEWTWEET:
                if (UI._win_type != TwitSideModule.WINDOW_TYPE.MAIN) return;
                newTweetContainerToggle(true);
                return;
            }
            changeTweetUser(data.userid);
        };

        switch (data.reason) {
        case TwitSideModule.UPDATE.TWEET_LOADED:
        case TwitSideModule.UPDATE.REPLACE_LOADED:
            return UI._showTweets(data.tl_type,
                                  data.columnid,
                                  data.tweets,
                                  data.keep_position);
        case TwitSideModule.UPDATE.REPLY_LOADED:
            return UI._showReply(data.tl_type,
                                 data.columnid,
                                 data.boxid);
        case TwitSideModule.UPDATE.PROGRESS:
            showProgressbar(data.data);
            break;
        case TwitSideModule.UPDATE.IMAGE_LOADED:
            UI._updateThumbnail(data.columnid,
                                data.boxid,
                                data.index);
            break;
        case TwitSideModule.UPDATE.TWEET_DELETED:
            return UI._deleteTweet(data.columnid,
                                   data.tweets);
        case TwitSideModule.UPDATE.TWEET_ALLDELETED:
            return UI._deleteAllTweet(data.columnid);
        case TwitSideModule.UPDATE.STATE_CHANGED:
            stateChanged();
            break;
        case TwitSideModule.UPDATE.ACTION_COMPLETED:
            {
                const message = browser.i18n.getMessage(data.action + '_' + data.result)
                      + (data.message ? '\n' + data.message : '');
                UI.showMessage(message);
            }
            break;
        case TwitSideModule.UPDATE.MESSAGE:
            messageReceived();
            break;
        case TwitSideModule.UPDATE.NOTIF_CHANGED:
            notifChanged();
            break;
        case TwitSideModule.UPDATE.VOTE_REQUIRED:
            return voteRequired();
        case TwitSideModule.UPDATE.UI_CHANGED:
            UI.setStyleSheets();
            if (UI._win_type == TwitSideModule.WINDOW_TYPE.MAIN) calcColumns();
            break;
        case TwitSideModule.UPDATE.COLUMN_CHANGED:
            columnChanged();
            break;
        case TwitSideModule.UPDATE.USER_CHANGED:
            userChanged();
            break;
        case TwitSideModule.UPDATE.RUN_FUNCTION:
            runFunction();
            break;
        case TwitSideModule.UPDATE.ERROR:
            messageReceived();
            break;
        }

        return null;
    },

    /**
     * ツイート操作
     */
    // ツイートを表示
    _showTweets : function(type, columnid, tweets, keep) {
        if (!tweets.length) return;
        let offsetBottom, keepTop;
        const timelineBox = $('#'+columnid).children('.timelineBox')[0],
              tl          = TwitSideModule.ManageColumns.getTimelineInfo(
                  TwitSideModule.ManageColumns.searchTimeline({ id : columnid }, this._win_type),
                  'timeline',
                  this._win_type
              );

        if (!timelineBox) return;

        // 高さを維持
        if (keep && timelineBox.scrollTop)
            offsetBottom = timelineBox.scrollHeight - timelineBox.scrollTop;
        // 最上部を維持
        if (TwitSideModule.config.getPref('autoreload_totop')
            && timelineBox.scrollTop == 0)
            keepTop = true;

        // 小さいID（古いツイート・逆）順にinsertbefore
        for (let id of tweets.slice().reverse()) {
            const box     = document.getElementById(columnid+'_'+id),
                  datum   = tl.tweetInfo(id),
                  nextbox = datum.nextid
                  ? document.getElementById(columnid+'_'+datum.nextid)
                  : null;

            // 存在する場合はツイートを置換（削除→追加）
            if (box) $(box).remove();

            // ツイートを挿入
            switch (type) {
            case TwitSideModule.TL_TYPE.DIRECTMESSAGE:
            case TwitSideModule.TL_TYPE.TEMP_DIRECTMESSAGE:
                timelineBox.insertBefore(
                    this._createDmTweetBox(
                        type, datum.tweetinfo, columnid, false
                    ), nextbox
                );
                break;
            case TwitSideModule.TL_TYPE.TEMP_FOLLOW:
            case TwitSideModule.TL_TYPE.TEMP_FOLLOWER:
                timelineBox.insertBefore(
                    this._createFriendTweetBox(
                        type, datum.tweetinfo, columnid
                    ), nextbox
                );
                break;
            case TwitSideModule.TL_TYPE.TEMP_MUTE:
            case TwitSideModule.TL_TYPE.TEMP_BLOCK:
            case TwitSideModule.TL_TYPE.TEMP_NORETWEET:
            case TwitSideModule.TL_TYPE.TEMP_LISTMEMBER:
            case TwitSideModule.TL_TYPE.TEMP_LISTSUBSCRIBER:
                timelineBox.insertBefore(
                    this._createUserListBox(
                        type, datum.tweetinfo, columnid
                    ), nextbox
                );
                break;
            case TwitSideModule.TL_TYPE.TEMP_OWNERSHIPLISTS:
            case TwitSideModule.TL_TYPE.TEMP_SUBSCRIPTIONLISTS:
            case TwitSideModule.TL_TYPE.TEMP_MEMBERSHIPLISTS:
                timelineBox.insertBefore(
                    this._createListTweetBox(
                        type, datum.tweetinfo, columnid
                    ), nextbox
                );
                break;
            default:
                timelineBox.insertBefore(
                    UI._createTweetBox(
                        type, datum.tweetinfo, columnid, null
                    ), nextbox
                );
            }
        }

        // 挿入後にスクロール位置修正
        // 一番上を維持
        if (keepTop)
            timelineBox.scrollTop = 0;
        // 高さを維持
        else if (keep && offsetBottom)
            timelineBox.scrollTop = timelineBox.scrollHeight - offsetBottom;
    },

    // リプライを表示
    _showReply : function(type, columnid, boxid) {
        const parentboxid = '#'+columnid+'_'+boxid.split('_reply_')[0],
              $replyBox   = $(parentboxid).find('.replyTweetBox').last(),
              tl          = TwitSideModule.ManageColumns.getTimelineInfo(
                  TwitSideModule.ManageColumns.searchTimeline(
                      { id : columnid },
                      this._win_type
                  ), 'timeline', this._win_type
              ),
              datum      = tl.tweetInfo(boxid);

        // 閉じられているときは表示しない
        if ($replyBox.attr('data-reply-open') != 'true') return;

        // リプライは機能制限
        const $reply = $(this._createTweetBox(
            type, datum.tweetinfo, columnid, null
        ));
        $reply.children('.tweetContent').children().remove(':not(.tweetMainContent)');
        $replyBox.find('> .replies').append($reply);
    },

    // サムネイル更新
    _updateThumbnail : function(columnid, boxid, index) {
        const $thumbimg = $('#'+columnid+'_'+boxid).find('.tweetThumbnail:first() > .tweetThumbnailImage').eq(index),
              tl        = TwitSideModule.ManageColumns.getTimelineInfo(
                  TwitSideModule.ManageColumns.searchTimeline({ id : columnid }, this._win_type),
                  'timeline',
                  this._win_type
              ),
              pic       = tl.tweetInfo(boxid).tweetinfo.meta.pics[index];

        $thumbimg.attr({
            src            : pic.thumburl,
            'data-fullurl' : pic.fullurl
        });
    },

    // ツイート削除
    _deleteTweet : function(columnid, tweets) {
        const $column = $('#'+columnid);

        for (let id of tweets) {
            const $target = $('#'+columnid+'_'+id);

            // 削除される前にフォーカスを前に移す
            if ($target.is(':focus'))
                $target.prev().focus();
            // 削除される前にactiveBox前に移す
            else if ($column[0].$activeBox && $target[0] === $column[0].$activeBox[0])
                $column[0].$activeBox = $target.prev();

            $target.remove();
        }
    },

    // ツイート削除
    _deleteAllTweet : function(columnid) {
        const $column = $('#'+columnid);
        $column.children('.timelineBox').empty();
        $column[0].$activeBox = null;
    },

    // ツイート用
    _createTweetBox : function(type, record, columnid, parentTweetid) {
        // 投稿ソース認識
        const analyzeSource = (source) => {
            return $('<span>' + source.replace(/&/g, '&amp;') + '</span>').text();
        };

        const fullboxid = columnid+'_'+record.meta.boxid;

        // more
        if (/_more$/.test(fullboxid)) {
            return this.$tweetMoreBoxTemplate.clone().attr({
                    id            : fullboxid,
                    'data-origid' : record.raw.id_str
                })[0];
        }

        const $tweetBox     = this.$tweetBoxTemplate.clone().attr('id', fullboxid),
              $tweetContent = $tweetBox.children('.tweetContent').eq(0),
              $tweetInline  = $tweetContent.children('.inlineTweetBox').eq(0);

        // 属性設定
        $tweetBox.attr({
            'data-tweetid'  : record.raw.id_str,
            'data-parentid' : parentTweetid || ''
        });
        $tweetContent.attr({
            'data-mine'      : record.meta.isMine || '',
            'data-forme'     : record.meta.isForMe || '',
            'data-retweeted' : record.raw.retweeted || ''
        });

        /**
         * リツイートされた・されてないツイート共通
         */
        {
            const recordStatus = record.raw.retweeted_status
                  ? record.raw.retweeted_status
                  : record.raw;

            // ツイートの情報
            $tweetBox.attr({
                'data-origid'     : recordStatus.id_str,
                'data-rawcontent' : record.meta.text,
                'data-screenname' : '@' + recordStatus.user.screen_name
            });
            // ユーザ情報
            $tweetContent.find('.tweetUserImage')
                .attr('src', recordStatus.user.profile_image_url_https);
            $tweetContent.find('.tweetUserName').attr({
                'data-screenname' : '@' + recordStatus.user.screen_name,
                'data-username'   : recordStatus.user.name
            });
            // place
            if (recordStatus.geo && recordStatus.place) {
                const $place = $tweetContent.find('.tweetStatusPlace'),
                      ll     = recordStatus.geo.coordinates.join(',');
                $place.attr({
                    'title'       : recordStatus.place.full_name,
                    'data-mapurl' : 'http://maps.google.com/?q=' + ll
                }).on('click', () => { openURL('http://maps.google.com/?q=' + ll); });
            }
            else if (recordStatus.place) {
                let $place = $tweetContent.find('.tweetStatusPlace');
                $place.attr({
                    'title'       : recordStatus.place.full_name,
                    'data-mapurl' : 'http://maps.google.com/?q=' + recordStatus.place.full_name
                });
            }
            // verified
            if (recordStatus.user.verified)
                $tweetContent.attr('data-verified', 'true');
            // 本文
            $tweetContent.find('.tweetText')
                .text(TwitSideModule.text.unescapeHTML(record.meta.text));
            // 投稿ソース
            $tweetContent.find('.tweetSource')
                .text('from ' + analyzeSource(recordStatus.source));
            // タイムスタンプ
            $tweetContent.find('.tweetTime')
                .text(TwitSideModule.text.convertTimeStamp(
                    TwitSideModule.text.analyzeTimestamp(recordStatus.created_at),
                    TwitSideModule.config.getPref('time_locale'),
                    TwitSideModule.text.createTimeformat()
                ));
        }

        /**
         * リツイートされたツイート
         */
        if (record.raw.retweeted_status) {
            $tweetContent.attr('data-retweet', 'true');

            $tweetContent.find('.tweetRetweeter');
            $tweetContent.find('.tweetRetweeterImage')
                .attr({ src   : record.raw.user.profile_image_url,
                        title : '@' + record.raw.user.screen_name });
            $tweetContent.find('.tweetRetweeterName')
                .attr({
                    'data-screenname' : '@' + record.raw.user.screen_name,
                    'data-username'   : record.raw.user.name
                });
            $tweetContent.find('.tweetRetweeterCount')
                .attr('data-count', record.raw.retweeted_status.retweet_count);
        }
        /**
         * リツイートされていないツイート
         */
        else {
            // リツイートされた自分のツイート
            if (type == TwitSideModule.TL_TYPE.RETWEETED
                || record.raw.retweet_count) {
                $tweetContent.find('.tweetRetweeter');
                $tweetContent.find('.tweetRetweeterCount')
                    .attr('data-count', record.raw.retweet_count);
            }
            // protected
            if (record.raw.user.protected)
                $tweetContent.attr('data-protected', 'true');
        }

        /**
         * 基本メニュー
         */
        const entities    = record.meta.entities,
              contextMenu = {};

        // 返信
        contextMenu.reply = {
            name    : browser.i18n.getMessage('tweetReply'),
            icon    : 'fa-reply',
            visible : function() { return document.body.dataset.menuReply == 'true'; }
        };
        // 全員に返信
        $tweetBox.attr('data-screennames', record.meta.screennames.join(' '));
        if (record.meta.screennames.length > 1)
            contextMenu.replyall = {
                name    : browser.i18n.getMessage('tweetReplyall'),
                icon    : 'fa-reply-all',
                visible : function() { return document.body.dataset.menuReply == 'true'; }
            };
        // 公式RT
        {
            contextMenu.retweet = {
                name : browser.i18n.getMessage('tweetRetweet'),
                icon : 'fa-retweet'
            };
            if ( record.raw.retweeted
                 || (record.raw.retweeted_status && record.meta.isMine)
                 || (!record.raw.retweeted_status && record.raw.user.protected))
                contextMenu.retweet.disabled = true;
        };
        // 引用リツイート
        contextMenu.quote = {
            name : browser.i18n.getMessage('tweetQuote'),
            icon : 'fa-retweet'
        };
        // 引用してRT
        contextMenu.rt = {
            name : browser.i18n.getMessage('tweetRt'),
            icon : 'fa-quote-left'
        };
        // お気に入り
        if (record.raw.favorited) {
            $tweetContent.attr('data-favorited', 'true');
            // お気に入り解除
            contextMenu.favorite = {
                name    : browser.i18n.getMessage('tweetUnfavorite'),
                icon    : 'fa-star',
                visible : function() { return document.body.dataset.menuFavorite == 'true'; }
            };
        }
        else {
            // お気に入り追加
            contextMenu.favorite = {
                name    : browser.i18n.getMessage('tweetFavorite'),
                icon    : 'fa-star',
                visible : function() { return document.body.dataset.menuFavorite == 'true'; }
            };
        }
        // ツイートテキスト
        contextMenu.showtext = {
            name : browser.i18n.getMessage('tweetShowtext'),
            icon : 'fa-clipboard'
        };
        // ツイートを開く
        contextMenu.opentweeturl = {
            name : browser.i18n.getMessage('tweetOpentweeturl'),
            icon : 'fa-external-link'
        };
        // 会話
        if (!/_reply_/.test(fullboxid) && record.raw.retweeted_status
            ? record.raw.retweeted_status.in_reply_to_status_id_str
            : record.raw.in_reply_to_status_id_str) {

            $tweetContent.attr('data-inreply', 'true');
            contextMenu.showreply = {
                name    : browser.i18n.getMessage('tweetShowreply'),
                icon    : 'fa-commenting',
                visible : function() { return document.body.dataset.menuConversation == 'true'; }
            };
        }
        // 削除
        if (record.meta.isMine || record.raw.retweeted)
            contextMenu.destroy = {
                name : browser.i18n.getMessage('tweetDestroy'),
                icon : 'fa-trash'
            };
        // リツイートされたツイート
        if (record.raw.retweet_count
            || record.raw.retweeted_status && record.raw.retweeted_status.retweet_count)
            contextMenu.showretweetedusers = {
                name : browser.i18n.getMessage('tweetShowretweetedusers'),
                icon : 'fa-users'
            };
        // 既にメタデータ取得済み
        if (record.meta.retweeters) {
            let $tweetRetweeterList = $tweetContent.find('.tweetRetweeterList'),
                $imageTemplate      = $('#templateContainer > .tweetRetweeterImage');

            for (let rt of record.meta.retweeters)
                $imageTemplate.clone().attr(rt).appendTo($tweetRetweeterList);
        }
        // スクリーンネーム
        if (record.meta.screennames.length) {
            contextMenu.users = {
                name  : browser.i18n.getMessage('tweetUsers'),
                icon  : 'fa-user-circle',
                items : {}
            };
            for (let sn of record.meta.screennames) {
                contextMenu.users.items[sn] = {
                    name : sn,
                    icon : 'fa-at',
                    callback : (key, opt) => {
                        TwitSideModule.ManageWindows.openWindow('profile', {
                            userid  : this.getActiveColumn().attr('data-userid'),
                            keyword : sn
                        }, this._win_type === TwitSideModule.WINDOW_TYPE.MAIN ? fg.id : TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
                    }
                };
            }
        }
        // ハッシュタグ
        if (entities.hashtags.length) {
            contextMenu.hashtags = {
                name  : browser.i18n.getMessage('tweetHashtags'),
                icon  : 'fa-tag',
                items : {}
            };
            for (let ht of entities.hashtags) {
                contextMenu.hashtags.items['#'+ht.text] = {
                    name : '#'+ht.text,
                    icon : 'fa-hashtag',
                    callback : (key, opt) => {
                        TwitSideModule.ManageWindows.openWindow('search', {
                            userid  : this.getActiveColumn().attr('data-userid'),
                            keyword : '#'+ht.text
                        }, this._win_type === TwitSideModule.WINDOW_TYPE.MAIN ? fg.id : TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
                    }
                };
            }
        }
        // URLの数だけメニュー化＆本文置換
        contextMenu.urls = {
            name  : browser.i18n.getMessage('tweetUrls'),
            icon  : 'fa-link',
            items : {},
            visible : function() { return document.body.dataset.menuUrl == 'true'; }
        };
        {
            const $tweetText      = $tweetContent.find('.tweetText'),
                  $tweetThumbnail = $tweetContent.find('.tweetThumbnail'),
                  $templateImg    = $('#templateContainer .tweetThumbnailImage');
            let index = 0;

            for (let url of entities.urls) {
                index++;
                // 右クリックメニュー
                contextMenu.urls.items['url'+index] = {
                    name : url.display_url,
                    icon : 'fa-external-link',
                    callback : (key, opt) => { openURL(url.url); }
                };

                // URL置換先オブジェクト
                const $span = $('<span>').addClass('text-link').text(
                    TwitSideModule.config.getPref('exURL')
                        ? (TwitSideModule.config.getPref('exURL_cut')
                           ? url.display_url
                           : url.expanded_url)
                        : url.url)
                      .attr({
                          title          : url.expanded_url,
                          'data-fullurl' : url.url
                      })
                      .on('click', () => { openURL(url.url); });
                // URL置換
                UI.insertNodeIntoText($tweetText[0], url.url, $span[0]);
                // rawcontent置換
                $tweetBox.attr('data-rawcontent',
                               $tweetBox.attr('data-rawcontent').replace(url.url, url.expanded_url));
            }

            // pic.twitter
            const media = entities.media;
            if (media && media.length) {
                index++;
                // 右クリックメニュー
                contextMenu.urls.items['url'+index] = {
                    name : media[0].display_url,
                    icon : 'fa-external-link',
                    callback : (key, opt) => { openURL(media[0].url); }
                };

                // URL置換先オブジェクト
                const $span = $('<span>').addClass('text-link').text(
                    TwitSideModule.config.getPref('exURL')
                        ? (TwitSideModule.config.getPref('exURL_cut')
                           ? media[0].display_url
                           : media[0].expanded_url)
                        : media[0].url)
                      .attr({
                          title          : media[0].expanded_url,
                          'data-fullurl' : media[0].url
                      })
                      .on('click', () => { openURL(media[0].url); });
                // URL置換
                UI.insertNodeIntoText($tweetText[0], media[0].url, $span[0]);
                // rawcontent置換
                $tweetBox.attr('data-rawcontent',
                               $tweetBox.attr('data-rawcontent').replace(media[0].url, media[0].expanded_url));
            }

            // サムネイル
            for (let pic of record.meta.pics) {
                const $thumbimg = $templateImg.clone();
                $thumbimg.attr({
                    src            : pic.thumburl,
                    'data-fullurl' : pic.fullurl
                }).appendTo($tweetThumbnail);
            }

            if (!index) delete contextMenu.urls;
        }

        // Quote
        if (!parentTweetid) {
            // ツイートが引用している場合
            if (record.quoted) {
                // 引用ボックス作成
                const result = this._createTweetBox(type, record.quoted, columnid, record.raw.id_str);
                if (result)
                    $tweetInline.append(result);
            }
        }
        // コンテクストメニューを登録
        $tweetBox[0].contextMenuItems = contextMenu;

        return $tweetBox[0];
    },

    // リスト用
    _createListTweetBox : function(type, record, columnid) {
        const fullboxid = columnid+'_'+record.meta.boxid;

        // more
        if (/_more$/.test(fullboxid)) {
            return this.$tweetMoreBoxTemplate.clone()
                .attr({
                    id            : fullboxid,
                    'data-origid' : record.raw.id_str
                })[0];
        }

        const $tweetBox     = this.$tweetBoxTemplate.clone().attr('id', fullboxid),
              $tweetContent = $tweetBox.children('.tweetContent').eq(0),
              $tweetInline  = $tweetContent.children('.inlineTweetBox').eq(0),
              recordStatus  = record.raw;

        // 属性設定
        $tweetBox.attr({
            'data-tweetid'    : recordStatus.id_str,
            'data-screenname' : '@' + recordStatus.user.screen_name
        });
        // TODO
        $tweetContent.attr({
            'data-subscriber' : recordStatus.subscriber_count,
            'data-member'     : recordStatus.member_count,
            'data-mode'       : recordStatus.mode
        });
        if (record.meta.isMine) $tweetContent.attr('data-mine', 'true');

        // ユーザ情報
        $tweetContent.find('.tweetUserImage')
            .attr('src', recordStatus.user.profile_image_url_https);
        $tweetContent.find('.listName').attr({
            'data-listname'   : recordStatus.name
        });
        $tweetContent.find('.listOwnerName').attr({
            'data-screenname' : '@' + recordStatus.user.screen_name,
            'data-username'   : recordStatus.user.name
        });

        // 説明
        $tweetContent.find('.tweetText').text(recordStatus.description);

        /**
         * 基本メニュー
         */
        const contextMenu = {};

        if (record.meta.isMine) {
            // 削除
            contextMenu.destroy = {
                name : browser.i18n.getMessage('tweetDestroylist'),
                icon : 'fa-trash'
            };
            // 編集
            contextMenu.updatelist = {
                name : browser.i18n.getMessage('tweetUpdatelist'),
                icon : 'fa-pencil'
            };
        }
        // メンバー一覧
        contextMenu.showmembers = {
            name : browser.i18n.getMessage('tweetShowmembers'),
            icon : 'fa-users'
        };
        // 購読者一覧
        contextMenu.showsubscribers = {
            name : browser.i18n.getMessage('tweetShowsubscribers'),
            icon : 'fa-users'
        };
        // リストを購読
        if (record.meta.subscriptionable)
            contextMenu.subscribe = {
                name : browser.i18n.getMessage('tweetSubscribe'),
                icon : 'fa-plus-circle'
            };
        // リストの購読解除
        if (record.meta.unsubscriptionable)
            contextMenu.unsubscribe = {
                name : browser.i18n.getMessage('tweetUnsubscribe'),
                icon : 'fa-minus-circle'
            };
        // カラムに追加
        if (record.meta.registrable)
            contextMenu.addlist2column = {
                name : browser.i18n.getMessage('tweetAddcolumn'),
                icon : 'fa-plus'
            };
        // スクリーンネーム
        const sn = '@' + recordStatus.user.screen_name;
        contextMenu[sn] = {
            name : sn,
            icon : 'fa-at',
            callback : (key, opt) => {
                TwitSideModule.ManageWindows.openWindow('profile', {
                    userid  : this.getActiveColumn().attr('data-userid'),
                    keyword : sn
                }, this._win_type === TwitSideModule.WINDOW_TYPE.MAIN ? fg.id : TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
            }
        };

        // コンテクストメニューを登録
        $tweetBox[0].contextMenuItems = contextMenu;

        return $tweetBox[0];
    },

    // フォロー、フォロワー用
    _createFriendTweetBox : function(type, record, columnid) {
        const fullboxid = columnid+'_'+record.meta.boxid;

        // more
        if (/_more$/.test(fullboxid)) {
            return this.$tweetMoreBoxTemplate.clone()
                .attr({
                    id            : fullboxid,
                    'data-origid' : record.raw.id_str
                })[0];
        }

        const $tweetBox     = this.$tweetBoxTemplate.clone().attr('id', fullboxid),
              $tweetContent = $tweetBox.children('.tweetContent').eq(0),
              recordStatus  = record.raw;

        // 属性設定
        $tweetBox.attr({
            'data-tweetid'    : recordStatus.id_str,
            'data-screenname' : '@' + recordStatus.screen_name
        });

        // ユーザ情報
        $tweetContent.find('.tweetUserImage')
            .attr('src', recordStatus.profile_image_url_https);
        $tweetContent.find('.tweetUserName').attr({
            'data-screenname' : '@' + recordStatus.screen_name,
            'data-username'   : recordStatus.name
        });

        // protected
        if (recordStatus.protected)
            $tweetContent.attr('data-protected', 'true');
        // verified
        if (recordStatus.verified)
            $tweetContent.attr('data-verified', 'true');
        // 説明
        if (recordStatus.description)
            $tweetContent.find('.tweetText').text(recordStatus.description);

        return $tweetBox[0];
    },

    // ダイレクトメッセージ用
    _createDmTweetBox : function(type, record, columnid, inline) {
        const fullboxid = columnid+'_'+record.meta.boxid;

        // more
        if (/_more$/.test(fullboxid)) {
            return this.$tweetMoreBoxTemplate.clone()
                .attr({
                    id            : fullboxid,
                    'data-origid' : record.raw.id_str
                })[0];
        }

        const $tweetBox     = this.$tweetBoxTemplate.clone().attr('id', fullboxid),
              $tweetContent = $tweetBox.children('.tweetContent').eq(0),
              $tweetInline  = $tweetContent.children('.inlineTweetBox').eq(0),
              recordStatus  = record.raw;

        // 属性設定
        $tweetBox.attr({
            'data-tweetid'    : recordStatus.id_str,
            'data-rawcontent' : recordStatus.message_create.message_data.text,
            'data-screenname' : '@' + record.meta.sender.screen_name
        });
        $tweetContent.attr({
            'data-mine'  : record.meta.isMine || '',
            'data-forme' : record.meta.isForMe || ''
        });

        // ユーザ情報
        $tweetContent.find('.tweetUserImage')
            .attr('src', record.meta.sender.profile_image_url_https);
        $tweetContent.find('.tweetUserName').attr({
            'data-screenname' : '@' + record.meta.sender.screen_name,
            'data-username'   : record.meta.sender.name
        });
        $tweetContent.find('.tweetUserRecipient').attr({
            'data-screenname' : '@' + record.meta.recipient.screen_name,
            'data-username'   : record.meta.recipient.name,
            'data-userid'     : record.meta.recipient.id_str
        });

        // 本文
        $tweetContent.find('.tweetText')
            .text(TwitSideModule.text.unescapeHTML(recordStatus.message_create.message_data.text));
        // タイムスタンプ
        $tweetContent.find('.tweetTime')
            .text(TwitSideModule.text.convertTimeStamp(
                TwitSideModule.text.analyzeTimestamp(parseInt(recordStatus.created_timestamp)),
                TwitSideModule.config.getPref('time_locale'),
                TwitSideModule.text.createTimeformat()
            ));

        /**
         * 基本メニュー
         */
        const entities    = record.meta.entities,
              contextMenu = {};

        // 返信
        contextMenu.replydm = {
            name : browser.i18n.getMessage('tweetReply'),
            icon : 'fa-reply'
        };
        // ツイートテキスト
        contextMenu.showtext = {
            name : browser.i18n.getMessage('tweetShowtext'),
            icon : 'fa-clipboard'
        };
        // 削除
        contextMenu.destroy = {
            name : browser.i18n.getMessage('tweetDestroy'),
            icon : 'fa-trash'
        };
        // スクリーンネーム
        if (record.meta.screennames.length) {
            contextMenu.users = {
                name : browser.i18n.getMessage('tweetUsers'),
                icon : 'fa-users',
                items : {}
            };
            for (let sn of record.meta.screennames) {
                contextMenu.users.items[sn] = {
                    name : sn,
                    icon : 'fa-at',
                    callback : (key, opt) => {
                        TwitSideModule.ManageWindows.openWindow('profile', {
                            userid  : this.getActiveColumn().attr('data-userid'),
                            keyword : sn
                        }, this._win_type === TwitSideModule.WINDOW_TYPE.MAIN ? fg.id : TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
                    }
                };
            }
        }
        // URLの数だけメニュー化＆本文置換
        contextMenu.urls = {
            name  : browser.i18n.getMessage('tweetUrls'),
            icon  : 'fa-link',
            items : {},
            visible : function() { return document.body.dataset.menuUrl == 'true'; }
        };
        {
            const $tweetText      = $tweetContent.find('.tweetText'),
                  $tweetThumbnail = $tweetContent.find('.tweetThumbnail'),
                  $templateImg    = $('#templateContainer .tweetThumbnailImage');
            let index = 0;

            for (let url of entities.urls) {
                index++;
                // 右クリックメニュー
                contextMenu.urls.items['url'+index] = {
                    name : url.display_url,
                    icon : 'fa-external-link',
                    callback : (key, opt) => { openURL(url.url); }
                };

                // URL置換先オブジェクト
                const $span = $('<span>').addClass('text-link').text(
                    TwitSideModule.config.getPref('exURL')
                        ? (TwitSideModule.config.getPref('exURL_cut')
                           ? url.display_url
                           : url.expanded_url)
                        : url.url)
                    .attr({
                        title          : url.expanded_url,
                        'data-fullurl' : url.url
                    })
                    .on('click', () => { openURL(url.url); });
                // URL置換
                UI.insertNodeIntoText($tweetText[0], url.url, $span[0]);
                // rawcontent置換
                $tweetBox.attr('data-rawcontent',
                               $tweetBox.attr('data-rawcontent').replace(url.url, url.expanded_url));
            }

            // サムネイル
            for (let pic of record.meta.pics) {
                const $thumbimg = $templateImg.clone();
                $thumbimg.attr({
                    src            : pic.thumburl,
                    'data-fullurl' : pic.fullurl
                }).appendTo($tweetThumbnail);
            }

            if (!index) delete contextMenu.urls;
        }
        // コンテクストメニューを登録
        $tweetBox[0].contextMenuItems = contextMenu;

        return $tweetBox[0];
    },

    // mute, block, noretweet用
    _createUserListBox : function(type, record, columnid) {
        const fullboxid = columnid+'_'+record.meta.boxid;

        // more
        if (/_more$/.test(fullboxid)) {
            return this.$tweetMoreBoxTemplate.clone()
                .attr({
                    id            : fullboxid,
                    'data-origid' : record.raw.id_str
                })[0];
        }

        const $tweetBox     = this.$tweetBoxTemplate.clone().attr('id', fullboxid),
              $tweetContent = $tweetBox.children('.tweetContent').eq(0),
              recordStatus  = record.raw;

        // 属性設定
        $tweetBox.attr({
            'data-userid'     : recordStatus.id_str,
            'data-screenname' : '@' + recordStatus.screen_name
        });

        // ユーザ情報
        $tweetContent.find('.tweetUserImage')
            .attr('src', recordStatus.profile_image_url_https);
        $tweetContent.find('.tweetUserName').attr({
            'data-screenname' : '@' + recordStatus.screen_name,
            'data-username'   : recordStatus.name
        });

        /**
         * 基本メニュー
         */
        const entities    = record.meta.entities,
              contextMenu = {};

        // 削除
        contextMenu.destroyuser = {
            name    : browser.i18n.getMessage('tweetDestroyuser'),
            icon    : 'fa-user-times',
            visible : function() { return document.body.dataset.ownList == 'true'; }
        };
        // スクリーンネーム
        const sn = '@' + recordStatus.screen_name;
        contextMenu[sn] = {
            name : sn,
            icon : 'fa-at',
            callback : (key, opt) => {
                TwitSideModule.ManageWindows.openWindow('profile', {
                    userid  : UI.getActiveColumn().attr('data-userid'),
                    keyword : sn
                }, this._win_type === TwitSideModule.WINDOW_TYPE.MAIN ? fg.id : TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
            }
        };
        // コンテクストメニューを登録
        $tweetBox[0].contextMenuItems = contextMenu;

        return $tweetBox[0];
    },

    insertNodeIntoText : function(parentObj, replaceText, newNode) {
        // textNode全てから置換対象の文字列を検索
        const childNodes = parentObj.childNodes;
        let targetNode  = null,
            targetIndex = null;

        for (let child of childNodes) {
            if (child.nodeType === Node.TEXT_NODE
                && child.textContent.match(replaceText)) {
                targetNode  = child;
                targetIndex = child.textContent.search(replaceText);
                break;
            }
        }
        // 対象無し
        if (targetNode == null) return false;

        // textNodeを分割（対象文字列の前後）
        let oldNode = null;
        oldNode = targetNode.splitText(targetIndex);
        oldNode.splitText(replaceText.length);
        // 分割後textNodeとnewNodeを置換
        parentObj.replaceChild(newNode, oldNode);
        // 置換成功
        return true;
    },

    /**
     * ユーザ操作
     */
    updateTweetUsers : function() {
        // ユーザ情報取得
        const all_userinfo = TwitSideModule.ManageUsers.getUserInfo();

        // ユーザクリア
        $('#menuProfileSeparator').prevAll('.menuProfileItem').remove();

        // ユーザ追加
        for (let userid in all_userinfo) {
            const userinfo    = all_userinfo[userid],
                  $menuitem   = this.$menuItemTemplate.clone();

            // スクリーンネーム変更
            if (userinfo.screen_name)
                $menuitem.attr({
                    'data-screenname' : '@' + userinfo.screen_name,
                    'data-label'      : '@' + userinfo.screen_name
                });
            // プロフィール画像変更
            if (userinfo.profile_image_url)
                $menuitem.children('.menuImage').attr('src', userinfo.profile_image_url);
            // 左パネル
            $menuitem.attr('data-userid', userinfo.user_id).insertBefore($('#menuProfileSeparator'));
        }

        this.updateTweetUserSelection(this.$tweetUserSelection, this.$tweetUserTemplate, all_userinfo);
    },
    updateTweetUserSelection : function($tweetUserSelection, $tweetUserTemplate, all_userinfo) {
        $tweetUserSelection.find('option').remove();

        // ユーザ追加
        for (let userid in all_userinfo) {
            const userinfo    = all_userinfo[userid],
                  $useroption = $tweetUserTemplate.clone();

            // スクリーンネーム変更
            if (userinfo.screen_name)
                $useroption.text('@' + userinfo.screen_name);
            // プロフィール画像変更
            if (userinfo.profile_image_url)
                $useroption.attr('data-image', userinfo.profile_image_url);
            // メニューアイテム
            $useroption.val(userinfo.user_id).appendTo($tweetUserSelection);
        }
    },

    /**
     * カラム操作
     */
    // カラムを作成して末尾に追加
    _makeColumn : function(columnid, columninfo, index) {
        const $column    = this.$columnTemplate.clone(true),
              $columnTab = this.$columnTabTemplate.clone(),
              // タイムライン種別
              columntype = TwitSideModule.getTimelineName(columninfo.tl_type);

        $column.attr({
            id                 : columnid,
            'data-column-type' : columntype,
            'data-userid'      : columninfo.userid
        }).appendTo(this.$columnC);
        $columnTab.attr({
            id                 : columnid + '_tab',
            'data-column-type' : columntype,
            'data-userid'      : columninfo.userid
        }).appendTo(this.$columnTabC);

        // カラム設定
        this._changeColumnConf(columnid, columninfo);

        // 1カラム目
        if ($column.index() == 0) {
            // アクティブカラム
            this.$activeColumn = this.$columnC.children('.column').first();
            // スクリーンネーム
            changeTweetUser();
        }

        // メインウィンドウのみ
        if (this._win_type === TwitSideModule.WINDOW_TYPE.MAIN) {
            calcColumns();
            colorColumnTab();

            (async () => {
                const tl = TwitSideModule.ManageColumns.getTimelineInfo($column.index(), 'timeline');

                // TL読み込み中
                if (tl.loadingState === TwitSideModule.TL_STATE.STARTING) {
                    await (new Promise((resolve, reject) => {
                        let i = 0;
                        const interval = setInterval(() => {
                            if (tl.loadingState !== TwitSideModule.TL_STATE.STARTING) {
                                clearInterval(interval);
                                resolve();
                            }
                            i++;
                            if (i == 10) {
                                clearInterval(interval);
                                reject();
                            }
                        }, LOADWAIT);
                    }));
                }
                // 読み込み停止中にツイート取得
                this._showTweets(columninfo.tl_type,
                                 columnid,
                                 tl.allTweets,
                                 null, null);
            })();
        }
    },

    // カラムの設定変更
    _changeColumnConf : function(columnid, columninfo) {
        const $column    = $('#'+columnid),
              $columnTab = $('#'+columnid+'_tab');

        // カラムラベル変更
        $columnTab.text(columninfo.columnlabel);

        // 新しいリストボタン表示
        if (columninfo.tl_type === TwitSideModule.TL_TYPE.TEMP_OWNERSHIPLISTS
            && columninfo.userid == columninfo.options.userid)
            $column.find('.newListButton').css('display', '');

        // プライバシーモード
        $column.attr('data-veil', columninfo.options.veil ? 'true' : 'false');
    },

    // カラムの削除
    _deleteColumn : function(columnid, old_index) {
        // 削除するカラムが現在アクティブ
        if (old_index == this.$activeColumn.index())
            this.$activeColumn.next().length
            ? this.$activeColumn = this.$activeColumn.next()
            : this.$activeColumn = this.$activeColumn.prev();
        // DOMから削除
        $('#'+columnid).remove();
        $('#'+columnid+'_tab').remove();

        // メインウィンドウのみ
        if (this._win_type === TwitSideModule.WINDOW_TYPE.MAIN) {
            calcColumns();
            colorColumnTab();
        }
    },

    // カラムの順番変更
    _sortColumn : function(old_index, new_index) {
        const $column    = this.$columnC.children().eq(old_index),
              $columnTab = this.$columnTabC.children().eq(old_index);

        if (!$column[0]) return;

        // 後ろへ
        if (old_index < new_index) {
            this.$columnC.children().eq(new_index).after($column);
            this.$columnTabC.children().eq(new_index).after($columnTab);
        }
        // 前へ
        else {
            this.$columnC.children().eq(new_index).before($column);
            this.$columnTabC.children().eq(new_index).before($columnTab);
        }

        // メインウィンドウのみ
        if (this._win_type === TwitSideModule.WINDOW_TYPE.MAIN) {
            colorColumnTab();
        }
    },

    /**
     * 全体
     */
    // スタイルシート設定
    setStyleSheets : function() {
        const config = TwitSideModule.config.getPref();

        // style settings
        // テーマ
        document.body.dataset.theme            = config['theme'];
        document.body.dataset.colorRetweets    = config['color_retweets'];
        // 画像
        document.body.dataset.viewthumbnail    = config['viewthumbnail'];
        // スクリーンネーム
        document.body.dataset.screennameFirst  = config['screenname_first'];
        // ソース
        document.body.dataset.viewsource       = config['viewsource'];
        // 改行
        document.body.dataset.linefeed         = config['linefeed'];
        // アニメーション
        document.body.dataset.animation        = config['animation'];
        jQuery.fx.off                          = ! config['animation'];

        // scale settings
        // フォント
        $('body').css('font-size', config['font_size']);
        // アイコンサイズ
        document.body.dataset.iconSize         = config['icon_size'];
        document.body.dataset.buttonSize       = config['button_size'];
        // サークルアイコン
        document.body.dataset.circleIcon       = config['circle_icon'];

        // tweetmenu settings
        // 右クリックメニュー
        document.body.dataset.menuReply        = config['menu_reply'];
        document.body.dataset.menuFavorite     = config['menu_favorite'];
        document.body.dataset.menuConversation = config['menu_conversation'];
        document.body.dataset.menuUrl          = config['menu_url'];
        // ツイートメニュー
        this.setTweetMenuFunc(0, config['hover_menu0']);
        this.setTweetMenuFunc(1, config['hover_menu1']);
        this.setTweetMenuFunc(2, config['hover_menu2']);
        this.setTweetMenuFunc(3, config['hover_menu3']);
    },

    // アクティブカラムを設定
    setActiveColumn : function($column, fromBox) {
        if (TwitSideModule.config.getPref('auto_user_selection'))
            changeTweetUser($column.attr('data-userid'));

        if (this.$activeColumn[0] === $column[0]) return;

        // setActiveBoxから
        if (fromBox) {
            this.$activeColumn = $column;
            // メインウィンドウのみ
            if (this._win_type === TwitSideModule.WINDOW_TYPE.MAIN)
                scrollColumns($column.index());
        }
        else {
            const $activeBox = this.getActiveBox($column);
            // アクティブボックスがあるときはフォーカス
            $activeBox[0]
                ? this.setActiveBox($activeBox)
                : this.setActiveColumn($column, true);
        }
    },

    getActiveColumn : function() {
        return this.$activeColumn;
    },

    // アクティブボックス＋カラムを設定
    setActiveBox : function($tweetBox) {
        if ($tweetBox[0] === document.activeElement) {
            const $column = $tweetBox.closest('.column');

            // 一番上の時はactiveBoxを持たない
            if ($tweetBox.index() == 0) {
                $column[0].$activeBox = null;
                // 余白を詰める
                if ($column.find('.timelineBox').scrollTop() <= parseInt($tweetBox.css('margin-top')))
                    $column.find('.timelineBox').scrollTop(0);
            }
            else
                $column[0].$activeBox = $tweetBox;

            // アクティブカラムも変更
            this.setActiveColumn($column, true);
        }
        else {
            $tweetBox.focus();
        }
    },

    getActiveBox : function($column) {
        if ($column == null) $column = this.$activeColumn;

        // activeBoxがnullなら一番上
        return $column[0].$activeBox == null
            ? $column.find('.tweetBox:first')
            : $column[0].$activeBox;
    },

    // ツイートボタンの機能を取得
    getTweetMenuFunc : function(column_type, menuindex_int) {
        if (column_type == 'directmessage')
            return this.tweetMenuFuncList.replydm;

        else {
            const command = $(document.body).attr('data-tweet-menu-button'+menuindex_int);
            if (command)
                return this.tweetMenuFuncList[command];
            else
                return () => {};
        }
    },

    // ボタンと関数の紐付け、設定に保存
    setTweetMenuFunc : function(menuindex_int, command_str) {
        // コマンドを割り当てない
        if (command_str == null
            || !this.tweetMenuFuncList[command_str])
            $(document.body).attr('data-tweet-menu-button'+menuindex_int, '');
        // コマンドを割り当て
        else
            $(document.body).attr('data-tweet-menu-button'+menuindex_int, command_str);
    },

    // メッセージ
    showMessage : function(message, text_flag) {
        if (message == null) return;
        // transMessageの返値
        if (Array.isArray(message)) [message, text_flag] = message;

        const $messageC = $('#messageContainer');

        $messageC.text('');
        text_flag
            ? $messageC.text(message)
            : $messageC.html(message);

        // 表示
        $messageC.removeClass('hidden').addClass('visible')
            .delay(5000).queue(function() {
                $(this).removeClass('visible').addClass('hidden').dequeue();
            });
    }
};


/**
 * 全体
 */
// localization content ui
const localization = () => {
    for (let datum of l10nDefinition) {
        if (datum.selector == 'title') {
            document.title = browser.i18n.getMessage(datum.word);
            continue;
        }

        switch (datum.place) {
        case "text":
            $(datum.selector).text(browser.i18n.getMessage(datum.word));
            break;
        case "html":
            $(datum.selector).html(browser.i18n.getMessage(datum.word));
            break;
        case "attr":
            $(datum.selector).attr(datum.attr, browser.i18n.getMessage(datum.word));
            break;
        }
    }
};

// add click or press Enter key event listener
const buttonize = (buttonItems, commandExec) => {
    // common buttons
    $(document).on('click keypress', buttonItems.join(','), function(e) {
        // click or on press Enter
        if (e.type == 'keypress'
            && !(e.originalEvent.key == 'Enter'
                 || e.originalEvent.key == ' ')) return;
        // stop if disabled
        if (this.dataset.disabled == "true") return;

        commandExec(this);
    });
};

// プログレスバー
const showProgressbar = (progress) => {
    // debug message
    TwitSideModule.debug.log('progress: ' + progress);

    const $bar = $('#progressBar');

    if ($bar.attr('data-progress') > progress)
        $bar.stop(true, true).css('width', 0);
    $bar.attr('data-progress', progress).css('display', '');

    if (progress >= 100) {
        $bar.stop(true, false).animate(
            { width : '100%' },
            200, 'swing', function() {
                $(this).delay(400).fadeOut(400).queue(function() {
                    $(this).attr('data-progress', 0).css({
                        width   : 0,
                        display : 'none'
                    }).dequeue();
                });
            });
    }
    else {
        $bar.stop(true, false).animate(
            { width : progress + '%' },
            200, 'swing'
        );
    }
};

// ローディング
const showLoadingProgressbar = (sw, columnid) => {
    if (sw) {
        columnid
            ? $('#'+columnid).find('.progressBarColumn').attr('data-loading', 'true')
            : $('#progressBarOther').attr('data-loading', 'true'); // 全体のバー
    }
    else {
        columnid
            ? $('#'+columnid).find('.progressBarColumn').attr('data-loading', 'false')
            : $('#progressBarOther').attr('data-loading', 'false'); // 全体のバー
    }
};


/**
 * タイムライン操作
 */
// ツイートが含まれるカラムインデックスを取得
const getColumnIndexFromBox = (obj) => {
    return $(obj).closest(UI.$columnC.children('.column')).index();
};

// タイムライン更新ボタン
const loadNewer = (columnindex) => {
    TwitSideModule.ManageColumns.getTimelineInfo(
        columnindex,
        'timeline',
        UI._win_type
    ).getNewer();
};

// タイムライン途中ツイート読み込み
const loadMore = (morebox) => {
    if (!/_more$/.test(morebox.id)) return;
    // 重複読み込み防止
    if (!$(morebox).closest('.column').attr('data-more') == '') return;

    $(morebox).closest('.column').attr('data-more', 'true');
    TwitSideModule.ManageColumns.getTimelineInfo(
        getColumnIndexFromBox(morebox),
        'timeline',
        UI._win_type
    ).getMore(morebox.dataset.origid);
};

// タイムライン過去ツイート読み込み
const loadOlder = (columnindex) => {
    TwitSideModule.ManageColumns.getTimelineInfo(
        columnindex,
        'timeline',
        UI._win_type
    ).getOlder();
};

// タイムライン最上部・最下部移動
const timelineMove = (dir_str) => {
    if (dir_str == 'top') {
        UI.getActiveColumn().children('.timelineBox').scrollTop(0)
            .children().first().focus();
    }
    else if (dir_str == 'bottom')
        UI.getActiveColumn().children('.timelineBox').children().last().focus();
};

// キーボードイベント
const keyeventChangeFocus = (event) => {
    const key = event.key.toUpperCase();
    // debug message
    TwitSideModule.debug.log(key);

    // ctrl時は無視
    if (event.ctrlKey) return;

    switch (key) {
    case 'J':
        UI.getActiveBox().next().focus();
        break;
    case 'K':
        UI.getActiveBox().prev().focus();
        break;
    case 'H':
    case 'L':
        // メインウィンドウだけ対象
        if (UI._win_type !== TwitSideModule.WINDOW_TYPE.MAIN) return;
        // 連打禁止タイマー
        if (UI.$columnC[0].keyblockTimer) return;

        // 連打禁止
        UI.$columnC[0].keyblockTimer = setTimeout(function() {
            UI.$columnC[0].keyblockTimer = null;
        }, 200);
        // フォーカス横移動
        const $activeColumn = UI.getActiveColumn();
        if (key == 'H' && $activeColumn.prev()[0])
            $activeColumn.prev().focus();
        else if (key == 'L' && $activeColumn.next()[0])
            $activeColumn.next().focus();
        break;
    case 'G':
        event.shiftKey
            ? timelineMove('bottom')
            : timelineMove('top');
        break;
    }
};

/**
 * ツイートメニュー
 */
// 返信・引用ツイート表示
const showTweetRef = async (tweetBox, type, tweetinfo) => {
    const $replyUsersSelection = $('#replyUsersSelection').empty();
    // 操作を制限
    $(tweetBox).children('.tweetContent').eq(0).clone()
        .appendTo($('#refTweetBox').empty())
        .children().remove(':not(.tweetMainContent)');
    $('#refTweetContainer').attr('data-type', type);

    // 返信ユーザ
    if (type == 'reply' || type == 'replyall') {
        const $templateReplyUser = $('#templateContainer .replyUser');

        // ツイートしたユーザ
        if (!tweetinfo.raw.retweeted_status) {
            $templateReplyUser.clone()
                .attr('data-userid', tweetinfo.raw.user.id_str)
                .text('@'+tweetinfo.raw.user.screen_name)
                .appendTo($replyUsersSelection);
        }
        else {
            $templateReplyUser.clone()
                .attr('data-userid', tweetinfo.raw.retweeted_status.user.id_str)
                .text('@'+tweetinfo.raw.retweeted_status.user.screen_name)
                .appendTo($replyUsersSelection);
        }
        // メンション
        for (let mention of tweetinfo.meta.entities.user_mentions) {
            $templateReplyUser.clone()
                .attr('data-userid', mention.id_str)
                .text('@'+mention.screen_name)
                .appendTo($replyUsersSelection);
        }
        // リツイートしたユーザ
        if (tweetinfo.raw.retweeted_status) {
            $templateReplyUser.clone()
                .attr('data-userid', tweetinfo.raw.user.id_str)
                .text('@'+tweetinfo.raw.user.screen_name)
                .appendTo($replyUsersSelection);
        }
        if (type == 'reply') {
            $replyUsersSelection.children().first().nextAll()
                .attr('data-reply', 'false');
        }
    }

    countNewTweet();
    $('#newTweet').focus();
};

// 公式リツイート
const onClickRetweet = (tweetBox) => {
    // ツイート情報
    if (TwitSideModule.config.getPref('confirm_retweet')
        && !confirm(browser.i18n.getMessage('confirmRetweet')))
        return;

    TwitSideModule.ManageColumns.getTimelineInfo(
        getColumnIndexFromBox(tweetBox),
        'timeline',
        UI._win_type
    ).retweet(tweetBox.dataset.tweetid, tweetBox.dataset.parentid);
};

// [MAIN] コメントつきリツイート
const onClickQuote = async (tweetBox, tweetinfo, userid) => {
    const boxid = tweetBox.id.replace(/^[a-zA-Z]{5}_/, ''); // columnidを除去

    if (!tweetinfo) {
        const tl = TwitSideModule.ManageColumns.getTimelineInfo(
            getColumnIndexFromBox(tweetBox),
            'timeline',
            UI._win_type
        );
        tweetinfo = tl.tweetInfo(boxid).tweetinfo;
        userid = tl.userid;
    }

    if (UI._win_type === TwitSideModule.WINDOW_TYPE.MAIN) {
        // ツイート情報
        const origid     = tweetBox.dataset.origid,
              screenname = tweetBox.dataset.screenname,
              status     = 'https://twitter.com/' + screenname.replace(/^@/, '')
              + '/status/' + origid.replace(/^0+/, '');

        newTweetContainerToggle(true);
        if (userid) changeTweetUser(userid);
        $('#newTweet').attr({
            'data-attachment-url' : status,
            'data-reply-id'       : ''
        });

        // ファイル選択解除
        cancelAllFile();
        // 引用ツイート表示
        showTweetRef(tweetBox, 'inline', tweetinfo);
    }
    else
        await TwitSideModule.windows.sendMessage({
            reason    : TwitSideModule.UPDATE.RUN_FUNCTION,
            function  : TwitSideModule.FUNCTION_TYPE.QUOTE,
            tweetBox  : tweetBox,
            tweetinfo : tweetinfo,
            userid    : userid
        }, TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
};

// [MAIN] 非公式リツイート
const onClickRt = async (tweetBox, userid) => {
    if (UI._win_type === TwitSideModule.WINDOW_TYPE.MAIN) {
        // ツイート情報
        const screenname = tweetBox.dataset.screenname,
              content    = TwitSideModule.text.unescapeHTML(tweetBox.dataset.rawcontent)
              .replace(/\n/g, TwitSideModule.config.getPref('linefeed') ? '\n' : ' ');

        // 入力ボックス
        const $newTweet = $('#newTweet');
        newTweetContainerToggle(true);
        if (userid) changeTweetUser(userid);
        $newTweet.val(' RT ' + screenname + ': ' + content);
        countNewTweet();
        $newTweet.focus();
        $newTweet[0].setSelectionRange(0, 0);
    }
    else {
        const tl = TwitSideModule.ManageColumns.getTimelineInfo(
            getColumnIndexFromBox(tweetBox),
            'timeline',
            UI._win_type
        );

        await TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.RUN_FUNCTION,
            function : TwitSideModule.FUNCTION_TYPE.RT,
            tweetBox : tweetBox,
            userid   : tl.userid
        }, TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
    }
};

// ツイートテキスト
const onClickShowtext = (tweetBox) => {
    TwitSideModule.ManageWindows.openWindow('text', {
        text : tweetBox.dataset.rawcontent
    }, UI._win_type === TwitSideModule.WINDOW_TYPE.MAIN ? fg.id : TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
};

// ツイートのURLを開く
const onClickOpentweeturl = (tweetBox) => {
    // ツイート情報
    const origid     = tweetBox.dataset.origid,
          screenname = tweetBox.dataset.screenname,
          status     = 'https://twitter.com/' + screenname.replace(/^@/, '')
          + '/status/' + origid.replace(/^0+/, '');

    openURL(status);
};

// [MAIN] 返信
const onClickReply = async (tweetBox, tweetinfo, userid) => {
    const boxid = tweetBox.id.replace(/^[a-zA-Z]{5}_/, ''); // columnidを除去

    if (!tweetinfo) {
        const tl = TwitSideModule.ManageColumns.getTimelineInfo(
            getColumnIndexFromBox(tweetBox),
            'timeline',
            UI._win_type
        );
        tweetinfo = tl.tweetInfo(boxid).tweetinfo;
        userid = tl.userid;
    }

    if (UI._win_type === TwitSideModule.WINDOW_TYPE.MAIN) {
        const origid = tweetBox.dataset.origid;

        newTweetContainerToggle(true);
        if (userid) changeTweetUser(userid);
        $('#newTweet').attr({
            'data-attachment-url' : '',
            'data-reply-id'       : origid
        });

        showTweetRef(tweetBox, 'reply', tweetinfo);
    }
    else
        TwitSideModule.windows.sendMessage({
            reason    : TwitSideModule.UPDATE.RUN_FUNCTION,
            function  : TwitSideModule.FUNCTION_TYPE.REPLY,
            tweetBox  : tweetBox,
            tweetinfo : tweetinfo,
            userid    : userid
        }, TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
};

// [MAIN] 全員に返信
const onClickReplyall = (tweetBox, tweetinfo, userid) => {
    const boxid = tweetBox.id.replace(/^[a-zA-Z]{5}_/, ''); // columnidを除去

    if (!tweetinfo) {
        const tl = TwitSideModule.ManageColumns.getTimelineInfo(
            getColumnIndexFromBox(tweetBox),
            'timeline',
            UI._win_type
        );
        tweetinfo = tl.tweetInfo(boxid).tweetinfo;
        userid = tl.userid;
    }

    if (UI._win_type === TwitSideModule.WINDOW_TYPE.MAIN) {
        const origid = tweetBox.dataset.origid;

        newTweetContainerToggle(true);
        if (userid) changeTweetUser(userid);
        $('#newTweet').attr({
            'data-attachment-url' : '',
            'data-reply-id'       : origid
        });

        // 返信ツイート表示
        showTweetRef(tweetBox, 'replyall', tweetinfo);
    }
    else {
        TwitSideModule.windows.sendMessage({
            reason    : TwitSideModule.UPDATE.RUN_FUNCTION,
            function  : TwitSideModule.FUNCTION_TYPE.REPLYALL,
            tweetBox  : tweetBox,
            tweetinfo : tweetinfo,
            userid    : userid,
        }, TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
    }
};

// お気に入りへ追加
const onClickFavorite = (tweetBox) => {
    // ツイート情報
    const tweetid = tweetBox.dataset.origid,
          state   = $(tweetBox).children('.tweetContent').attr('data-favorited') == 'true';
    if (state && TwitSideModule.config.getPref('confirm_favorite')
        && !confirm(browser.i18n.getMessage('confirmRemoveFavorite')))
        return;


    if (!state && TwitSideModule.config.getPref('confirm_favorite')
        && !confirm(browser.i18n.getMessage('confirmAddFavorite')))
        return;

    TwitSideModule.ManageColumns.getTimelineInfo(
        getColumnIndexFromBox(tweetBox),
        'timeline',
        UI._win_type
    ).favorite(tweetBox.dataset.tweetid, !state, tweetBox.dataset.parentid);
};

// 会話を表示
const onClickShowreply = (tweetBox) => {
    const $replyBox = $(tweetBox).find('.replyTweetBox').last();

    // 既に読み込まれているときは何もしない
    if ($replyBox.attr('data-reply-open') == 'true') return;

    // 会話を全て閉じるボタン
    $(tweetBox).closest('.timelineBox').siblings('.clearRepliesBox').attr('data-replies-open', 'true');

    TwitSideModule.ManageColumns.getTimelineInfo(
        getColumnIndexFromBox(tweetBox),
        'timeline',
        UI._win_type
    ).replies(tweetBox.id.replace(/^[a-zA-Z]{5}_/, '')); // columnidを除去

    $replyBox.attr('data-reply-open', 'true');
};

// 会話を消す
const clearReplies = (button) => {
    const $replyBox = $(button).closest('.replyTweetBox');
    $replyBox.attr('data-reply-open', 'false').children('.replies').empty();

    // 会話を全て閉じるボタン
    if (!$replyBox.closest('.timelineBox').find('.replyTweetBox[data-reply-open="true"]').length)
        $replyBox.closest('.timelineBox').siblings('.clearRepliesBox').attr('data-replies-open', 'false');
};

// 会話を全て消す
const clearAllReplies = (button) => {
    const $replyBox = $(button).siblings('.timelineBox').find('.replyTweetBox[data-reply-open="true"]');
    $replyBox.attr('data-reply-open', 'false').children('.replies').empty();

    // 会話を全て閉じるボタン
    button.dataset.repliesOpen = false;
};

// 削除
const onClickDestroy = (tweetBox) => {
    const message = (() => {
        switch ($(tweetBox).closest('.column').attr('data-column-type')) {
        case 'directmessage':
            return browser.i18n.getMessage('confirmRemoveMessage');
        case 'ownershiplists':
        case 'subscriptionlists':
        case 'membershiplists':
            return browser.i18n.getMessage('confirmRemoveList');
        default:
            return browser.i18n.getMessage('confirmRemoveTweet');
        }
    })();

    if (TwitSideModule.config.getPref('confirm_delete')
        && !confirm(message))
        return;

    TwitSideModule.ManageColumns.getTimelineInfo(
        getColumnIndexFromBox(tweetBox),
        'timeline',
        UI._win_type
    ).destroy(tweetBox.dataset.tweetid, tweetBox.dataset.parentid);
};

// ユーザ削除（ミュート、リツイート非表示）
const onClickDestroyUser = (tweetBox) => {
    if (TwitSideModule.config.getPref('confirm_delete')
        && !confirm(browser.i18n.getMessage('confirmRemoveUser')))
        return;

    TwitSideModule.ManageColumns.getTimelineInfo(
        getColumnIndexFromBox(tweetBox),
        'timeline',
        UI._win_type
    ).destroy(tweetBox.dataset.tweetid);
};

// リツイートしたユーザを表示
const onClickShowretweetedusers = (tweetBox) => {
    TwitSideModule.ManageColumns.getTimelineInfo(
        getColumnIndexFromBox(tweetBox),
        'timeline',
        UI._win_type
    ).retweeters(tweetBox.dataset.tweetid, tweetBox.dataset.parentid);
};

// リツイートしたユーザのプロフィールを表示
const onClickRetweeterImage = (image) => {
    const userinfo = TwitSideModule.ManageUsers.getUserInfo(UI.getActiveColumn().attr('data-userid'));
    TwitSideModule.ManageWindows.openWindow('profile', {
        userid  : userinfo.user_id,
        keyword : image.title
    }, UI._win_type === TwitSideModule.WINDOW_TYPE.MAIN ? fg.id : TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
};

// 画像ポップアップ表示
const showPhotos = (e) => {
    const imagebox = e.target;

    // photoウィンドウ
    if (TwitSideModule.config.getPref('popup_photo')) {
        const tweetBox = $(imagebox).closest('.tweetBox')[0];

        TwitSideModule.ManageWindows.openWindow('photo', {
            boxid       : tweetBox.id.replace(/^[a-zA-Z]{5}_/, ''), // columnidを除去
            columnindex : getColumnIndexFromBox(tweetBox),
            win_type    : UI._win_type,
            index       : $(imagebox).index()
        }, UI._win_type === TwitSideModule.WINDOW_TYPE.MAIN ? fg.id : TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
    }
    else
        openURL(imagebox.dataset.fullurl);
};

// DMへ返信
const onClickReplydm = (tweetBox) => {
    // ツイート情報
    const sender      = $(tweetBox).find('.tweetUserName').attr('data-screenname'),
          recipient   = $(tweetBox).find('.tweetUserRecipient').attr('data-screenname'),
          recipientid = $(tweetBox).find('.tweetUserRecipient').attr('data-userid'),
          ownid       = $(tweetBox).closest('.column').attr('data-userid');

        TwitSideModule.ManageWindows.openWindow('newdm', {
            userid    : ownid,
            recipient : ownid == recipientid ? sender : recipient
        }, UI._win_type === TwitSideModule.WINDOW_TYPE.MAIN ? fg.id : TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
};

// [MAIN] URLを開く
const openURL = (url) => {
    if (UI._win_type === TwitSideModule.WINDOW_TYPE.MAIN) {
        return browser.tabs.create({
            url      : url,
            active   : TwitSideModule.config.getPref('URL_tabactive'),
            windowId : fg.id
        });
    }
    else
        return TwitSideModule.browsers.openURL(url, SUFFIX);
};


/**
 * サジェスト
 */
// サジェスト作成
const suggestScreenname = (textarea, suggestContainer) => {
    const $newTweet = $(textarea),
          $suggest  = $(suggestContainer),
          re        = new RegExp('(@[a-zA-Z0-9_]*)$', 'i');

    // 遅延
    if ($suggest[0].timer) clearTimeout($suggest[0].timer);

    $suggest[0].timer = setTimeout(() => {
        $suggest.empty();
        // カーソル位置取得
        const caret   = $newTweet[0].selectionStart,
              // カーソル位置より前の文字列取得
              objtext = $newTweet.val().slice(0, caret);

        // 抜き出したワードが@から始まる時サジェストを発動
        if (re.test(objtext)) {
            const matched = RegExp.$1;

            const filtered = TwitSideModule.Friends.latestfriends.filter(
                (element, index, array) => {
                    const re = new RegExp(matched, 'i');
                    return (re.test(element));
                });
            if (filtered.length) {
                for (let sn of filtered)
                    $('<option />').val(matched).text(sn).appendTo($suggest);

                $suggest.show(0);
                $suggest[0].selectedIndex = 0;
            }
            else hideSuggest(suggestContainer);
        }
        else hideSuggest(suggestContainer);
    }, 200);
};

// サジェスト選択
const suggestOnSelect = (e, textarea, suggestContainer, focus, callback) => {
    if (e) e = e.originalEvent;

    const $newTweet = $(textarea),
          $suggest  = $(suggestContainer);

    if (e) {
        switch (true) {
        case e.shiftKey && e.key == 'Tab':
        case e.key == 'ArrowUp':
            if ($suggest[0].selectedIndex == 0)
                $newTweet.focus();
            else if (e.key == 'Tab')
                $suggest[0].selectedIndex--;
            return;
        case e.key == 'Tab':
        case e.key == 'ArrowDown':
            if ($suggest[0].selectedIndex == $suggest.children().length - 1) {
                hideSuggest(suggestContainer);
                if (focus) $(focus).focus();
            }
            else if (e.key == 'Tab')
                $suggest[0].selectedIndex++;
            return;
        }
        if (e.key != 'Enter') return;
    }

    // サジェスト未選択でEnter押下時
    if ($suggest[0].selectedIndex == -1) {
        $newTweet.focus();
        return;
    }

    // カーソル位置取得
    const caret    = $newTweet[0].selectionStart,
          // カーソル位置より前の文字列取得
          original = $newTweet.val().slice(0, caret),
          // 抜き出したワードが@から始まる時サジェストを発動
          replaced = original.replace(
              new RegExp($suggest[0].selectedOptions[0].value + '$', 'm'),
              $suggest[0].selectedOptions[0].text
          );

    $newTweet.val($newTweet.val().replace(original, replaced) + ' ');
    $newTweet.focus();

    if (callback) callback();
};

// サジェスト非表示
const hideSuggest = (suggestContainer) => {
    $(suggestContainer).hide();
};

