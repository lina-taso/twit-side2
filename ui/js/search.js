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
    UI.initialize(TwitSideModule.WINDOW_TYPE.SEARCH);

    // search
    initialize();
    if (searchParams.keyword) showTweets();

    window.addEventListener('beforeunload', () => {
        TwitSideModule.windows.removeReceiver(fg.id);
        // カラムリセット
        TwitSideModule.ManageColumns.reset(UI._win_type);
    });
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
            // 影
            $(this).siblings('.columnShadowBox')
                .height(this.scrollTop < 10 ? this.scrollTop : 10);

            // オートページャ
            if (this.scrollHeight - this.clientHeight - 200 < this.scrollTop
                && TwitSideModule.config.getPref('autopager')) {
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
    // identify from id
    switch (btn.id) {

    case 'search':
        searchTweets();
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
    case btn.classList.contains('addColumnButton'):
        onClickAddSearch2Column();
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

const showTweets = async () => {
    const keyword    = searchParams.keyword,
          autoreload = searchParams.autoreload;

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
    $('#grayout').toggleClass('hidden', true);

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
