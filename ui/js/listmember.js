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

    window.addEventListener('unload', () => {
        TwitSideModule.windows.removeReceiver(fg.id);
        // カラムリセット
        TwitSideModule.ManageColumns.reset(UI._win_type);
    });

    TwitSideModule = bg.TwitSideModule;
    // session restore
    if (!TwitSideModule.ManageWindows.getOpenerId(SUFFIX)) browser.windows.remove(fg.id);

    localization();
    buttonize(['.ts-btn'], commandExec);
    vivify();

    // UI初期化
    UI.initialize(TwitSideModule.WINDOW_TYPE.LISTMEMBER);

    // listmember
    initialize();
    if (searchParams.listid) showListMembers();
});

// add other event listener
const vivify = () => {
    // カラムコンテナ
    $('#columnContainer')
        .keypress(keyeventChangeFocus)
        .on('focus', '> .column', function() {
            UI.setActiveColumn($(this));
        })
        .on('focus', '.timelineBox > .tweetBox', function(e) {
            e.stopPropagation();
            UI.setActiveBox($(this));
        });
    // タイムライン
    $('#templateContainer .timelineBox')
        .on('scroll', function() {
            // オートページャ
            if (this.scrollHeight - this.clientHeight - 200 < this.scrollTop
                && TwitSideModule.config.getPref('autopager'))
                loadMore(this.lastChild);
        });
};

// event asignment
const commandExec = (btn) => {
    if (btn.classList.contains('disabled')) return false;

    // identify from id
    switch (btn.id) {
    case 'profileOwnImage':
        return TwitSideModule.ManageWindows.openWindow('profile', {
            userid  : UI.$tweetUserSelection[0].selectedOptions[0].value,
            keyword : UI.$tweetUserSelection[0].selectedOptions[0].textContent,
        }, fg.id);

//    case '':
//        break;
    }

    // identify from class
    switch (true) {

    case btn.classList.contains('toTopButton'): // columnMenuBox
        return timelineMove('top');
    case btn.classList.contains('toBottomButton'):
        return timelineMove('bottom');
    case btn.classList.contains('columnUpdateButton'):
        return loadNewer(getColumnIndexFromBox(btn));

    case btn.classList.contains('tweetMoreBox'): // tweetBox
        return loadMore(btn);
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
        document.title = browser.i18n.getMessage('windowListmemberTitle',
                                                 [searchParams.screenname, searchParams.listname]);
        break;
    case TwitSideModule.TL_TYPE.TEMP_LISTSUBSCRIBER:
        document.title = browser.i18n.getMessage('windowListsubscriberTitle',
                                                 [searchParams.screenname, searchParams.listname]);
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

// ユーザ削除（ミュート、ブロック、リツイート非表示）
const onClickDestroyUser = (tweetBox) => {
    const boxid = tweetBox.id.replace(/^[a-zA-Z]{5}_/, ''); // columnidを除去

    UI.confirm(browser.i18n.getMessage('confirmRemoveUser'),
               () => {
                   TwitSideModule.ManageColumns.getTimelineInfo(
                       0,
                       'timeline',
                       UI._win_type
                   ).destroy(boxid);
               },
               TwitSideModule.config.getPref('confirm_delete'));
};


/**
 * Tweet operation
 */
// ダミー
const changeTweetUser = (userid) => {
    return true;
};
