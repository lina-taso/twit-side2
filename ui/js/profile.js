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
    buttonize(['.countboxButton', '.buttonItem',
               '.tweetRetweeterImage', '.tweetMoreBox',
               '.clearRepliesBox', '.tweetMenuButton'],
              commandExec);
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
        .on('keyup', function() { suggestScreenname($(this), $('#suggestContainer')); })
        .on('keydown', keypressSearchbox);
    // プロフィール画像
    $('#profileUserImage')
        .on('click', function() { openURL(this.src); });
    // URL
    $('#profileUrl')
        .on('click', function() { openURL(this.textContent); });
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
        .on('focus', '.column', function() {
            UI.setActiveColumn($(this));
        })
        .on('focus', '.timelineBox > .tweetBox', function(e) {
            e.stopPropagation();
            UI.setActiveBox($(this));
        })
        .on('dblclick', '.column[data-column-type=follow] .timelineBox > .tweetBox, .column[data-column-type=follower] .timelineBox > .tweetBox', function(e) {
            TwitSideModule.ManageWindows.openWindow('profile', {
                userid  : userinfo.user_id,
                keyword : this.dataset.screenname
            }, TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
        })
        .on('click','.tweetThumbnailImage', showPhotos); // サムネイル
    // タイムライン
    $('#templateContainer .timelineBox')
        .on('scroll', function() {
            // 影
            $(this).siblings('.columnShadowBox')
                .height(this.scrollTop < 10 ? this.scrollTop : 10);

            // オートページャ
            if (this.scrollHeight - this.clientHeight - 200 < this.scrollTop
                && TwitSideModule.config.getPref('autopager')) {
                loadMore(this.lastChild);
            }
        });
};

// event asignment
const commandExec = (btn) => {
    // identify from id
    switch (btn.id) {

    case 'goback':
        history.back();
        break;
    case 'goahead':
        history.forward();
        break;
    case 'profileOwnImage':
        TwitSideModule.ManageWindows.openWindow('profile', {
            userid  : userinfo.user_id,
            keyword : btn.title
        }, TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
        break;
    case 'search':
        searchUser();
        break;
    case 'restrictionButton1':
        TwitSideModule.ManageWindows.openWindow('api', {
            userid : userinfo.user_id
        }, TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
        break;
    case 'restrictionButton2':
        TwitSideModule.ManageWindows.openWindow('mute', {
            userid : userinfo.user_id
        }, TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
        break;
    case 'restrictionButton3':
        TwitSideModule.ManageWindows.openWindow('block', {
            userid : userinfo.user_id
        }, TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
        break;
    case 'restrictionButton4':
        TwitSideModule.ManageWindows.openWindow('noretweet', {
            userid : userinfo.user_id
        }, TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
        break;
    case 'relationButton1':
        makeFriendship('follow');
        break;
    case 'relationButton3':
        makeFriendship('mute');
        break;
    case 'relationButton4':
        makeFriendship('block');
        break;
    case 'relationButton5':
        makeFriendship('noretweet');
        break;
    case 'profileButton1':
    case 'profileButton2':
    case 'profileButton3':
    case 'profileButton4':
    case 'profileButton5':
    case 'profileButton6':
    case 'profileButton7':
        loadNewerAfterChangeColumn($(btn).index());
        break;
    case 'profileButton8':
        if ($('#profileContainer').attr('data-profile-own') == 'true')
            loadNewerAfterChangeColumn($(btn).index());
        else
            TwitSideModule.ManageWindows.openWindow('newdm', {
                userid    : userinfo.user_id,
                recipient : '@' + profileJson.screen_name
            }, TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
        break;
    case 'closeAddListC':
    case 'cancelButton':
        addListContainerToggle(false);
        break;
    case 'okButton':
        onAcceptForAddList();
        break;

//    case '':
//        break;
    }

    // identify from class
    switch (true) {

    case btn.classList.contains('clearRepliesBox'): // column
        clearAllReplies(btn);
        break;

    case btn.classList.contains('toTopButton'): // columnMenuBox
        timelineMove('top');
        break;
    case btn.classList.contains('toBottomButton'):
        timelineMove('bottom');
        break;
    case btn.classList.contains('updateButton'):
        loadNewer(getColumnIndexFromBox(btn));
        break;
    case btn.classList.contains('newListButton'):
        onClickAddList();
        break;
    case btn.classList.contains('newDmButton'):
        TwitSideModule.ManageWindows.openWindow('newdm', {
            userid : userinfo.user_id
        }, TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
        break;
    case btn.classList.contains('addColumnButton'):
        break;

    case btn.classList.contains('tweetMoreBox'): // tweetBox
        loadMore(btn);
        break;
    case btn.classList.contains('clearReplyButton'):
        clearReplies(btn);
        break;
    case btn.classList.contains('tweetRetweeterImage'):
        onClickRetweeterImage(btn);
        break;
    case btn.classList.contains('tweetMenuButton'):
        UI.getTweetMenuFunc(
            UI.getActiveColumn().attr('data-column-type'),
            $(btn).index())(btn);
        break;

//    case btn.classList.contains(''):
//        break;
    }
};

const keypressSearchbox = (e) => {
    e = e.originalEvent;

    // サジェスト
    if (e && !e.shiftKey && e.key == 'Tab'
        || e && e.key == 'ArrowDown') {
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
    document.title = browser.i18n.getMessage('windowProfileDefaulttitle');
    userinfo       = TwitSideModule.ManageUsers.getUserInfo(searchParams.userid);
    $('#profileOwnImage').attr('title', '@' + userinfo.screen_name)
        .children('img.buttonImage').attr('src', userinfo.profile_image_url);

    $('#screenname').focus();
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
        $('#topMenuContainer .buttonItem').attr('data-disabled', false);
        UI.showMessage(result.message, result.text_flag);
        return Promise.reject();
    };

    // 検索ボックス
    $('#screenname').val(searchParams.keyword);
    // スクリーンネーム整形
    const screenname = (/^@?(\S+)\s*$/.exec(searchParams.keyword))[0];

    // 読み込み中
    showLoadingProgressbar(true);
    $('#topMenuContainer .buttonItem').attr('data-disabled', true);

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
        $('#grayout').toggleClass('hidden', true);
        $('#topMenuContainer .buttonItem').attr('data-disabled', false);
        // ボタン無効化
        $('.profileButtonList .countboxButton').attr('data-disabled', true);
        return;
    }
    // ブロックされている
    if (profileJson.relationship && profileJson.relationship.source.blocked_by) {
        UI.showMessage(TwitSideModule.Message.transMessage('youAreBlocked'));

        // 読み込み完了
        showLoadingProgressbar(false);
        $('#grayout').toggleClass('hidden', true);
        $('#topMenuContainer .buttonItem').attr('data-disabled', false);
        // ボタン無効化
        $('.profileButtonList .countboxButton').attr('data-disabled', true);
        return;
    }

    /**
     * ユーザータイムライン
     */
    await TwitSideModule.ManageColumns.addColumn(
        TwitSideModule.TL_TYPE.TEMP_USERTIMELINE,
        '', userinfo.user_id,
        { onstart    : false,
          autoreload : false,
          notif      : false,
          veil       : false },
        { user_id    : profileJson.id_str },
        UI._win_type, 0
    );
    /**
     * フォロータイムライン
     */
    await TwitSideModule.ManageColumns.addColumn(
        TwitSideModule.TL_TYPE.TEMP_FOLLOW,
        '', userinfo.user_id,
        { onstart    : false,
          autoreload : false,
          notif      : false,
          veil       : false },
        { user_id    : profileJson.id_str },
        UI._win_type, 1
    );
    /**
     * フォロワータイムライン
     */
    await TwitSideModule.ManageColumns.addColumn(
        TwitSideModule.TL_TYPE.TEMP_FOLLOWER,
        '', userinfo.user_id,
        { onstart    : false,
          autoreload : false,
          notif      : false,
          veil       : false },
        { user_id    : profileJson.id_str },
        UI._win_type, 2
    );
    /**
     * お気に入りタイムライン
     */
    await TwitSideModule.ManageColumns.addColumn(
        TwitSideModule.TL_TYPE.TEMP_FAVORITE,
        '', userinfo.user_id,
        { onstart    : false,
          autoreload : false,
          notif      : false,
          veil       : false },
        { user_id    : profileJson.id_str },
        UI._win_type, 3
    );
    /**
     * 保有リスト一覧
     */
    await TwitSideModule.ManageColumns.addColumn(
        TwitSideModule.TL_TYPE.TEMP_OWNERSHIPLISTS,
        '', userinfo.user_id,
        { onstart    : false,
          autoreload : false,
          notif      : false,
          veil       : false },
        { user_id    : profileJson.id_str },
        UI._win_type, 4
    );
    /**
     * 購読リスト一覧
     */
    await TwitSideModule.ManageColumns.addColumn(
        TwitSideModule.TL_TYPE.TEMP_SUBSCRIPTIONLISTS,
        '', userinfo.user_id,
        { onstart    : false,
          autoreload : false,
          notif      : false,
          veil       : false },
        { user_id    : profileJson.id_str },
        UI._win_type, 5
    );
    /**
     * フォローされたリスト一覧
     */
    await TwitSideModule.ManageColumns.addColumn(
        TwitSideModule.TL_TYPE.TEMP_MEMBERSHIPLISTS,
        '', userinfo.user_id,
        { onstart    : false,
          autoreload : false,
          notif      : false,
          veil       : false },
        { user_id    : profileJson.id_str },
        UI._win_type, 6
    );
    /**
     * ダイレクトメッセージタイムライン
     */
    if (profileJson.id_str == userinfo.user_id) {
        await TwitSideModule.ManageColumns.addColumn(
            TwitSideModule.TL_TYPE.TEMP_DIRECTMESSAGE,
            '', userinfo.user_id,
            { onstart    : false,
              autoreload : false,
              notif      : false,
              veil       : false },
            null,
            UI._win_type, 7
        );
    }

    // 読み込み完了
    showLoadingProgressbar(false);
    $('#grayout').toggleClass('hidden', true);
    $('#topMenuContainer .buttonItem').attr('data-disabled', false);

    // 1つのカラムだけ表示
    loadNewerAfterChangeColumn(0);
};

// プロフィールの表示更新
const updateProfile = async (data) => {
    const error = (result) => {
        UI.showMessage(result.message, result.text_flag);
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
        extractProfileDescription($('#profileDescription'));
    }

    // 付加情報
    profileJson.location && $('#profileLocation').text(profileJson.location);
    profileJson.url      && $('#profileUrl').text(profileJson.url);

    // ユーザカラー
    if (profileJson.profile_link_color) {
        const color = '#' + profileJson.profile_link_color;
        $('#profileContainer .text-link').css('color', color);
        $('#countboxStyle')
            .text('.countbox { border-color : ' + color + '; background-color : ' + color + ' ;}');
    }

    // カウンター
    $('#profileButton1').text(profileJson.statuses_count);
    $('#profileButton2').text(profileJson.friends_count);
    $('#profileButton3').text(profileJson.followers_count);
    $('#profileButton4').text(profileJson.favourites_count);
    $('#profileButton7').text(profileJson.listed_count);
};

// プロフィール文章を展開
const extractProfileDescription = ($description) => {
    if ($description[0] == null) throw new Error('PARAMETER_IS_NOT_DEFINED');
    const entities = twttr.txt.extractEntitiesWithIndices($description.text());

    for (let entity of entities) {
        if (entity.hashtag) {
            let span = document.createElement('span');
            span.classList.add('text-link');
            span.textContent = '#' + entity.hashtag;
            span.addEventListener('click', function() {
                TwitSideModule.ManageWindows.openWindow('search', {
                    userid  : userinfo.user_id,
                    keyword : this.textContent
                }, TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
            });
            // ハッシュタグ置換
            UI.insertNodeIntoText($description[0], entity.hashtag, span);
        }
        else if (entity.url) {
            let span = document.createElement('span');
            span.classList.add('text-link');
            span.textContent = entity.url;
            span.addEventListener('click', function() {
                openURL(this.textContent);
            });
            UI.insertNodeIntoText($description[0], entity.url, span);
        }
        else if (entity.screenName) {
            let span = document.createElement('span');
            span.classList.add('text-link');
            span.textContent = '@' + entity.screenName;
            span.addEventListener('click', function() {
                TwitSideModule.ManageWindows.openWindow('profile', {
                    userid  : userinfo.user_id,
                    keyword : this.textContent
                }, TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
            });
            UI.insertNodeIntoText($description[0], '@' + entity.screenName, span);
        }
    }
};


/**
 * Friend operation
 */
// 友達になる
const makeFriendship = async (type_str) => {
    const error = (result) => {
        UI.showMessage(result.message, result.text_flag);
        return Promise.reject();
    };

    let type, value;

    switch (type_str) {
    case 'follow':
        if (TwitSideModule.config.getPref('confirm_follow')
            && !confirm(browser.i18n.getMessage(profileJson.following
                                                ? 'confirmUnfollow'
                                                : 'confirmFollow')))
            return;

        type  = TwitSideModule.FRIEND_TYPE.FOLLOW;
        value = !profileJson.following;
        break;
    case 'mute':
        if (TwitSideModule.config.getPref('confirm_mute')
            && !confirm(browser.i18n.getMessage(profileJson.relationship.source.muting
                                                ? 'confirmUnmute'
                                                : 'confirmMute')))
            return;

        type  = TwitSideModule.FRIEND_TYPE.MUTE;
        value = !profileJson.relationship.source.muting;
        break;
    case 'block':
        if (TwitSideModule.config.getPref('confirm_block')
            && !confirm(browser.i18n.getMessage(profileJson.relationship.source.blocking
                                                ? 'confirmUnblock'
                                                : 'confirmBlock')))
            return;

        type  = TwitSideModule.FRIEND_TYPE.BLOCK;
        value = !profileJson.relationship.source.blocking;
        break;
    case 'noretweet':
        if (TwitSideModule.config.getPref('confirm_noretweet')
            && !confirm(browser.i18n.getMessage(profileJson.relationship.source.want_retweets
                                                ? 'confirmNoretweet'
                                                : 'confirmWantretweet')))
            return;

        type  = TwitSideModule.FRIEND_TYPE.NORETWEET;
        value = profileJson.relationship.source.want_retweets;
        break;
    }

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


/**
 * List operation
 */
const addListContainerToggle = (open) => {
    $('#addListContainer').attr('data-open', open);
    if (open) $('#listLabel').focus();
};

// リストの作成
const onClickAddList = () => {
    resetAddListC();
    addListContainerToggle(true);
};

// リストの編集
const onClickEditList = (vbox) => {
    resetAddListC({
        id : vbox.dataset.tweetid,
        name : $(vbox).find('.listName').attr('data-listname'),
        description : $(vbox).find('.tweetText').text(),
        mode : vbox.dataset.mode
    });
    addListContainerToggle(true);
};

const onAcceptForAddList = async () => {
    const type = $('#addListContainer').attr('data-type');

    if (!$('#listLabel').val()) {
        alert(browser.i18n.getMessage('profileMessageEnterlistlabel'));
        return;
    }
    if ($('#listLabel').val().length > LISTNAME_MAX_LENGTH) {
        alert(browser.i18n.getMessage('profileMessageToolonglistlabel', LISTNAME_MAX_LENGTH));
        return;
    }
    if ($('#listDescription').val().length > LISTDESC_MAX_LENGTH) {
        alert(browser.i18n.getMessage('profileMessageToolonglistdesc', LISTDESC_MAX_LENGTH));
        return;
    }

    const listinfo = {
        name        : $('#listLabel').val(),
        description : $('#listDescription').val(),
        mode        : $('[name=listmode]:checked').val()
    };

    switch (type) {
    case 'add':
        await TwitSideModule.ManageColumns.getTimeline(4, 'timeline', UI._win_type).createList(listinfo);
        addListContainerToggle(false);
        loadNewer(4);
        break;
    case 'edit':
        listinfo.list_id = $('#addListContainer').attr('data-listid');

        await TwitSideModule.ManageColumns.getTimeline(4, 'timeline', UI._win_type).updateList(listinfo);
        addListContainerToggle(false);
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

        $('#listLabel, #listDescription').val('');
        $('#public').prop('checked', true);
    }
    else {
        $('#addListContainer').attr({
            'data-type'   : 'edit',
            'data-listid' : listinfo.id
        });
        $('#listLabel').val(listinfo.name);
        $('#listDescription').val(listinfo.description);
        listinfo.mode == 'private'
            ? $('#public').prop('checked', true)
            : $('#private').prop('checked', true);
    }
};

// メンバー一覧
const onClickShowMembers = (vbox) => {
    TwitSideModule.ManageWindows.openWindow('listmember', {
        userid   : userinfo.user_id,
        listid   : vbox.dataset.tweetid,
        tl_type  : TwitSideModule.TL_TYPE.TEMP_LISTMEMBER,
        own_list : $(vbox).children('.tweetContent').attr('data-mine') == 'true'
    }, TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
};

// 購読者一覧
const onClickShowSubscribers = (vbox) => {
    TwitSideModule.ManageWindows.openWindow('listmember', {
        userid   : userinfo.user_id,
        listid   : vbox.dataset.tweetid,
        tl_type  : TwitSideModule.TL_TYPE.TEMP_LISTSUBSCRIBER,
        own_list : $(vbox).children('.tweetContent').attr('data-mine') == 'true'
    }, TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
};

// リストの購読
const onClickSubscribe = (vbox) => {
    TwitSideModule.ManageColumns.getTimeline(
        getColumnIndexFromBox(vbox),
        'timeline',
        UI._win_type
    ).subscribeList(vbox.dataset.tweetid);
};

// リストの購読解除
const onClickUnsubscribe = (vbox) => {
    TwitSideModule.ManageColumns.getTimeline(
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
