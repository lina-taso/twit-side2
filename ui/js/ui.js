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
    $activeColumn : null,

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
        follow              : (obj) => { onClickFollowUser($(obj).closest('.tweetBox')[0]); },
        unmute              : (obj) => { onClickDestroyMuteUser($(obj).closest('.tweetBox')[0]); },
        block               : (obj) => { onClickBlockUser($(obj).closest('.tweetBox')[0]); },
        unblock             : (obj) => { onClickDestroyBlockUser($(obj).closest('.tweetBox')[0]); },
        wantretweet         : (obj) => { onClickDestroyNoretweetUser($(obj).closest('.tweetBox')[0]); },
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
            this.$tweetUserTemplate  = $('#templateContainer > .tweetUserOption');
            this.$menuItemTemplate   = $('#templateContainer > .menuProfileItem');
            this.$columnSpyTemplate  = $('#templateContainer > .columnSpy');
            // コンテナ
            this.$tweetUserSelection = $('#tweetUserSelection');
            this.$columnSpyC         = $('#columnSpyContainer');
            break;
        case TwitSideModule.WINDOW_TYPE.PROFILE:
        case TwitSideModule.WINDOW_TYPE.SEARCH:
            break;
        case TwitSideModule.WINDOW_TYPE.MUTE:
        case TwitSideModule.WINDOW_TYPE.BLOCK:
        case TwitSideModule.WINDOW_TYPE.NORETWEET:
            // テンプレート
            this.$tweetUserTemplate  = $('#templateContainer > .tweetUserOption');
            // コンテナ
            this.$tweetUserSelection = $('#tweetUserSelection');
            break;
        case TwitSideModule.WINDOW_TYPE.LISTMEMBER:
            break;
        }

        // 共通テンプレート
        this.$tweetBoxTemplate       = $('#templateContainer > .tweetBox');
        this.$tweetMoreBoxTemplate   = $('#templateContainer > .tweetMoreBox');
        this.$columnTemplate         = $('#templateContainer > .column');
        // 共通コンテナ
        this.$columnC                = $('#columnContainer');

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
                this.$columnC.scrollLeft(0);
                // ドロップダウンメニュー
                this.$tweetUserSelection
                    .on('input', function() {
                        $('#profileOwnImage').css('background-image', 'url(' + this.selectedOptions[0].dataset.image + ')');
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
                // カラムスパイ
                changeColumnSpy();
                // 通知取得
                updateNotifications();
            }
            break;

        case TwitSideModule.WINDOW_TYPE.MUTE:
        case TwitSideModule.WINDOW_TYPE.BLOCK:
        case TwitSideModule.WINDOW_TYPE.NORETWEET:
            {
                // ドロップダウンメニュー
                this.$tweetUserSelection
                    .on('input', function() {
                        $('#profileOwnImage').css('background-image', 'url(' + this.selectedOptions[0].dataset.image + ')');
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
                  timeline = $column.children('.timelineBox')[0];

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
                // メインウィンドウのみ
                if (UI._win_type === TwitSideModule.WINDOW_TYPE.MAIN)
                    UI.$columnSpyC.empty();
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
    _showTweets : async function(type, columnid, tweets, keep) {
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
        if ($replyBox.attr('data-open') != 'true') return;

        // リプライは機能制限
        const $reply = $(this._createTweetBox(
            type, datum.tweetinfo, columnid, null
        ));
        $reply.appendTo('<li class="list-group-item" />').children('.tweetContent').children().remove(':not(.tweetMainContent)');
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
        $column[0].$activeBox = undefined;
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
            const r = record.raw.retweeted_status
                  ? record.raw.retweeted_status
                  : record.raw;

            // ツイートの情報
            $tweetBox.attr({
                'data-origid'     : r.id_str,
                'data-rawcontent' : record.meta.text,
                'data-screenname' : '@' + r.user.screen_name
            });
            // ユーザ情報
            $tweetContent.find('.tweetUserImage')
                .attr('src', r.user.profile_image_url_https.replace('_normal.', '_bigger.'));
            $tweetContent.find('.tweetUserName').attr({
                'data-screenname' : '@' + r.user.screen_name,
                'data-username'   : r.user.name
            });
            // place
            if (r.geo && r.place) {
                const $place = $tweetContent.find('.tweetStatusPlace'),
                      ll     = r.geo.coordinates.join(',');
                $place.attr({
                    'title'       : r.place.full_name,
                    'data-mapurl' : 'http://maps.google.com/?q=' + ll
                }).on('click', () => { openURL('http://maps.google.com/?q=' + ll); });
            }
            else if (r.place) {
                let $place = $tweetContent.find('.tweetStatusPlace');
                $place.attr({
                    'title'       : r.place.full_name,
                    'data-mapurl' : 'http://maps.google.com/?q=' + r.place.full_name
                }).on('click', () => { openURL('http://maps.google.com/?q=' + r.place.full_name); });
            }
            // protected
            if (r.user.protected)
                $tweetContent.attr('data-protected', 'true');
            // verified
            if (r.user.verified)
                $tweetContent.attr('data-verified', 'true');
            // replyto, 本文
            if (record.meta.display_text_range[0]) {
                $tweetContent.find('.tweetUserReplyto')
                    .text(record.meta.text.slice(0, record.meta.display_text_range[0]));
                $tweetContent.find('.tweetText')
                    .text(TwitSideModule.text.unescapeHTML(
                        record.meta.text.slice(record.meta.display_text_range[0])));
            }
            else {
                $tweetContent.find('.tweetText')
                    .text(TwitSideModule.text.unescapeHTML(record.meta.text));
            }
            // 投稿ソース
            $tweetContent.find('.tweetSource')
                .text('from ' + analyzeSource(r.source));
            // タイムスタンプ
            $tweetContent.find('.tweetTime')
                .text(TwitSideModule.text.convertTimeStamp(
                    TwitSideModule.text.analyzeTimestamp(r.created_at),
                    TwitSideModule.config.getPref('time_locale'),
                    TwitSideModule.text.createTimeformat()
                ));
            // metrics
            $tweetContent.find('.tweetMenuButton[data-func=retweet] > span.count')
                .text(TwitSideModule.text.formatSIprefix(r.retweet_count))
                .attr('title', r.retweet_count);
            $tweetContent.find('.tweetMenuButton[data-func=favorite] > span.count')
                .text(TwitSideModule.text.formatSIprefix(r.favorite_count))
                .attr('title', r.favorite_count);
        }

        /**
         * リツイートされたツイートのみ
         */
        if (record.raw.retweeted_status) {
            $tweetContent.attr('data-retweet', 'true');

            $tweetContent.find('.tweetRetweeter').removeClass('d-none');
            $tweetContent.find('.tweetRetweeterImage')
                .attr({ src   : record.raw.user.profile_image_url_https,
                        title : '@' + record.raw.user.screen_name });
            $tweetContent.find('.tweetRetweeterName')
                .attr({
                    'data-screenname' : '@' + record.raw.user.screen_name,
                    'data-username'   : record.raw.user.name
                });
        }

        /**
         * 基本メニュー
         */
        const entities    = record.meta.entities,
              contextMenu = {};

        // 返信
        contextMenu.reply = {
            name    : browser.i18n.getMessage('tweetReply'),
            icon    : 'fas fa-reply fa-fw',
            visible : function() { return document.body.dataset.menuReply == 'true'; }
        };
        // 全員に返信
        $tweetBox.attr('data-screennames', record.meta.screennames.join(' '));
        if (record.meta.screennames.length > 1)
            contextMenu.replyall = {
                name    : browser.i18n.getMessage('tweetReplyall'),
                icon    : 'fas fa-reply-all fa-fw',
                visible : function() { return document.body.dataset.menuReply == 'true'; }
            };
        // 公式RT
        {
            // リツイート済
            if (record.retweeted) {
                contextMenu.retweet = {
                    name : browser.i18n.getMessage('tweetUndoRetweet'),
                    icon : 'fas fa-retweet fa-fw'
                };
            }
            // 通常のツイート
            else {
                contextMenu.retweet = {
                    name : browser.i18n.getMessage('tweetRetweet'),
                    icon : 'fas fa-retweet fa-fw'
                };
            }
            // protected
            if (!record.raw.retweeted_status && record.raw.user.protected) {
                contextMenu.retweet.disabled = true;
            }
        };
        // 引用リツイート
        contextMenu.quote = {
            name : browser.i18n.getMessage('tweetQuote'),
            icon : 'fas fa-quote-right fa-fw'
        };
        // 引用してRT
        contextMenu.rt = {
            name : browser.i18n.getMessage('tweetRt'),
            icon : 'fas fa-angle-double-right fa-fw'
        };
        // お気に入り
        if (record.raw.favorited) {
            $tweetContent.attr('data-favorited', 'true');
            // お気に入り解除
            contextMenu.favorite = {
                name    : browser.i18n.getMessage('tweetUnfavorite'),
                icon    : 'far fa-heart fa-fw',
                visible : function() { return document.body.dataset.menuFavorite == 'true'; }
            };
        }
        else {
            // お気に入り追加
            contextMenu.favorite = {
                name    : browser.i18n.getMessage('tweetFavorite'),
                icon    : 'fas fa-heart fa-fw',
                visible : function() { return document.body.dataset.menuFavorite == 'true'; }
            };
        }
        // ツイートテキスト
        contextMenu.showtext = {
            name : browser.i18n.getMessage('tweetShowtext'),
            icon : 'fas fa-clipboard fa-fw'
        };
        // ツイートを開く
        contextMenu.opentweeturl = {
            name : browser.i18n.getMessage('tweetOpentweeturl'),
            icon : 'fas fa-external-link-alt fa-fw'
        };
        // TODO Need Improvement
        // 会話
        if (!/_reply_/.test(fullboxid) && record.raw.retweeted_status
            ? record.raw.retweeted_status.in_reply_to_status_id_str
            : record.raw.in_reply_to_status_id_str) {

            $tweetContent.attr('data-inreply', 'true');
            contextMenu.showreply = {
                name    : browser.i18n.getMessage('tweetShowreply'),
                icon    : 'fas fa-comments fa-fw',
                visible : function() { return document.body.dataset.menuConversation == 'true'; }
            };
        }
        // 削除
        if (record.meta.isMine)
            contextMenu.destroy = {
                name : browser.i18n.getMessage('tweetDestroy'),
                icon : 'fas fa-trash fa-fw'
            };
        // リツイートされたツイート
        if (record.raw.retweet_count)
            contextMenu.showretweetedusers = {
                name : browser.i18n.getMessage('tweetShowretweetedusers'),
                icon : 'fas fa-users fa-fw'
            };
        // 既にメタデータ取得済み
        // TODO リツイートされた人は別窓へ
        if (record.meta.retweeters) {
            let $tweetRetweeterList = $tweetContent.find('.tweetRetweeterList'),
                $imageTemplate      = $tweetContent.find('.tweetRetweeterImage').clone().attr('src', '').addClass('my-1');

            for (let rt of record.meta.retweeters)
                $imageTemplate.clone().attr(rt).appendTo($tweetRetweeterList);
        }
        // スクリーンネーム
        if (record.meta.screennames.length) {
            contextMenu.users = {
                name  : browser.i18n.getMessage('tweetUsers'),
                icon  : 'fas fa-user-circle fa-fw',
                items : {}
            };
            for (let sn of record.meta.screennames) {
                contextMenu.users.items[sn] = {
                    name : sn,
                    icon : 'fas fa-at fa-fw',
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
                icon  : 'fas fa-tag fa-fw',
                items : {}
            };
            for (let ht of entities.hashtags) {
                contextMenu.hashtags.items['#'+ht.text] = {
                    name : '#'+ht.text,
                    icon : 'fas fa-hashtag fa-fw',
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
            icon  : 'fas fa-link fa-fw',
            items : {},
            visible : function() { return document.body.dataset.menuUrl == 'true'; }
        };
        {
            const $tweetText      = $tweetContent.find('.tweetText'),
                  $tweetThumbnail = $tweetContent.find('.tweetThumbnail'),
                  $templateImg    = $('#templateContainer > .tweetThumbnailImage');
            let index = 0;

            for (let url of entities.urls) {
                index++;
                // 右クリックメニュー
                contextMenu.urls.items['url'+index] = {
                    name : url.display_url,
                    icon : 'fas fa-external-link-alt fa-fw',
                    callback : (key, opt) => { openURL(url.url); }
                };

                // URL置換先オブジェクト
                const $span = $('<span class="text-link" />').text(
                    TwitSideModule.config.getPref('exURL')
                        ? (TwitSideModule.config.getPref('exURL_cut')
                           ? url.display_url : url.expanded_url)
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

            // pic.twitterのURL追加
            const media = entities.media;
            if (media && media.length) {
                index++;
                // 右クリックメニュー
                contextMenu.urls.items['url'+index] = {
                    name : media[0].display_url,
                    icon : 'fas fa-external-link fa-fw',
                    callback : (key, opt) => { openURL(media[0].url); }
                };

                // URL置換先オブジェクト
                const $span = $('<span class="text-link" />').text(
                    TwitSideModule.config.getPref('exURL')
                        ? (TwitSideModule.config.getPref('exURL_cut')
                           ? media[0].display_url : media[0].expanded_url)
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
            return this.$tweetMoreBoxTemplate.clone().attr({
                id            : fullboxid,
                'data-origid' : record.raw.id_str
            })[0];
        }

        const $tweetBox     = this.$tweetBoxTemplate.clone().attr('id', fullboxid),
              $tweetContent = $tweetBox.children('.tweetContent').eq(0),
              $tweetInline  = $tweetContent.children('.inlineTweetBox').eq(0),
              r             = record.raw;

        // 属性設定
        $tweetBox.attr({
            'data-tweetid'    : r.id_str,
            'data-screenname' : '@' + r.user.screen_name,
            'data-listname'   : r.name,
        });
        // TODO
        $tweetContent.attr({
            'data-subscriber' : r.subscriber_count,
            'data-member'     : r.member_count,
            'data-protected'  : r.mode == 'private'
        });
        if (record.meta.isMine) $tweetContent.attr('data-mine', 'true');

        // ユーザ情報
        $tweetContent.find('.tweetUserImage')
            .attr('src', r.user.profile_image_url_https.replace('_normal.', '_bigger.'));
        $tweetContent.find('.listName').text(r.name);
        $tweetContent.find('.listOwnerName').attr({
            'data-screenname' : '@' + r.user.screen_name,
            'data-username'   : r.user.name
        });

        // 説明
        $tweetContent.find('.tweetText').text(r.description);

        /**
         * 基本メニュー
         */
        const contextMenu = {};

        if (record.meta.isMine) {
            // 削除
            contextMenu.destroy = {
                name : browser.i18n.getMessage('tweetDestroylist'),
                icon : 'fas fa-trash fa-fw'
            };
            // 編集
            contextMenu.updatelist = {
                name : browser.i18n.getMessage('tweetUpdatelist'),
                icon : 'fas fa-edit fa-fw'
            };
        }
        // メンバー一覧
        contextMenu.showmembers = {
            name : browser.i18n.getMessage('tweetShowmembers'),
            icon : 'fas fa-user-friends  fa-fw'
        };
        // 購読者一覧
        contextMenu.showsubscribers = {
            name : browser.i18n.getMessage('tweetShowsubscribers'),
            icon : 'fas fa-user-friends fa-fw'
        };
        // リストを購読
        if (record.meta.subscriptionable)
            contextMenu.subscribe = {
                name : browser.i18n.getMessage('tweetSubscribe'),
                icon : 'fas fa-plus-circle fa-fw'
            };
        // リストの購読解除
        if (record.meta.unsubscriptionable)
            contextMenu.unsubscribe = {
                name : browser.i18n.getMessage('tweetUnsubscribe'),
                icon : 'fas fa-minus-circle fa-fw'
            };
        // カラムに追加
        if (record.meta.registrable)
            contextMenu.addlist2column = {
                name : browser.i18n.getMessage('tweetAddcolumn'),
                icon : 'fas fa-expand-arrows-alt fa-fw'
            };
        // スクリーンネーム
        const sn = '@' + r.user.screen_name;
        contextMenu[sn] = {
            name : sn,
            icon : 'fas fa-at fa-fw',
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

    // ダイレクトメッセージ用
    _createDmTweetBox : function(type, record, columnid, inline) {
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
              $tweetInline  = $tweetContent.children('.inlineTweetBox').eq(0),
              r             = record.raw;

        // 属性設定
        $tweetBox.attr({
            'data-tweetid'    : r.id_str,
            'data-rawcontent' : r.message_create.message_data.text,
            'data-screenname' : '@' + record.meta.sender.screen_name
        });
        $tweetContent.attr({
            'data-mine'  : record.meta.isMine || '',
            'data-forme' : record.meta.isForMe || ''
        });

        // ユーザ情報
        $tweetContent.find('.tweetUserImage')
            .attr('src', record.meta.sender.profile_image_url_https.replace('_normal.', '_bigger.'));
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
            .text(TwitSideModule.text.unescapeHTML(r.message_create.message_data.text));
        // タイムスタンプ
        $tweetContent.find('.tweetTime')
            .text(TwitSideModule.text.convertTimeStamp(
                TwitSideModule.text.analyzeTimestamp(parseInt(r.created_timestamp)),
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
            icon : 'fas fa-reply fa-fw'
        };
        // ツイートテキスト
        contextMenu.showtext = {
            name : browser.i18n.getMessage('tweetShowtext'),
            icon : 'fas fa-clipboard fa-fw'
        };
        // 削除
        contextMenu.destroy = {
            name : browser.i18n.getMessage('tweetDestroy'),
            icon : 'fas fa-trash fa-fw'
        };
        // スクリーンネーム
        if (record.meta.screennames.length) {
            contextMenu.users = {
                name : browser.i18n.getMessage('tweetUsers'),
                icon : 'fas fa-user-circle fa-fw',
                items : {}
            };
            for (let sn of record.meta.screennames) {
                contextMenu.users.items[sn] = {
                    name : sn,
                    icon : 'fas fa-at fa-fw',
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
            icon  : 'fas fa-link fa-fw',
            items : {},
            visible : function() { return document.body.dataset.menuUrl == 'true'; }
        };
        {
            const $tweetText      = $tweetContent.find('.tweetText'),
                  $tweetThumbnail = $tweetContent.find('.tweetThumbnail'),
                  $templateImg    = $('#templateContainer > .tweetThumbnailImage');
            let index = 0;

            for (let url of entities.urls) {
                index++;
                // 右クリックメニュー
                contextMenu.urls.items['url'+index] = {
                    name : url.display_url,
                    icon : 'fas fa-external-link fa-fw',
                    callback : (key, opt) => { openURL(url.url); }
                };

                // URL置換先オブジェクト
                const $span = $('<span class="text-link" />').text(
                    TwitSideModule.config.getPref('exURL')
                        ? (TwitSideModule.config.getPref('exURL_cut')
                           ? url.display_url : url.expanded_url)
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

    // follow、follower, mute, block, noretweet用
    _createUserListBox : function(type, record, columnid) {
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
              r             = record.raw;

        // 属性設定
        $tweetBox.attr({
            'data-userid'     : r.id_str,
            'data-screenname' : '@' + r.screen_name
        });

        // ユーザ情報
        $tweetContent.find('.tweetUserImage')
            .attr('src', r.profile_image_url_https.replace('_normal.', '_bigger.'));
        $tweetContent.find('.tweetUserName').attr({
            'data-screenname' : '@' + r.screen_name,
            'data-username'   : r.name
        });

        // protected
        if (r.protected)
            $tweetContent.attr('data-protected', 'true');
        // verified
        if (r.verified)
            $tweetContent.attr('data-verified', 'true');
        // 説明
        if (r.description)
            $tweetContent.find('.tweetText').text(r.description);

        /**
         * 基本メニュー
         */
        const entities    = record.meta.entities,
              contextMenu = {};

        // 削除
        contextMenu.destroyuser = {
            name    : browser.i18n.getMessage('tweetDestroyuser'),
            icon    : 'fas fa-user-times fa-fw',
            visible : function() { return document.body.dataset.ownList == 'true'; }
        };
        // DM
        contextMenu.replydm = {
            name    : browser.i18n.getMessage('profileSenddm'),
            icon    : 'fas fa-reply fa-fw',
            visible : function() { return document.body.dataset.windowType == 'profile'; }
        };
        // follow
        if (record.raw.following) {
            $tweetContent.attr('data-following', 'true');
            // unfollow
            contextMenu.follow = {
                name    : browser.i18n.getMessage('tweetUnfollowuser'),
                icon    : 'fas fa-user-minus fa-fw',
                visible : function() { return document.body.dataset.windowType == 'profile'; }
            };
        }
        else {
            // follow
            contextMenu.follow = {
                name    : browser.i18n.getMessage('tweetFollowuser'),
                icon    : 'fas fa-user-plus fa-fw',
                visible : function() { return document.body.dataset.windowType == 'profile'; }
            };
        }
        // unmute
        contextMenu.unmute = {
            name    : browser.i18n.getMessage('tweetUnmuteuser'),
            icon    : 'fas fa-user-minus fa-fw',
            visible : function() { return document.body.dataset.windowType == 'mute'; }
        };
        // block
        contextMenu.block = {
            name    : browser.i18n.getMessage('tweetBlockuser'),
            icon    : 'fas fa-user-slash fa-fw',
            visible : function() { return document.body.dataset.windowType == 'profile'; }
        };
        // unblock
        contextMenu.unblock = {
            name    : browser.i18n.getMessage('tweetUnblockuser'),
            icon    : 'fas fa-user-minus fa-fw',
            visible : function() { return document.body.dataset.windowType == 'block'; }
        };
        // wantrewtweet
        contextMenu.wantretweet = {
            name    : browser.i18n.getMessage('tweetWantretweetuser'),
            icon    : 'fas fa-user-minus fa-fw',
            visible : function() { return document.body.dataset.windowType == 'noretweet'; }
        };
        // スクリーンネーム
        const sn = '@' + r.screen_name;
        contextMenu[sn] = {
            name : sn,
            icon : 'fas fa-at fa-fw',
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
            if (userinfo.screen_name) {
                $menuitem.attr('data-screenname', '@' + userinfo.screen_name);
                $menuitem.children('span').text('@' + userinfo.screen_name);
            }
            // プロフィール画像変更
            if (userinfo.profile_image_url)
                $menuitem.children('.menuImage').attr('src', userinfo.profile_image_url);
            // トップメニューコンテナに追加
            $menuitem.attr('data-userid', userinfo.user_id).insertBefore($('#menuProfileSeparator'));
        }

        this.updateTweetUserSelection(this.$tweetUserSelection, this.$tweetUserTemplate, all_userinfo);
    },
    updateTweetUserSelection : function($tweetUserSelection, $tweetUserTemplate, all_userinfo) {
        $tweetUserSelection.find('option').remove();

        // ユーザ追加
        const userids = Object.keys(all_userinfo);
        for (let i=0; i<userids.length; i++) {
            const userinfo    = all_userinfo[userids[i]],
                  $useroption = $tweetUserTemplate.clone();

            // スクリーンネーム変更
            if (userinfo.screen_name)
                $useroption.text('@' + userinfo.screen_name);
            // プロフィール画像変更
            if (userinfo.profile_image_url)
                $useroption.attr('data-image', userinfo.profile_image_url);
            // メニューアイテム
            $useroption.val(userinfo.user_id).appendTo($tweetUserSelection);

            // 最初の一人
            if (i==0)
                $('#profileOwnImage').css('background-image', 'url(' + userinfo.profile_image_url + ')');
        }
    },

    /**
     * カラム操作
     */
    // カラムを作成して末尾に追加
    _makeColumn : function(columnid, columninfo, index) {
        const $column    = this.$columnTemplate.clone(true, true),
              // タイムライン種別
              columntype = TwitSideModule.getTimelineName(columninfo.tl_type);

        // カラム
        $column.attr({
            id                 : columnid,
            'data-column-type' : columntype,
            'data-userid'      : columninfo.userid
        }).appendTo(this.$columnC);

        // メインウィンドウのみ
        if (this._win_type === TwitSideModule.WINDOW_TYPE.MAIN) {
            // カラムスパイ
            this.$columnSpyTemplate.clone().attr({
                id   : columnid+'_spy',
                href : '#'+columnid
            }).appendTo(this.$columnSpyC);
        }

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
              $columnTab = $column.children('.columnTab');

        // カラムラベル変更
        $columnTab.text(columninfo.columnlabel);
        // カラムスパイ・メインウィンドウのみ
        $('#'+columnid+'_spy').text(columninfo.columnlabel);

        // 新しいリストボタン表示
        if (columninfo.tl_type === TwitSideModule.TL_TYPE.TEMP_OWNERSHIPLISTS
            && columninfo.userid == columninfo.options.userid)
            $column.find('.newListButton').css('display', '');

        // プライバシーモード
        $column.attr('data-veil', columninfo.options.veil ? 'true' : 'false');
    },

    // カラムの順番変更
    _sortColumn : function(old_index, new_index) {
        const $column    = this.$columnC.children().eq(old_index),
              $columnSpy = this.$columnSpyC.children().eq(old_index);

        if (!$column[0]) return;

        // 後ろへ
        if (old_index < new_index) {
            this.$columnC.children().eq(new_index).after($column);
            this.$columnSpyC.children().eq(new_index).after($columnSpy);
        }
        // 前へ
        else {
            this.$columnC.children().eq(new_index).before($column);
            this.$columnSpyC.children().eq(new_index).before($columnSpy);
        }

        // メインウィンドウのみ
        if (this._win_type === TwitSideModule.WINDOW_TYPE.MAIN)
            UI.$columnC.scroll();
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
        $('#'+columnid+'_spy').remove();

        // メインウィンドウのみ
        if (this._win_type === TwitSideModule.WINDOW_TYPE.MAIN) {
            calcColumns();
            this.$columnC.scroll();
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
        if (config['theme'] == 'default') {
            if (window.matchMedia('(prefers-color-scheme: dark)').matches)
                document.getElementById('theme').href = 'style/theme-dark.css';
            else
                document.getElementById('theme').href = '';
        }
        else if (config['theme'] == 'default')
            document.getElementById('theme').href = '';
        else
            document.getElementById('theme').href = 'style/theme-' + config['theme'] + '.css';
        document.body.dataset.colorRetweets    = config['color_retweets'];
        // 画像
        document.body.dataset.viewthumbnail    = config['viewthumbnail'];
        // 動く画像
        if (config['movethumbnail'])
            $('#columnContainer').on('mousemove mouseout', '.tweetThumbnailImage', movePhotos);
        else
            $('#columnContainer').off('mousemove mouseout', '.tweetThumbnailImage', movePhotos);
        // スクリーンネーム
        document.body.dataset.screennameFirst  = config['screenname_first'];
        // ソース
        document.body.dataset.viewsource       = config['viewsource'];
        // 改行
        document.body.dataset.linefeed         = config['linefeed'];

        // scale settings
        // フォント
        $('html').css('font-size', config['font_size']);
        // アイコンサイズ
        document.body.dataset.iconSize         = config['icon_size'];
        // サークルアイコン
        document.body.dataset.circleIcon       = config['circle_icon'];
        // アイコン表示
        document.body.dataset.showIcon         = config['show_icon'];

        // tweetmenu settings
        // 右クリックメニュー
        document.body.dataset.menuReply        = config['menu_reply'];
        document.body.dataset.menuFavorite     = config['menu_favorite'];
        document.body.dataset.menuConversation = config['menu_conversation'];
        document.body.dataset.menuUrl          = config['menu_url'];
        // ツイートメニュー
        this.setTweetMenuOrder(config);
    },

    setTweetMenuOrder : function(config) {
        const prefix ='.tweetMenuButton[data-func="';
        let style = '';
        style += config['hover_menu0'] && prefix + config['hover_menu0'] + '"]' + " { display: flex; order: 1; }\n";
        style += config['hover_menu1'] && prefix + config['hover_menu1'] + '"]' + " { display: flex; order: 2; }\n";
        style += config['hover_menu2'] && prefix + config['hover_menu2'] + '"]' + " { display: flex; order: 3; }\n";
        style += config['hover_menu3'] && prefix + config['hover_menu3'] + '"]' + " { display: flex; order: 4; }\n";

        $('#tweetMenuOrder').text(style);
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
            // if (this._win_type === TwitSideModule.WINDOW_TYPE.MAIN)
            //     scrollColumns($column.index());
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
                $column[0].$activeBox = undefined;
                // 余白を詰める
                if ($column.children('.timelineBox').scrollTop() <= parseInt($tweetBox.css('margin-top')))
                    $column.children('.timelineBox').scrollTop(0);
            }
            else
                $column[0].$activeBox = $tweetBox;

            // アクティブカラムも変更
            this.setActiveColumn($column, true);
        }
        else {
            $tweetBox[0].focus({ preventScroll : true });
        }
    },

    getActiveBox : function($column) {
        if ($column == null) $column = this.$activeColumn;

        // activeBoxがnullなら一番上
        return $column[0].$activeBox == undefined
            ? $column.find('.tweetBox:first')
            : $column[0].$activeBox;
    },

    // メッセージ
    showMessage : function(message, text_flag) {
        if (message == null) return;
        // transMessageの返値
        if (Array.isArray(message)) [message, text_flag] = message;

        const $body = $('#messageToast > .toast-body');

        $body.text('');
        text_flag
            ? $body.text(message)
            : $body.html(message);

        // 表示
        $('#messageToast').toast('show');
    },

    confirm : function(message, OKfunc, confirm) {
        if (confirm !== false) {
            const $alertModal = $('#templateContainer > .alertModal').clone(true).appendTo('body');

            $alertModal
                .on('shown.bs.modal', function() {
                    // モーダル表示時OKボタンフォーカス
                    $alertModal.find('.modal-footer > .btn:eq(0)').focus();
                })
                .on('hidden.bs.modal', function() {
                    // モーダル表示DOM削除
                    $alertModal.remove();
                });

            // OKボタン
            $alertModal.find('.btn-primary').on('click', OKfunc);

            $alertModal.find('.modal-body').text(message);
            $alertModal.modal('show');
        }
        else {
            OKfunc();
        }
    }
};


/**
 * 全体
 */
// localization content ui
const localization = () => {
    const suffixList = ['', 'title', 'placeholder'];

    for (const suffix of suffixList) {
        const attr = 'data-string' + (suffix ? '-' + suffix : '');
        $('['+attr+']').each(function(i, e) {
            suffix
                ? $(e).attr(suffix, browser.i18n.getMessage($(e).attr(attr)))
                : $(e).text(browser.i18n.getMessage($(e).attr(attr)));
        });
    }
};

// add click or press Enter key event listener
const buttonize = (buttonItems, commandExec) => {
    // common buttons
    $(document).on('click', buttonItems.join(','), function(e) {
        return commandExec(this);
    });
};

// プログレスバー
const showProgressbar = (progress) => {
    // debug message
    TwitSideModule.debug.log('progress: ' + progress);

    const $bar = $('#progressContainer > .progress-bar');

    if ($bar.attr('data-progress') > progress)
        $bar.css('width', 0);
    $bar.attr('data-progress', progress).css('display', '');

    if (progress >= 100) {
        $bar.css('width', '100%').delay(600).fadeOut(400).delay(400).queue(function() {
            $bar.attr('data-progress', 0).css('width', 0).dequeue();;
        });
    }
    else
        $bar.css('width', progress+'%');
};

// ローディング column or other
const showLoadingProgressbar = (sw, columnid) => {
    if (sw) {
        columnid
            ? $('#'+columnid).find('.progressBarColumn').removeClass('d-none')
            : $('#progressBarOther').removeClass('d-none'); // 全体のバー
    }
    else {
        columnid
            ? $('#'+columnid).find('.progressBarColumn').addClass('d-none')
            : $('#progressBarOther').addClass('d-none'); // 全体のバー
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
        // メインウィンドウ
        if (UI._win_type === TwitSideModule.WINDOW_TYPE.MAIN) {
            if (!getColumnIndex().includes(UI.getActiveColumn().index()))
                UI.$columnC.children().eq(getColumnIndex()[0]).focus();
        }
        UI.getActiveBox().next().focus();
        break;
    case 'K':
        // メインウィンドウ
        if (UI._win_type === TwitSideModule.WINDOW_TYPE.MAIN) {
            if (!getColumnIndex().includes(UI.getActiveColumn().index()))
                UI.$columnC.children().eq(getColumnIndex()[0]).focus();
        }
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
            scrollColumns(UI.$activeColumn.index() - 1);
        else if (key == 'L' && $activeColumn.next()[0])
            scrollColumns(UI.$activeColumn.index() + 1);
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
        .appendTo($('#refTweetContainer').empty())
        .children().remove(':not(.tweetMainContent)')
        .find('.tweetThumbnail').remove();

    // quote
    if (type == 'inline') {
        $('#refTweetReply').addClass('d-none');
        $('#refTweetInline').removeClass('d-none');
    }

    // 返信ユーザ
    if (type == 'reply' || type == 'replyall') {
        const $templateReplyUser = $('#templateContainer > .replyUser');

        $('#refTweetReply').removeClass('d-none');
        $('#refTweetInline').addClass('d-none');

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
        if (type == 'reply')
            $replyUsersSelection.children(':gt(0)').addClass('disabled');
        // 1人目は選択させない
        $replyUsersSelection.children(':eq(0)').attr('tabindex', 0);
    }

    $('#refTweetBox').show();

    countNewTweet();
    $('#newTweet').focus();
};

// 公式リツイート
const onClickRetweet = (tweetBox) => {
    const boxid = tweetBox.id.replace(/^[a-zA-Z]{5}_/, ''), // columnidを除去
          sw    = !$(tweetBox).children('.tweetContent').attr('data-retweeted');

    if (sw) {
        UI.confirm(browser.i18n.getMessage('confirmRetweet'),
                   () => {
                       TwitSideModule.ManageColumns.getTimelineInfo(
                           getColumnIndexFromBox(tweetBox),
                           'timeline',
                           UI._win_type
                       ).retweet(boxid);
                   },
                   TwitSideModule.config.getPref('confirm_retweet'));
    }
    else {
        UI.confirm(browser.i18n.getMessage('confirmRemoveRetweet'),
                   () => {
                       TwitSideModule.ManageColumns.getTimelineInfo(
                           getColumnIndexFromBox(tweetBox),
                           'timeline',
                           UI._win_type
                       ).unretweet(boxid);
                   },
                   TwitSideModule.config.getPref('confirm_delete'));
    }
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
            'data-reply-id'       : origid.replace(/^0+/, '')
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
            'data-reply-id'       : origid.replace(/^0+/, '')
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

// お気に入り
const onClickFavorite = (tweetBox) => {
    const boxid = tweetBox.id.replace(/^[a-zA-Z]{5}_/, ''), // columnidを除去
          sw    = !$(tweetBox).children('.tweetContent').attr('data-favorited');

    UI.confirm(browser.i18n.getMessage(sw ? 'confirmAddFavorite' : 'confirmRemoveFavorite'),
               () => {
                   TwitSideModule.ManageColumns.getTimelineInfo(
                       getColumnIndexFromBox(tweetBox),
                       'timeline',
                       UI._win_type
                   ).favorite(boxid, sw);
               },
               TwitSideModule.config.getPref('confirm_favorite'));
};

// 会話を表示
const onClickShowreply = (tweetBox) => {
    const boxid = tweetBox.id.replace(/^[a-zA-Z]{5}_/, ''); // columnidを除去
    const $replyBox = $(tweetBox).find('.replyTweetBox').last();

    // 既に読み込まれているときは何もしない
    if ($replyBox.attr('data-open') == 'true') return;

    // 会話を全て閉じるボタン
    $(tweetBox).closest('.timelineBox').siblings('.clearAllRepliesButton').removeClass('d-none');

    TwitSideModule.ManageColumns.getTimelineInfo(
        getColumnIndexFromBox(tweetBox),
        'timeline',
        UI._win_type
    ).replies(boxid);

    $replyBox.attr('data-open', 'true');
};

// 会話を消す
const clearReplies = (button) => {
    const $replyBox = $(button).closest('.replyTweetBox');
    $replyBox.attr('data-open', 'false').children('.replies').empty();

    // 会話を全て閉じるボタン
    if (!$.contains($replyBox.closest('.timelineBox'), ('.replyTweetBox[data-open="true"]')))
        $replyBox.closest('.timelineBox').siblings('.clearAllRepliesButton').addClass('d-none');
};

// 会話を全て消す
const clearAllReplies = (button) => {
    const $replyBox = $(button).siblings('.timelineBox').find('.replyTweetBox[data-open="true"]');
    $replyBox.attr('data-open', 'false').children('.replies').empty();

    // 会話を全て閉じるボタン
    $(button).addClass('d-none');
};

// 削除
const onClickDestroy = (tweetBox) => {
    const boxid = tweetBox.id.replace(/^[a-zA-Z]{5}_/, ''); // columnidを除去

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

    UI.confirm(message,
               () => {
                   TwitSideModule.ManageColumns.getTimelineInfo(
                       getColumnIndexFromBox(tweetBox),
                       'timeline',
                       UI._win_type
                   ).destroy(boxid);
               },
               TwitSideModule.config.getPref('confirm_delete'));
};

// リツイートしたユーザを表示
const onClickShowretweetedusers = (tweetBox) => {
    const boxid = tweetBox.id.replace(/^[a-zA-Z]{5}_/, ''); // columnidを除去

    TwitSideModule.ManageColumns.getTimelineInfo(
        getColumnIndexFromBox(tweetBox),
        'timeline',
        UI._win_type
    ).retweeters(boxid);
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

// 画像移動
const movePhotos = (e) => {
    if (e.type == 'mousemove') {
        const rect = e.target.getBoundingClientRect(),
              xp   = (e.originalEvent.x - rect.x) / rect.width * 100,
              yp   = (e.originalEvent.y - rect.y) / rect.height * 100;
        $(e.target).css('object-position', xp+'% '+yp+'%');
    }
    else if (e.type == 'mouseout')
        $(e.target).css('object-position', '');
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
const suggestScreenname = (textarea, suggestContainer, e) => {
    if (e && e.originalEvent &&
        (e.originalEvent.ctrlKey || e.originalEvent.shiftKey || e.originalEvent.altKey)) return;

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
                    $('<option class="p-1" />').val(matched).text(sn).appendTo($suggest);

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
            else// if (e.key == 'Tab')
                $suggest[0].selectedIndex--;
            return;
        case e.key == 'Tab':
        case e.key == 'ArrowDown':
            if ($suggest[0].selectedIndex == $suggest.children().length - 1) {
                hideSuggest(suggestContainer);
                if (focus) $(focus).focus();
            }
            else// if (e.key == 'Tab')
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

/**
 * スクリーンネームチェック
 */
const checkScreenname = (screenname) => {
    const $check    = $('#screennameCheck');

    // 未入力
    if (!screenname) {
        $check.attr('data-status', 'unchecked');
        return Promise.reject();
    }
    // 正規化スクリーンネーム
    const sn = (/^@?(\S+)\s*$/.exec(screenname))[0];

    const result = TwitSideModule.Friends.searchFriendFromSn(sn);
    // 結果あり（latestfriends）
    if (result) {
        $check.attr('data-status', 'checkok');
        return Promise.resolve();
    }
    else {
        // 読み込み中
        $check.attr('data-status', 'loading');
        // lookup
        return (new Tweet(
            TwitSideModule.ManageUsers.getUserInfo(TwitSideModule.ManageUsers.allUserid[0])
        )).userShow({ screen_name : sn })
              .then((result) => {
                  TwitSideModule.Friends.updateLatestFriends(result.data);
                  $check.attr('data-status', 'checkok');
                  return Promise.resolve();
              })
              .catch(() => {
                  $check.attr('data-status', 'checkng');
                  return Promise.reject();
              });
    }
};


