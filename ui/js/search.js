/**
 * @fileOverview search content script
 * @name search.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

let bg, fg, searchParams, TwitSideModule;

const SUFFIX = 'search';

let userinfo;

window.addEventListener('load', async () => {
    // パラメータ
    searchParams = Object.fromEntries(new URL(window.location).searchParams);

    bg = await browser.runtime.getBackgroundPage();
    // private browsing mode
    if (!bg) return;
    fg = await browser.windows.getCurrent();

    // session restore
    if (!bg.initialized) browser.windows.remove(fg.id);

    window.addEventListener('unload', () => {
        TwitSideModule.windows.removeReceiver(fg.id);
        // カラムリセット
        TwitSideModule.ManageColumns.reset(UI._win_type);
    });

    TwitSideModule = bg.TwitSideModule;
    // session restore
    if (!TwitSideModule.ManageWindows.getOpenerId(SUFFIX)) browser.windows.remove(fg.id);

    localization();
    buttonize(['.ts-btn, .tweetRetweeterImage'], commandExec);
    vivify();

    // UI初期化
    UI.initialize(TwitSideModule.WINDOW_TYPE.SEARCH);

    // search
    initialize();
    if (searchParams.keyword) showTweets();
});

// add other event listener
const vivify = () => {
    // キーワード入力ボックス
    $('#keyword')
        .on('keypress', keypressSearchbox);
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
        .on('click','.tweetThumbnailImage', showPhotos); // サムネイル
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
    // 自動更新
    $('#autoreload')
        .on('change', function() {
            if (!$('#grayout').hasClass('hidden')) return;
            TwitSideModule.ManageColumns.editColumn(
                0,
                { options : {
                    onstart    : false,
                    autoreload : $(this).prop('checked'),
                    notif      : false,
                    veil       : false
                }},
                UI._win_type
            );
        });
};

// event asignment
const commandExec = (btn) => {
    if (btn.classList.contains('disabled')) return false;

    // identify from id
    switch (btn.id) {

    case 'search':
        return searchTweets();

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
    case btn.classList.contains('addColumnButton'):
        return onClickAddSearch2Column();

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
    // 検索
    if (e && e.key == 'Enter') {
        searchTweets();
    }
    return true;
};


/**
 * Panel operation
 */
const initialize = () => {
    userinfo = TwitSideModule.ManageUsers.getUserInfo(searchParams.userid);

    $('#keyword').focus();
};

// 検索実施
const searchTweets = async () => {
    const keyword = $('#keyword').val();
    // キーワード
    if (!keyword) return;

    TwitSideModule.ManageWindows.openWindow('search', {
        userid     : userinfo.user_id,
        keyword    : keyword,
        autoreload : $('#autoreload').prop('checked')
    }, TwitSideModule.ManageWindows.getOpenerId(SUFFIX));
};

// 結果表示
const showTweets = async () => {
    const keyword    = searchParams.keyword,
          autoreload = searchParams.autoreload;

    // 検索ボックス
    $('#keyword').val(keyword);
    $('#autoreload').prop('checked', autoreload == 'true');

    // 検索ミュート
    const mute = TwitSideModule.config.getPref('mute_onsearch');

    /**
     * 検索タイムライン
     */
    await TwitSideModule.ManageColumns.addColumn(
        TwitSideModule.TL_TYPE.TEMP_SEARCH,
        '', userinfo.user_id,
        { onstart    : false,
          autoreload : autoreload == 'true',
          notif      : false,
          veil       : false },
        { q          : keyword },
        UI._win_type, 0
    );

    // 準備完了
    $('#grayout').addClass('d-none');

    loadNewer(0);
};


/**
 * Column operation
 */
// visible column index
const getColumnIndex = () => {
    return [0];
};

// ダミー
const changeTweetUser = () => {
    return true;
};

// ダミー
const changeColumn = () => {
    return true;
};

const onClickAddSearch2Column = async () => {
    const columninfo = TwitSideModule.ManageColumns.getColumnInfo(0, null, UI._win_type);

    await TwitSideModule.ManageColumns.addColumn(
        TwitSideModule.TL_TYPE.SEARCH,
        browser.i18n.getMessage('column_search') + ': ' + columninfo.parameters.q,
        userinfo.user_id,
        columninfo.options,
        columninfo.parameters,
        TwitSideModule.WINDOW_TYPE.MAIN
    );

    UI.showMessage(TwitSideModule.Message.transMessage('columnAdded'));
};
