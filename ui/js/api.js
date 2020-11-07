/**
 * @fileOverview api content script
 * @name api.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

let bg, fg, searchParams, TwitSideModule;

const SUFFIX = 'api';

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
    UI.setStyleSheets();

    // noretweet
    initialize();
    showApi();
});

// add other event listener
const vivify = () => {
};

// event asignment
const commandExec = (btn) => {
    if (btn.classList.contains('disabled')) return false;

    // identify from id
    switch (btn.id) {
    case 'closeButton':
        return window.close();
//    case '':
//        break;
    }

    // identify from class
    switch (true) {
//    case btn.classList.contains(''):
//        break;
    }
};


/**
 * Panel operation
 */
const initialize = () => {
};

const showApi = async () => {
    const error = (result) => {
        showLoadingProgressbar(false);
        UI.showMessage(result.message, result.text_flag);
        return Promise.reject();
    };

    // 読み込み中
    showLoadingProgressbar(true);
    const result = await new Tweet(TwitSideModule.ManageUsers.getUserInfo(searchParams.userid))
          .showAPI({}).catch(error);
    showLoadingProgressbar(false);

    const data     = result.data,
          $apiBody = $('#apiBody'),
          now      = new Date(),
          reset    = new Date();

    for (let category in data) {
        if (category == 'rate_limit_context') continue;

        for (let path in data[category]) {
            const $apiPathRow = $('#templateContainer > .apiPathRow').clone();
            $apiPathRow.children().eq(0).text(path);
            $apiBody.append($apiPathRow);

            for (let api in data[category][path]) {
                const $apiRow = $('#templateContainer > .apiRow').clone();
                reset.setTime(data[category][path][api].reset * 1000);

                $apiRow.children().eq(0).text(api);
                $apiRow.children().eq(1).text(data[category][path][api].remaining);
                $apiRow.children().eq(2).text(data[category][path][api].limit);
                $apiRow.children().eq(3).text(
                    browser.i18n.getMessage(
                        'apiReset_timeleft', parseInt((reset - now) / 1000)
                    )
                );
                $apiRow.children().eq(4).text(
                    TwitSideModule.text.convertTimeStamp(
                        reset,
                        TwitSideModule.config.getPref('time_locale'),
                        TwitSideModule.text.createTimeformat())
                );

                $apiBody.append($apiRow);
            }
        }
    }
};
