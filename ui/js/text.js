/**
 * @fileOverview text content script
 * @name text.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

let bg, fg, searchParams, TwitSideModule;

const SUFFIX = 'text';

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
    UI.setStyleSheets();

    // noretweet
    initialize();
    showText();
});

// add other event listener
function vivify()
{
}

// event asignment
function commandExec(btn)
{
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
//    case btn.classList.contains(''):
//        break;
    }
}


/**
 * Panel operation
 */
const initialize = () => {
};

const showText = () => {
    $('#tweetText').val(searchParams.text).select();
};
