/**
 * @fileOverview columns content script
 * @name ts_mutes.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

let bg, fg, searchParams, TwitSideModule;

const SUFFIX = 'ts_mutes';

let originalIndex;

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
    showMutes();
});

// add other event listener
const vivify = () => {
    // スクリーンネーム
    $('#muteScreenname')
        .on('keyup focus', keyupScreenname)
        .on('keydown', keypressScreenname);
    $('#suggestContainer')
        .on('click', 'option', function() {
            suggestOnSelect(false, $('#muteScreenname'), $('#suggestContainer'));
            return false;
        })
        .on('focus', 'option', function(e) {
            $(this).parent().focus();
            return false;
        })
        .on('keydown', function(e) {
            suggestOnSelect(e, $('#muteScreenname'), $('#suggestContainer'), $('#newTweet'));
            return false;
        })
        .on('blur', function() {
            setTimeout(() => {
                if ($('#muteScreenname').is(':focus')) return;
                checkScreenname();
            }, 100);
        });

    // 行アクティブ
    $('#muteKeywordsBody, #muteUsersBody')
        .on('click focus', '.muteListRow', function() {
            $(this).attr('data-selected', 'true')
                .siblings().attr('data-selected', '');
        });
    // 排他処理
    $('input[type="radio"][name="muteType"]')
        .on('change', checkboxControl);
    $('input[type="radio"][name="muteKeywordType"]')
        .on('change', checkboxControl);
    // スクリーンネームチェック
    $('#muteScreenname')
        .on('blur', function() {
            setTimeout(() => {
                if ($('#suggestContainer').is(':focus')) return;
                checkScreenname();
            }, 100);
        });
    // 正規表現チェック
    $('#muteKeyword')
        .on('blur', function() {
            if ($('#muteKeywordTypeRegexp').prop('checked'))
                checkRegexp();
            else
                checkKeyword();
        });
};

// event asignment
const commandExec = (btn) => {
    // identify from id
    switch (btn.id) {
    case 'muteKeywordsButton':
        $('#mainContainer').attr('data-mutetype', 'Keywords');
        break;
    case 'muteUsersButton':
        $('#mainContainer').attr('data-mutetype', 'Users');
        break;
    case 'addButton':
        onClickAddMute();
        break;
    case 'removeButton':
        onClickRemoveMute();
        break;
    case 'closeButton':
        window.close();
        break;
    case 'closeAddMuteC':
    case 'cancelButton':
        addMuteContainerToggle(false);
        break;
    case 'okButton':
        onAcceptForAddMute();
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
};

const showMutes = async (focus) => {
    const $muteKeywordsList = $('#muteKeywordsBody'),
          $muteUsersList    = $('#muteUsersBody');

    // 初期化
    $muteKeywordsList.empty();
    $muteUsersList.empty();

    // フォーカスを外す
    $muteKeywordsList.children().attr('data-selected', 'false');
    $muteUsersList.children().attr('data-selected', 'false');

    const all_m_keywords = TwitSideModule.Mutes.muteKeywords;
    const all_m_users    = TwitSideModule.Mutes.muteUsers;
    const lookup         = [];

    // Users
    for (let idx in all_m_users) {
        const user      = all_m_users[idx],
              $listItem = $('#templateContainer .muteListRow').clone().attr('data-userid', user.userid);

        // userid確認
        const userinfo = TwitSideModule.Friends.searchFriendFromId(user.userid);
        if (userinfo)
            $('<td>').attr('title', '@' + userinfo.screen_name).appendTo($listItem);
        else {
            $('<td>').appendTo($listItem);
            lookup.push(user.userid);
        }

        if (user.until) {
            $('<td>').attr('title', TwitSideModule.text.convertTimeStamp(
                new Date(user.until * 1000),
                TwitSideModule.config.getPref('time_locale'),
                TwitSideModule.text.createTimeformat()
            )).appendTo($listItem);
        }
        else
            $('<td>').attr('title', browser.i18n.getMessage('tsMutesInf')).appendTo($listItem);

        $listItem.appendTo($muteUsersList);
    }

    // async userid lookup
    if (lookup.length)
        TwitSideModule.Friends.lookup(lookup, new Tweet(
            TwitSideModule.ManageUsers.getUserInfo(TwitSideModule.ManageUsers.allUserid[0])
        )).then(result => {
            for (let user of result.data) {
                TwitSideModule.Friends.updateLatestFriends(user);
                $muteUsersList.children('[data-userid=' + user.id_str + ']').children('td:eq(0)')
                    .attr('title', '@' + user.screen_name);
            }
        });

    // Keywords
    for (let idx in all_m_keywords) {
        const keyword   = all_m_keywords[idx],
              $listItem = $('#templateContainer .muteListRow').clone();

        $('<td>').attr('title', keyword.data).appendTo($listItem);
        $('<td>').attr('title', browser.i18n.getMessage('tsMutesType' + keyword.type)).appendTo($listItem);

        if (keyword.until) {
            $('<td>').attr('title', TwitSideModule.text.convertTimeStamp(
                new Date(keyword.until * 1000),
                TwitSideModule.config.getPref('time_locale'),
                TwitSideModule.text.createTimeformat()
            )).appendTo($listItem);
        }
        else
            $('<td>').attr('title', browser.i18n.getMessage('tsMutesInf')).appendTo($listItem);

        $listItem.appendTo($muteKeywordsList);
    }
};

const addMuteContainerToggle = (open) => {
    $('#addMuteContainer').attr('data-open', open);
    if (open) $('#muteTypeKeyword').focus();
};

// ミュートの追加
const onClickAddMute = async () => {
    resetAddMuteC();
    addMuteContainerToggle(true);
};

// ミュートの削除
const onClickRemoveMute = async () => {
    const type       = $('#mainContainer').attr('data-mutetype'),
          $container = $('#mute' + type + 'Container');

    const index = $container.find('.muteListRow[data-selected="true"]').index();
    if (index < 0) return;

    if (TwitSideModule.config.getPref('confirm_deletetsmute')
        && !confirm(browser.i18n.getMessage('confirmDeleteTsMute')))
        return;

    switch (type) {
    case 'Keywords':
        await TwitSideModule.Mutes.removeMuteKeyword(index);
        break;
    case 'Users':
        await TwitSideModule.Mutes.removeMuteUser(index);
        break;
    }

    showMutes();
};

// ミュート追加コンテナリセット
const resetAddMuteC = () => {
    // リセット
    $('#muteKeyword').val('');
    $('#muteScreenname').val('');
    $('#muteTypeKeyword').prop('checked', true);
    $('#muteKeywordTypeText').prop('checked', true);

    $('#okButton').removeAttr('data-disabled');
    checkboxControl();
    checkScreenname();
    checkRegexp();
};

// ボタンの排他処理
const checkboxControl = () => {
    if ($('[name=muteType]:checked').val() == 'Keyword') {
        $('#muteKeywordTypeBox').css('display', '');
        $('#muteScreennameBox').css('display', 'none');
        $('#muteKeywordBox').css('display', '');

        if ($('[name=muteKeywordType]:checked').val() == 'Text')
            $('#keywordCheck').css('display', 'none');
        else
            $('#keywordCheck').css('display', '');
    }
    else {
        $('#muteKeywordTypeBox').css('display', 'none');
        $('#muteScreennameBox').css('display', '');
        $('#muteKeywordBox').css('display', 'none');
    }
};

const keyupScreenname = (e) => {
    suggestScreenname($('#muteScreenname'), $('#suggestContainer'));
};

const keypressScreenname = (e) => {
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

const checkScreenname = async () => {
    const $okButton = $('#okButton'),
          $check    = $('#screennameCheck');

    // 未入力
    if (!$('#muteScreenname').val()) {
        $check.attr('data-status', 'unchecked');
        $okButton.attr('data-disabled', true);
        return;
    }
    // 正規化スクリーンネーム
    const screenname = (/^@?(\S+)\s*$/.exec($('#muteScreenname').val()))[0];

    const result = TwitSideModule.Friends.searchFriendFromSn(screenname);
    // 結果あり（latestfriends）
    if (result) {
        $check.attr('data-status', 'checkok');
        $okButton.removeAttr('data-disabled');
    }
    else {
        // 読み込み中
        $check.attr('data-status', 'loading');
        // lookup
        const result_usershow = await (new Tweet(
            TwitSideModule.ManageUsers.getUserInfo(TwitSideModule.ManageUsers.allUserid[0])
        )).userShow({ screen_name : screenname })
              .then((result) => {
                  TwitSideModule.Friends.updateLatestFriends(result.data);
                  $check.attr('data-status', 'checkok');
                  $okButton.removeAttr('data-disabled');
              })
              .catch(() => {
                  $check.attr('data-status', 'checkng');
                  $okButton.attr('data-disabled', true);
              });
    }
};

const checkKeyword = () => {
    $('#okButton').attr('data-disabled', !$('#muteKeyword').val());
};

const checkRegexp = () => {
    const $okButton    = $('#okButton'),
          $check       = $('#keywordCheck');

    // 未入力
    if (!$('#muteKeyword').val()) {
        $check.attr('data-status', 'unchecked');
        $okButton.attr('data-disabled', true);
        return;
    }

    try {
        let re = new RegExp($('#muteKeyword').val());
        $check.attr('data-status', 'checkok');
        $okButton.removeAttr('data-disabled');
    }
    catch (e) {
        // regular expression error
        $check.attr('data-status', 'checkng');
        $okButton.attr('data-disabled', 'true');
    }
};


/**
 * Mute operation
 */
const onAcceptForAddMute = async () => {
    const type        = $('[name=muteType]:checked').val(),
          keywordType = $('[name=muteKeywordType]:checked').val(),
          term        = parseInt($('[name=muteTermOption]:selected').val());

    if (type == 'Keyword') {
        await TwitSideModule.Mutes.addMuteKeyword(
            keywordType,
            $('#muteKeyword').val(),
            term == 0 ? null : TwitSideModule.text.getUnixTime() + term
        );
    }
    else if (type == 'User') {
        // 正規化スクリーンネーム
        const screenname = (/^@?(\S+)\s*$/.exec($('#muteScreenname').val()))[0];
        const result = TwitSideModule.Friends.searchFriendFromSn(screenname);

        await TwitSideModule.Mutes.addMuteUser(
            result.id_str,
            term == 0 ? null : TwitSideModule.text.getUnixTime() + term
        );
    }

    showMutes();
    addMuteContainerToggle(false);
    resetAddMuteC();
};
