/**
 * @fileOverview mute content script
 * @name mute.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

let bg, fg, searchParams, TwitSideModule;

const SUFFIX = 'mute';

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
    buttonize(['.ts-btn'], commandExec);
    vivify();

    // UI初期化
    UI.initialize(TwitSideModule.WINDOW_TYPE.MUTE);

    // noretweet
    initialize();
    showUsers();

    window.addEventListener('beforeunload', () => {
        TwitSideModule.windows.removeReceiver(fg.id);
        // カラムリセット
        TwitSideModule.ManageColumns.reset(UI._win_type);
    });
});

// add other event listener
const vivify = () => {
    $('#tweetUserSelection').on('change', showUsers);

    // カラムコンテナ
    $('#columnContainer')
        .keypress(keyeventChangeFocus)
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

//    case '':
//        break;
    }

    // identify from class
    switch (true) {

    case btn.classList.contains('toTopButton'): // columnMenuBox
        btn.blur();
        return timelineMove('top');
    case btn.classList.contains('toBottomButton'):
        btn.blur();
        return timelineMove('bottom');
    case btn.classList.contains('columnUpdateButton'):
        btn.blur();
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
    changeTweetUser(searchParams.userid);
};

const showUsers = async () => {
    // カラム初期化
    await TwitSideModule.ManageColumns.reset(UI._win_type);

    // ユーザ
    const ownid = UI.$tweetUserSelection.val();

    /**
     * ミュートタイムライン
     */
    await TwitSideModule.ManageColumns.addColumn(
        TwitSideModule.TL_TYPE.TEMP_MUTE,
        '', ownid,
        { onstart    : false,
          autoreload : false,
          notif      : false,
          veil       : false },
        { user_id   : ownid },
        UI._win_type, 0
    );

    loadNewer(0);
};

// ユーザ削除（ミュート）
const onClickDestroyMuteUser = (tweetBox) => {
    const boxid = tweetBox.id.replace(/^[a-zA-Z]{5}_/, ''); // columnidを除去

    UI.confirm(browser.i18n.getMessage('confirmUnmute'),
               () => {
                   TwitSideModule.ManageColumns.getTimelineInfo(
                       getColumnIndexFromBox(tweetBox),
                       'timeline',
                       UI._win_type
                   ).destroy(boxid);
               },
               TwitSideModule.config.getPref('confirm_mute'));
};


/**
 * Tweet operation
 */
// change screenname list
const changeTweetUser = (userid) => {
    if (userid == null) return; // _makeColumn
    UI.$tweetUserSelection.val(userid).trigger('input');
};
