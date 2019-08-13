/**
 * @fileOverview noretweet content script
 * @name noretweet.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

let bg, fg, searchParams, TwitSideModule;

const SUFFIX = 'noretweet';

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
    buttonize(['.buttonItem'], commandExec);
    vivify();

    // UI初期化
    UI.initialize(TwitSideModule.WINDOW_TYPE.NORETWEET);

    // noretweet
    initialize();
    showNoretweets();

    window.addEventListener('beforeunload', () => {
        TwitSideModule.windows.removeReceiver(fg.id);
        // カラムリセット
        TwitSideModule.ManageColumns.reset(UI._win_type);
    });
});

// add other event listener
const vivify = () => {
    $('#tweetUserSelection').on('select2:select', showNoretweets);
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

const showNoretweets = async () => {
    // カラム初期化
    await TwitSideModule.ManageColumns.reset(UI._win_type);

    // ユーザ
    const ownid = UI.$tweetUserSelection[0].selectedOptions[0].value;

    /**
     * リツイート非表示タイムライン
     */
    await TwitSideModule.ManageColumns.addColumn(
        TwitSideModule.TL_TYPE.TEMP_NORETWEET,
        '', ownid,
        { onstart    : false,
          autoreload : false,
          notif      : false,
          veil       : false },
        { },
        UI._win_type, 0
    );

    loadNewer(0);
};


/**
 * Tweet operation
 */
// change screenname list
const changeTweetUser = (userid) => {
    if (userid == null) return; // _makeColumn
    UI.$tweetUserSelection.select2('val', [userid]);
};
