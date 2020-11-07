/**
 * @fileOverview profile content script
 * @name profile.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

let bg, fg, searchParams, TwitSideModule;

const COLUMN_TAB_MARGIN   = 2, // horizontal margin
      LISTNAME_MAX_LENGTH = 25,
      LISTDESC_MAX_LENGTH = 100,
      SUFFIX = 'profile';

let userinfo,    // 自身のプロフィール
    profileJson; // プロフィールの生データ

window.addEventListener('load', async () => {
    // パラメータ
    searchParams = Object.fromEntries(new URL(window.location).searchParams);

    bg = await browser.runtime.getBackgroundPage();
    // private browsing mode
    if (!bg) return;
    fg = await browser.windows.getCurrent();

    // session restore
    if (!bg.initialized) browser.windows.remove(fg.id);

    TwitSideModule = bg.TwitSideModule;
    // session restore
    if (!TwitSideModule.ManageWindows.getOpenerId(SUFFIX)) browser.windows.remove(fg.id);

    localization();
    buttonize(['.ts-btn, .tweetRetweeterImage'], commandExec);
    vivify();

    // UI初期化
    UI.initialize(TwitSideModule.WINDOW_TYPE.PROFILE);

    // profile
    initialize();
    if (searchParams.keyword) showUser();

    window.addEventListener('beforeunload', () => {
        TwitSideModule.windows.removeReceiver(fg.id);
        // カラムリセット
        TwitSideModule.ManageColumns.reset(UI._win_type);
    });
});

// add other event listener
const vivify = () => {
    // スクリーンネーム入力ボックス
    $('#screenname')
        .on('keyup', function(e) { suggestScreenname($(this), $('#suggestContainer'), e); })
        .on('keydown', keypressSearchbox)
        .on('blur', function(e) {
            setTimeout(() => {
                if ($('#suggestContainer').is(':focus')) return;
                hideSuggest($('#suggestContainer'));
            }, 100);
        });
    // プロフィール画像
    $('#profileUserImage')
        .on('click', function() { openURL(this.src); });
    // URL
    $('#profileUrl')
        .on('click', function() { openURL(profileJson.url); });
    $('#suggestContainer')
        .on('click', 'option', function() {
            suggestOnSelect(false, $('#screenname'), $('#suggestContainer'), null, searchUser);
            return false;
        })
        .on('focus', 'option', function() {
            $(this).parent().focus();
            return false;
        })
        .on('keydown', function(e) {
            suggestOnSelect(e, $('#screenname'), $('#suggestContainer'), $('#search'), searchUser);
            return false;
        });
    // カラムコンテナ
    $('#columnContainer')
        .keypress(keyeventChangeFocus)
        .on('focus', '> .column', function() {
            UI.setActiveColumn($(this));
        })
        .on('focus', '.timelineBox > .tweetBox', function(e) {
            e.stopPropagation();
            UI.setActiveBox($(this));
        })
        .on('click', '.tweetThumbnailImage', showPhotos); // サムネイル
    // タイムライン
    $('#templateContainer .timelineBox')
        .on('scroll', function() {
            // 最上部
            if (this.scrollTop == 0) {
                if (this.parentNode.dataset.top == 'false')
                    this.parentNode.dataset.top = true;
            }
            else {
                if (this.parentNode.dataset.top == 'true')
                    this.parentNode.dataset.top = false;
                // オートページャ
                if (this.scrollHeight - this.clientHeight - 200 < this.scrollTop
                    && TwitSideModule.config.getPref('autopager'))
                    loadMore(this.lastChild);
            }
        });
    // リストラベル
    $('#listLabel')
        .on('keyup paste drop blur', function() {
            $('#okButton').toggleClass('disabled', this.value == '');
        });
    // カラム追加コンテナ
    $('#addListContainer')
        .on('shown.bs.modal', function() {
            $('#listLabel').focus();
        });
    // フォーム送信しない
    $('#addListForm')
        .on('submit', function() {
            onAcceptForAddList();
            return false;
        });
};

// event asignment
const commandExec = (btn) => {
    if (btn.classList.contains('disabled')) return false;

    // identify from id
    switch (btn.id) {

    case 'goback':
        return history.back();
    case 'goahead':
        return history.forward();
    case 'profileOwnImage':
        return TwitSideModule.ManageWindows.openWindow('profile', {
            userid  : userinfo.user_id,
            keyword : btn.title
        }, TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
    case 'search':
        return searchUser();
    case 'restrictionButton1':
        return TwitSideModule.ManageWindows.openWindow('api', {
            userid : userinfo.user_id
        }, TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
    case 'restrictionButton2':
        return TwitSideModule.ManageWindows.openWindow('mute', {
            userid : userinfo.user_id
        }, TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
    case 'restrictionButton3':
        return TwitSideModule.ManageWindows.openWindow('block', {
            userid : userinfo.user_id
        }, TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
    case 'restrictionButton4':
        return TwitSideModule.ManageWindows.openWindow('noretweet', {
            userid : userinfo.user_id
        }, TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
    case 'relationButton1':
        return makeFriendship('follow');
    case 'relationButton2':
        return makeFriendship('mute');
    case 'relationButton3':
        return makeFriendship('block');
    case 'relationButton4':
        return makeFriendship('noretweet');
    case 'profileButton1':
    case 'profileButton2':
    case 'profileButton3':
    case 'profileButton4':
    case 'profileButton5':
    case 'profileButton6':
    case 'profileButton7':
        return loadNewerAfterChangeColumn($(btn).index('#profileButtonList button'));
    case 'profileButton8':
        if ($('#profileContainer').attr('data-profile-own') == 'true')
            return loadNewerAfterChangeColumn(7);
        else
            return TwitSideModule.ManageWindows.openWindow('newdm', {
                userid    : userinfo.user_id,
                recipient : '@' + profileJson.screen_name
            }, TwitSideModule.ManageWindows.getOpenerId(SUFFIX));

//    case '':
//        break;
    }

    // identify from class
    switch (true) {

    case btn.classList.contains('clearAllRepliesButton'): // column
        return clearAllReplies(btn);
    case btn.classList.contains('toTopButton'): // columnMenuBox
        btn.blur();
        return timelineMove('top');
    case btn.classList.contains('toBottomButton'):
        btn.blur();
        return timelineMove('bottom');
    case btn.classList.contains('columnUpdateButton'):
        btn.blur();
        return loadNewer(getColumnIndexFromBox(btn));
    case btn.classList.contains('newListButton'):
        btn.blur();
        return onClickAddList();
    case btn.classList.contains('newDmButton'):
        btn.blur();
        return TwitSideModule.ManageWindows.openWindow('newdm', {
            userid : userinfo.user_id
        }, TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
    case btn.classList.contains('addColumnButton'):
        return null;

    case btn.classList.contains('tweetMoreBox'): // tweetBox
        return loadMore(btn);
    case btn.classList.contains('clearReplies'):
        return clearReplies(btn);
    case btn.classList.contains('tweetRetweeterImage'):
        return onClickRetweeterImage(btn);
    case btn.classList.contains('tweetMenuButton'):
        return UI.tweetMenuFuncList[btn.dataset.func](btn);

//    case btn.classList.contains(''):
//        break;
    }
};

const keypressSearchbox = (e) => {
    e = e.originalEvent;

    // サジェスト
    if (e && !e.shiftKey && e.key == 'Tab' || e && e.key == 'ArrowDown') {
        if ($('#suggestContainer').is(':visible')) {
            setTimeout(() => { $('#suggestContainer').focus(); }, 0);
            return false;
        }
    }
    // 検索
    else if (e && e.key == 'Enter') {
        searchUser();
    }
    return true;
};


/**
 * Panel operation
 */
const initialize = () => {
    userinfo = TwitSideModule.ManageUsers.getUserInfo(searchParams.userid);
    $('#profileOwnImage').attr('title', '@' + userinfo.screen_name)
        .css('background-image', 'url(' + userinfo.profile_image_url + ')');

    $('#screenname').focus();

    // 最大文字数
    $('#listLabel').attr('maxlength', LISTNAME_MAX_LENGTH);
    $('#listDescription').attr('maxlength', LISTDESC_MAX_LENGTH);
};

// 検索実施
const searchUser = async () => {
    // スクリーンネーム整形
    if (! /^@?(\S+)\s*$/.test($('#screenname').val()))
        return;

    const screenname = '@'+RegExp.$1;

    TwitSideModule.ManageWindows.openWindow('profile', {
        userid  : userinfo.user_id,
        keyword : screenname
    }, TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
};

// 結果表示
const showUser = async () => {
    const error = (result) => {
        showLoadingProgressbar(false);
        $('#topMenuContainer .btn.ts-btn').removeClass('disabled');
        $('#topMenuContainer input').removeAttr('disabled');
        UI.showMessage(TwitSideModule.Message.transMessage(result));
        return Promise.reject();
    };

    // 検索ボックス
    $('#screenname').val(searchParams.keyword);
    // スクリーンネーム整形
    const screenname = (/^@?(\S+)\s*$/.exec(searchParams.keyword))[0];

    // 読み込み中
    showLoadingProgressbar(true);
    $('#topMenuContainer .btn.ts-btn').addClass('disabled');
    $('#topMenuContainer input').attr('disabled', 'disabled');

    // ユーザ情報
    const result_usershow = await (new Tweet(userinfo)).userShow({ screen_name : screenname }).catch(error);
    TwitSideModule.Friends.updateLatestFriends(result_usershow.data);
    await updateProfile(result_usershow.data);

    // 鍵アカ未フォロー
    if (profileJson.relationship
        && !profileJson.relationship.source.following && profileJson.protected) {
        UI.showMessage(TwitSideModule.Message.transMessage('protectedUser'));

        // 読み込み完了
        showLoadingProgressbar(false);
        $('#grayout').addClass('d-none');
        $('#topMenuContainer .btn.ts-btn').removeClass('disabled');
        $('#topMenuContainer input').removeAttr('disabled');
        // ボタン無効化
        $('.profileButtonList .countboxButton').attr('data-disabled', true);
        return;
    }
    // ブロックされている
    if (profileJson.relationship && profileJson.relationship.source.blocked_by) {
        UI.showMessage(TwitSideModule.Message.transMessage('youAreBlocked'));

        // 読み込み完了
        showLoadingProgressbar(false);
        $('#grayout').addClass('d-none');
        $('#topMenuContainer .btn.ts-btn').removeClass('disabled');
        $('#topMenuContainer input').removeAttr('disabled');
        // ボタン無効化
        $('.profileButtonList .countboxButton').attr('data-disabled', true);
        return;
    }

    const timelines = [
        { tl_type : TwitSideModule.TL_TYPE.TEMP_USERTIMELINE,
          options : { onstart : false, autoreload : false, notif : false, veil : false }},
        { tl_type : TwitSideModule.TL_TYPE.TEMP_FOLLOW,
          options : { onstart : false, autoreload : false, notif : false, veil : false }},
        { tl_type : TwitSideModule.TL_TYPE.TEMP_FOLLOWER,
          options : { onstart : false, autoreload : false, notif : false, veil : false }},
        { tl_type : TwitSideModule.TL_TYPE.TEMP_FAVORITE,
          options : { onstart : false, autoreload : false, notif : false, veil : false }},
        { tl_type : TwitSideModule.TL_TYPE.TEMP_OWNERSHIPLISTS,
          options : { onstart : false, autoreload : false, notif : false, veil : false }},
        { tl_type : TwitSideModule.TL_TYPE.TEMP_SUBSCRIPTIONLISTS,
          options : { onstart : false, autoreload : false, notif : false, veil : false }},
        { tl_type : TwitSideModule.TL_TYPE.TEMP_MEMBERSHIPLISTS,
          options : { onstart : false, autoreload : false, notif : false, veil : false }},
        { tl_type : TwitSideModule.TL_TYPE.TEMP_DIRECTMESSAGE,
          options : { onstart : false, autoreload : false, notif : false, veil : false }}
        ];

    for (let i=0; i<8; i++) {
        if (i < 7)
            await TwitSideModule.ManageColumns.addColumn(
                timelines[i].tl_type,
                '', userinfo.user_id,
                timelines[i].options,
                { user_id    : profileJson.id_str },
                UI._win_type, i
            );

        // ダイレクトメッセージ
        else if (profileJson.id_str == userinfo.user_id)
            await TwitSideModule.ManageColumns.addColumn(
                timelines[i].tl_type,
                '', userinfo.user_id,
                timelines[i].options,
                null,
                UI._win_type, i
            );
    }

    // 読み込み完了
    showLoadingProgressbar(false);
    $('#grayout').addClass('d-none');
    $('#topMenuContainer .btn.ts-btn').removeClass('disabled');
    $('#topMenuContainer input').removeAttr('disabled');

    // 1つのカラムだけ表示
    loadNewerAfterChangeColumn(0);
};

// プロフィールの表示更新
const updateProfile = async (data) => {
    const error = (result) => {
        UI.showMessage(TwitSideModule.Message.transMessage(result));
        return Promise.reject();
    };

    // 結果から情報表示
    profileJson = data;
    document.title = browser.i18n.getMessage('windowProfileUsertitle', '@'+profileJson.screen_name);

    // ミュート、リツイート非表示取得
    if (userinfo.user_id != profileJson.id_str) {
        $('#profileContainer').attr('data-profile-own', 'false');

        const result = await (new Tweet(userinfo)).showFriendship({ target_id : profileJson.id_str }).catch(error);

        const relationship = result.data.relationship;
        profileJson['relationship'] = relationship;

        $('#profileContainer').attr({
            'data-following'        : relationship.source.following,
            'data-followed'         : relationship.source.followed_by,
            'data-followrequesting' : relationship.source.following_requested,
            'data-mute'             : relationship.source.muting,
            'data-block'            : relationship.source.blocking,
            'data-blocked'          : relationship.source.blocked_by,
            'data-noretweet'        : !relationship.source.want_retweets
        });
    }
    else {
        $('#profileContainer').attr('data-profile-own', 'true');
    }

    profileJson.profile_banner_url && $('#profileContainer')
        .css('background-image', 'url(' + profileJson.profile_banner_url + '/web)');
    $('#profileUserImage').attr('src', profileJson.profile_image_url.replace('_normal.', '.'));
    $('#profileContainer').attr({ 'data-protected' : profileJson.protected,
                                  'data-verified'  : profileJson.verified });

    $('#profileScreenname').text('@'+profileJson.screen_name);
    $('#profileUsername').text(profileJson.name);
    if (profileJson.description) {
        $('#profileDescription').text(profileJson.description);
        extractProfileDescription($('#profileDescription'), profileJson.entities.description.urls);
    }

    // 付加情報
    profileJson.location && $('#profileLocation').text(profileJson.location);
    profileJson.url      && $('#profileUrl').text(
        TwitSideModule.config.getPref('exURL')
            ? (TwitSideModule.config.getPref('exURL_cut')
               ? profileJson.entities.url.urls[0].display_url : profileJson.entities.url.urls[0].expanded_url)
            : profileJson.entities.url[0].url);

    // ユーザカラー
    if (profileJson.profile_link_color) {
        const color = '#' + profileJson.profile_link_color;
        $('#profileContainer .text-link').css('color', color);
        $('#countboxStyle')
            .text('#restrictionButtonList > button, #relationButtonList > button, #profileButtonList button { border-color: ' + color + '; }\
#restrictionButtonList > button, #relationButtonList > button { background-color: ' + color + '; }');
    }

    // カウンター
    $('#profileButton1 > .count').text(profileJson.statuses_count);
    $('#profileButton2 > .count').text(profileJson.friends_count);
    $('#profileButton3 > .count').text(profileJson.followers_count);
    $('#profileButton4 > .count').text(profileJson.favourites_count);
    $('#profileButton7 > .count').text(profileJson.listed_count);
};

// プロフィール文章を展開
const extractProfileDescription = ($description, urls) => {
    if ($description[0] == null) throw new Error('PARAMETER_IS_NOT_DEFINED');
    const entities = twttr.txt.extractEntitiesWithIndices($description.text());

    for (let entity of entities) {
        if (entity.hashtag) {
            let $span = $('<span class="text-link" tabindex="1" />')
                .text('#' + entity.hashtag)
                .on('click', function() {
                    TwitSideModule.ManageWindows.openWindow('search', {
                        userid  : userinfo.user_id,
                        keyword : this.textContent
                    }, TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
                });
            // ハッシュタグ置換
            UI.insertNodeIntoText($description[0], '#' + entity.hashtag, $span[0]);
        }
        else if (entity.screenName) {
            let $span = $('<span class="text-link" tabindex="1" />')
                .text('@' + entity.screenName)
                .on('click', function() {
                    TwitSideModule.ManageWindows.openWindow('profile', {
                        userid  : userinfo.user_id,
                        keyword : this.textContent
                    }, TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
                });
            UI.insertNodeIntoText($description[0], '@' + entity.screenName, $span[0]);
        }
    }
    // twttr.txt ではなくレスポンスを利用
    for (let url of urls) {
        let $span = $('<span class="text-link" tabindex="1" />')
            .text(
                TwitSideModule.config.getPref('exURL')
                    ? (TwitSideModule.config.getPref('exURL_cut')
                       ? url.display_url : url.expanded_url)
                    : url.url)
            .on('click', function() { openURL(url.url); });
        UI.insertNodeIntoText($description[0], url.url, $span[0]);
    }
};


/**
 * Friend operation
 */
// 友達になる
const makeFriendship = async (type_str) => {

    const updateFriendship = async (type, value) => {
        const error = (result) => {
            UI.showMessage(TwitSideModule.Message.transMessage(result));
            return Promise.reject();
        };

        await TwitSideModule.Friends.updateFriendship(
            type,
            profileJson.id_str,
            value,
            new Tweet(userinfo)
        ).catch(error);

        // ユーザ情報
        const result_usershow = await (new Tweet(userinfo)).userShow({ user_id : profileJson.id_str }).catch(error);
        updateProfile(result_usershow.data);
    };

    switch (type_str) {
    case 'follow':
        UI.confirm(browser.i18n.getMessage(profileJson.following ? 'confirmUnfollow' : 'confirmFollow'),
                   () => {
                       updateFriendship(
                           TwitSideModule.FRIEND_TYPE.FOLLOW,
                           !profileJson.following
                       );
                   },
                   TwitSideModule.config.getPref('confirm_follow'));
        return;
    case 'mute':
        UI.confirm(browser.i18n.getMessage(profileJson.relationship.source.muting ? 'confirmUnmute' : 'confirmMute'),
                   () => {
                       updateFriendship(
                           TwitSideModule.FRIEND_TYPE.MUTE,
                           !profileJson.relationship.source.muting
                       );
                   },
                   TwitSideModule.config.getPref('confirm_mute'));
        return;
    case 'block':
        UI.confirm(browser.i18n.getMessage(profileJson.relationship.source.blocking ? 'confirmUnblock' : 'confirmBlock'),
                   () => {
                       updateFriendship(
                           TwitSideModule.FRIEND_TYPE.BLOCK,
                           !profileJson.relationship.source.blocking
                       );
                   },
                   TwitSideModule.config.getPref('confirm_block'));
        return;
    case 'noretweet':
        UI.confirm(browser.i18n.getMessage(profileJson.relationship.source.want_retweets ? 'confirmNoretweet' : 'confirmWantretweet'),
                   () => {
                       updateFriendship(
                           TwitSideModule.FRIEND_TYPE.NORETWEET,
                           profileJson.relationship.source.want_retweets
                       );
                   },
                   TwitSideModule.config.getPref('confirm_noretweet'));
        return;
    }
};


/**
 * List operation
 */
// リストの作成
const onClickAddList = () => {
    resetAddListC();
    $('#addListContainer').modal('show');
};

// リストの編集
const onClickEditList = (vbox) => {
    resetAddListC({
        id : vbox.dataset.tweetid,
        name : vbox.dataset.listname,
        description : $(vbox).find('.tweetText').text(),
        mode : $(vbox).find('> .tweetContent').attr('data-protected') ? 'private' : 'public'
    });
    $('#addListContainer').modal('show');
};

const onAcceptForAddList = async () => {
    const listinfo = {
        name        : $('#listLabel').val(),
        description : $('#listDescription').val(),
        mode        : $('#listMode').val() ? 'private' : 'public'
    };

    switch ($('#addListContainer').attr('data-type')) {
    case 'add':
        await TwitSideModule.ManageColumns.getTimelineInfo(4, 'timeline', UI._win_type).createList(listinfo);
        $('#addListContainer').modal('hide');
        loadNewer(4);
        break;
    case 'edit':
        listinfo.list_id = $('#addListContainer').attr('data-listid');

        await TwitSideModule.ManageColumns.getTimelineInfo(4, 'timeline', UI._win_type).updateList(listinfo);
        $('#addListContainer').modal('hide');
        loadNewer(4);
        break;
    }
};

const resetAddListC = (listinfo) => {
    // リセット
    if (!listinfo) {
        $('#addListContainer').attr({
            'data-type'   : 'add',
            'data-listid' : ''
        });

        $('#addListTitle').removeClass('d-none');
        $('#editListTitle').addClass('d-none');
        $('#listLabel, #listDescription').val('').trigger('keyup');
        $('#listMode').prop('checked', false);
    }
    else {
        $('#addListContainer').attr({
            'data-type'   : 'edit',
            'data-listid' : listinfo.id
        });

        $('#addListTitle').addClass('d-none');
        $('#editListTitle').removeClass('d-none');
        $('#listLabel').val(listinfo.name).trigger('keyup');
        $('#listDescription').val(listinfo.description);
        $('#listMode').prop('checked', listinfo.mode == 'private');
    }
};

// メンバー一覧
const onClickShowMembers = (vbox) => {
    TwitSideModule.ManageWindows.openWindow('listmember', {
        userid   : userinfo.user_id,
        listid   : vbox.dataset.tweetid,
        screenname : vbox.dataset.screenname,
        listname : vbox.dataset.listname,
        tl_type  : TwitSideModule.TL_TYPE.TEMP_LISTMEMBER,
        own_list : $(vbox).children('.tweetContent').attr('data-mine') == 'true'
    }, TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
};

// 購読者一覧
const onClickShowSubscribers = (vbox) => {
    TwitSideModule.ManageWindows.openWindow('listmember', {
        userid   : userinfo.user_id,
        listid   : vbox.dataset.tweetid,
        screenname : vbox.dataset.screenname,
        listname : vbox.dataset.listname,
        tl_type  : TwitSideModule.TL_TYPE.TEMP_LISTSUBSCRIBER,
        own_list : $(vbox).children('.tweetContent').attr('data-mine') == 'true'
    }, TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
};

// リストの購読
const onClickSubscribe = (vbox) => {
    TwitSideModule.ManageColumns.getTimelineInfo(
        getColumnIndexFromBox(vbox),
        'timeline',
        UI._win_type
    ).subscribeList(vbox.dataset.tweetid);
};

// リストの購読解除
const onClickUnsubscribe = (vbox) => {
    TwitSideModule.ManageColumns.getTimelineInfo(
        getColumnIndexFromBox(vbox),
        'timeline',
        UI._win_type
    ).unsubscribeList(vbox.dataset.tweetid);
};

// リストタイムラインをカラムに追加
const onClickAddList2Column = async (vbox) => {
    const listname = $(vbox).find('.listName').attr('data-listname'),
          listuser = vbox.dataset.screenname,
          listid   = vbox.dataset.tweetid;

    await TwitSideModule.ManageColumns.addColumn(
        TwitSideModule.TL_TYPE.LISTTIMELINE,
        browser.i18n.getMessage('label_list', [listuser, listname]),
        userinfo.user_id,
        { onstart    : true,
          autoreload : true,
          notif      : true,
          veil       : false },
        { list_id : listid },
        TwitSideModule.WINDOW_TYPE.MAIN
    );

    UI.showMessage(TwitSideModule.Message.transMessage('columnAdded'));
};

// フォロー
const onClickFollowUser = (tweetBox) => {
    const boxid = tweetBox.id.replace(/^[a-zA-Z]{5}_/, ''), // columnidを除去
          sw    = !$(tweetBox).children('.tweetContent').attr('data-following');

    UI.confirm(browser.i18n.getMessage(sw ? 'confirmFollow' : 'confirmUnfollow'),
               () => {
                   TwitSideModule.ManageColumns.getTimelineInfo(
                       getColumnIndexFromBox(tweetBox),
                       'timeline',
                       UI._win_type
                   ).follow(boxid, sw);
               },
               TwitSideModule.config.getPref('confirm_follow'));
};

// ブロック
const onClickBlockUser = (tweetBox) => {
    const boxid = tweetBox.id.replace(/^[a-zA-Z]{5}_/, ''); // columnidを除去

    UI.confirm(browser.i18n.getMessage('confirmBlock'),
               () => {
                   TwitSideModule.ManageColumns.getTimelineInfo(
                       getColumnIndexFromBox(tweetBox),
                       'timeline',
                       UI._win_type
                   ).block(boxid);
               },
               TwitSideModule.config.getPref('confirm_block'));
};


/**
 * Column operation
 */
// ダミー
const changeTweetUser = () => {
    return true;
};

// カラム表示切り替え
const changeColumn = (columnindex) => {
    document.body.dataset.activeColumn = columnindex;
    UI.setActiveColumn(UI.$columnC.children().eq(columnindex));
};

// カラムを変更してロード
const loadNewerAfterChangeColumn = (columnindex) => {
    hideSuggest($('#suggestContainer'));
    changeColumn(columnindex);
    loadNewer(columnindex);
};
