/**
 * @fileOverview newdm content script
 * @name newdm.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

let bg, fg, searchParams, TwitSideModule;

const SUFFIX = 'newdm',
      TWEET_MAX_LENGTH = 10000,
      LIMIT_NEWDM_CNT  = 50,
      LIMIT_NEWDM_TERM = 86400;

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

    // newdm
    initialize();
});

// add other event listener
const vivify = () => {
    // 宛先
    $('#recipientScreenname')
        .on('keyup focus', keyupRecipient)
        .on('keydown', keypressRecipient);
    $('#suggestContainer')
        .on('click', 'option', function() {
            suggestOnSelect(false, $('#recipientScreenname'), $('#suggestContainer'));
            return false;
        })
        .on('focus', 'option', function(e) {
            $(this).parent().focus();
            return false;
        })
        .on('keydown', function(e) {
            suggestOnSelect(e, $('#recipientScreenname'), $('#suggestContainer'), $('#newTweet'));
            return false;
        });
    // 入力ボックス
    $('#newTweet')
        .on('keyup focus', countNewTweet)
        .on('keydown', keypressNewTweet);
};

// event asignment
const commandExec = (btn) => {
    // identify from id
    switch (btn.id) {
    case 'tweetButton':
        sendTweet();
        break;
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
};


/**
 * Panel operation
 */
const initialize = () => {
    // ドロップダウンメニュー
    $('#tweetUserSelection').select2({
        minimumResultsForSearch : Infinity,
        width                   : 'off',
        templateSelection       : (state) => {
            const $i = $('<img class="tweetUserItemImage" />')
                  .attr('src', state.element.dataset.image),
                  $l = $('<span />').text(state.text);
            return $('<span class="tweetUserItemBox" />').append($i, $l);
        }
    });

    UI.updateTweetUserSelection(
        $('#tweetUserSelection'),
        $('#templateContainer .tweetUserOption'),
        TwitSideModule.ManageUsers.getUserInfo()
    );
    changeTweetUser(searchParams.userid);
    if (searchParams.recipient) {
        $('#recipientScreenname').val(searchParams.recipient);
        $('#newTweet').focus();
    }
    else
        $('#recipientScreenname').focus();
};


/**
 * Posting tweet operation
 */
// 新規ツイート文字数カウント
const countNewTweet = (e) => {
    if (e) e = e.originalEvent;

    const warn = 20,
          $newTweetCount = $('#newTweetCount'),
          $newTweet      = $('#newTweet'),
          $tweetButton   = $('#tweetButton'),
          count          = twttr.txt.parseTweet($newTweet.val()).weightedLength;

    // URL
    const urls = twttr.txt.extractUrls($newTweet.val());

    // 文字数
    $newTweetCount.text((TWEET_MAX_LENGTH - count).toString() + '/' + TWEET_MAX_LENGTH);
    if (count > TWEET_MAX_LENGTH) {
        $newTweetCount.attr('data-labelcolor', 'countNg');
        $tweetButton.attr('data-disabled', 'true');
    }
    else if (count > TWEET_MAX_LENGTH - warn) {
        $newTweetCount.attr('data-labelcolor', 'countWarn');
        $tweetButton.attr('data-disabled', 'false');
    }
    else if (count > 0) {
        $newTweetCount.attr('data-labelcolor', 'countOk');
        $tweetButton.attr('data-disabled', 'false');
    }
    else {
        $newTweetCount.attr('data-labelcolor', 'countOk');
        $tweetButton.attr('data-disabled', 'false');
    }

    return false;
};

const keypressNewTweet = (e) => {
    e = e.originalEvent;
    // ツイート
    if (e && e.ctrlKey && e.key == 'Enter') {
        if ($('#tweetButton').attr('data-disabled') == 'false') {
            if (TwitSideModule.config.getPref('confirm_tweet')
                && !confirm(browser.i18n.getMessage('confirmMessage')))
                return true;

            sendTweet();
        }
    }
    return true;
};

const keyupRecipient = (e) => {
    suggestScreenname($('#recipientScreenname'), $('#suggestContainer'));
};

const keypressRecipient = (e) => {
    e = e.originalEvent;
    // サジェスト
    if (e && !e.shiftKey && e.key == 'Tab'
        || e && e.key == 'ArrowDown') {
        if ($('#suggestContainer').is(':visible')) {
            setTimeout(() => {$('#suggestContainer').focus(); }, 0);
            return false;
        }
    }
    return true;
};


// メッセージ送信
const sendTweet = async () => {
    const error = (result) => {
        showProgressbar(100);
        button.dataset.disabled = false;
        UI.showMessage(result.message);
        return Promise.reject();
    };

    // 回数制限
    const limitHistory = JSON.parse(TwitSideModule.config.getPref('limit_newdm'));
    if (!TwitSideModule.config.debug
        && limitHistory.length >= LIMIT_NEWDM_CNT
        && TwitSideModule.text.getUnixTime() - (limitHistory[0] || 0) < LIMIT_NEWDM_TERM) {
        UI.showMessage(browser.i18n.getMessage('newdmLimit'));
        return;
    }

    const userid    = $('#tweetUserSelection')[0].selectedOptions[0].value,
          button    = $('#tweetButton')[0],
          $newTweet = $('#newTweet');

    button.dataset.disabled = true;

    // get recipient user id
    const result_usershow = await (new Tweet(TwitSideModule.ManageUsers.getUserInfo(userid))).userShow({
        screen_name : $('#recipientScreenname').val()
    }).catch(error);

    const optionsHash = {
        event : {
            type           : "message_create",
            message_create : {
                target       : { recipient_id : result_usershow.data.id_str },
                message_data : { text : $('#newTweet').val() }
            }
        }
    };

    await (new Tweet(TwitSideModule.ManageUsers.getUserInfo(userid)))
        .dmNew2(optionsHash).catch(error);

    showProgressbar(100);
    UI.showMessage(TwitSideModule.Message.transMessage('dmSent'));
    $newTweet.val('');
    countNewTweet();

    // 回数制限
    while (limitHistory.length >= LIMIT_NEWDM_CNT) limitHistory.shift();

    limitHistory.push(TwitSideModule.text.getUnixTime());
    TwitSideModule.config.setPref('limit_newdm', JSON.stringify(limitHistory));
};


/**
 * Tweet operation
 */
// change screenname list
const changeTweetUser = (userid) => {
    $('#tweetUserSelection').select2('val', [userid]);
};
