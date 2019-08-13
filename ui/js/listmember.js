/**
 * @fileOverview listmember content script
 * @name listmember.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

let bg, fg, searchParams, TwitSideModule;

const SUFFIX = 'listmember';

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
    buttonize(['.buttonItem', '.tweetMoreBox'], commandExec);
    vivify();

    // UI初期化
    UI.initialize(TwitSideModule.WINDOW_TYPE.LISTMEMBER);

    // listmember
    initialize();
    if (searchParams.listid) showListMembers();

    window.addEventListener('beforeunload', () => {
        TwitSideModule.windows.removeReceiver(fg.id);
        // カラムリセット
        TwitSideModule.ManageColumns.reset(UI._win_type);
    });
});

// add other event listener
const vivify = () => {
    // カラムコンテナ
    $('#columnContainer')
        .keypress(keyeventChangeFocus)
        .on('focus', '.column',
            function(e) {
                UI.setActiveColumn($(this));
            })
        .on('focus', '.timelineBox > .tweetBox',
            function(e) {
                e.stopPropagation();
                UI.setActiveBox($(this));
            });
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

    case 'closeButton':
        window.close();
        break;
//    case '':
//        break;
    }

    // identify from class
    switch (true) {

    case btn.classList.contains('toTopButton'): // columnMenuBox
        timelineMove('top');
        break;
    case btn.classList.contains('toBottomButton'):
        timelineMove('bottom');
        break;
    case btn.classList.contains('updateButton'):
        loadNewer(getColumnIndexFromBox(btn));
        break;

    case btn.classList.contains('tweetMoreBox'): // tweetBox
        loadMore(btn);
        break;
//    case btn.classList.contains(''):
//        break;
    }
};


/**
 * Panel operation
 */
const initialize = () => {
    // 型変換
    searchParams.tl_type = parseInt(searchParams.tl_type);

    // タイトル
    switch (searchParams.tl_type) {
    case TwitSideModule.TL_TYPE.TEMP_LISTMEMBER:
        document.title = browser.i18n.getMessage('windowListmemberTitle');
        break;
    case TwitSideModule.TL_TYPE.TEMP_LISTSUBSCRIBER:
        document.title = browser.i18n.getMessage('windowListsubscriberTitle');
        break;
    }
    userinfo = TwitSideModule.ManageUsers.getUserInfo(searchParams.userid);
};

const showListMembers = async() => {
    document.body.dataset.ownList = searchParams.own_list;

    /**
     * リストメンバータイムライン
     */
    await TwitSideModule.ManageColumns.addColumn(
        searchParams.tl_type,
        '', userinfo.user_id,
        { onstart    : false,
          autoreload : false,
          notif      : false,
          veil       : false },
        { list_id    : searchParams.listid },
        UI._win_type, 0
    );

    loadNewer(0);
};


/**
 * Tweet operation
 */
// ダミー
const changeTweetUser = (userid) => {
    return true;
};
