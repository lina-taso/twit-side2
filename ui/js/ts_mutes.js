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
    buttonize(['.ts-btn'], commandExec);
    vivify();

    // UI初期化
    UI.setStyleSheets();

    // noretweet
    initialize();
    showMutes();
});

// add other event listener
const vivify = () => {
    // 正規表現チェック
    $('#muteKeyword')
        .on('keyup paste drop blur', function() {
            if ($('#muteKeywordRegexp').is(':checked'))
                checkRegexp();
            else
                checkKeyword();
        });
    // スクリーンネーム
    $('#muteScreenname')
        .on('keyup', function(e) { suggestScreenname($('#muteScreenname'), $('#suggestContainer'), e); })
        .on('keydown', keypressScreenname)
        .on('paste drop blur', function() {
            setTimeout(() => {
                if ($('#suggestContainer').is(':focus')) return;
                hideSuggest($('#suggestContainer'));
                checkScreenname(this.value)
                    .then(() => { $('#okButton').removeClass('disabled'); })
                    .catch(() => { $('#okButton').addClass('disabled'); });
            }, 100);
        });
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
                checkScreenname($('#muteScreenname').val())
                    .then(() => { $('#okButton').removeClass('disabled'); })
                    .catch(() => { $('#okButton').addClass('disabled'); });
            }, 100);
        });
    // 排他処理
    $('input[type="radio"][name="muteType"], #muteKeywordRegexp')
        .on('change', checkboxControl);
    // ミュート追加コンテナ
    $('#addMuteContainer')
        .on('shown.bs.modal', function() {
            $('#muteTypeKeyword').focus();
        });
    // フォーム送信しない
    $('#addMuteForm')
        .on('submit', function() {
            onAcceptForAddMute();
            return false;
        });
};

// event asignment
const commandExec = (btn) => {
    if (btn.classList.contains('disabled')) return false;

    // identify from id
    switch (btn.id) {
    case 'addButton':
        return onClickAddMute();
//    case '':
//        break;
    }

    // identify from class
    switch (true) {
    case btn.classList.contains('removeButton'):
        onClickRemoveMute(btn);
        break;
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

    const all_m_keywords = TwitSideModule.Mutes.muteKeywords;
    const all_m_users    = TwitSideModule.Mutes.muteUsers;
    const lookup         = [];

    // Users
    for (let idx in all_m_users) {
        const user      = all_m_users[idx],
              $listItem = $('#templateContainer > .muteListRow').clone().attr('data-userid', user.userid);

        // userid確認
        const userinfo = TwitSideModule.Friends.searchFriendFromId(user.userid);
        if (userinfo)
            $listItem.children().eq(0).attr('title', '@' + userinfo.screen_name);
        else
            lookup.push(user.userid);

        if (user.until)
            $listItem.children().eq(1).attr('title', TwitSideModule.text.convertTimeStamp(
                new Date(user.until * 1000),
                TwitSideModule.config.getPref('time_locale'),
                TwitSideModule.text.createTimeformat())
            );
        else
            $listItem.children().eq(1).attr('title', browser.i18n.getMessage('tsMutesInf'));

        $listItem.children().eq(2).remove();
        $listItem.appendTo($muteUsersList);
    }

    // async userid lookup
    if (lookup.length) {
        const result = await TwitSideModule.Friends.lookup(lookup, new Tweet(
            TwitSideModule.ManageUsers.getUserInfo(TwitSideModule.ManageUsers.allUserid[0])
        ));
        for (let user of result.data) {
            TwitSideModule.Friends.updateLatestFriends(user);
            $muteUsersList.children('[data-userid=' + user.id_str + ']').children('td:eq(0)')
                .attr('title', '@' + user.screen_name);
        }
    }

    // Keywords
    for (let idx in all_m_keywords) {
        const keyword   = all_m_keywords[idx],
              $listItem = $('#templateContainer .muteListRow').clone();

        $listItem.children().eq(0).attr('title', keyword.data);
        $listItem.children().eq(1).attr('title', browser.i18n.getMessage('tsMutesType' + keyword.type));

        if (keyword.until) {
            $listItem.children().eq(2).attr('title', TwitSideModule.text.convertTimeStamp(
                new Date(keyword.until * 1000),
                TwitSideModule.config.getPref('time_locale'),
                TwitSideModule.text.createTimeformat()
            ));
        }
        else
            $listItem.children().eq(2).attr('title', browser.i18n.getMessage('tsMutesInf'));

        $listItem.appendTo($muteKeywordsList);
    }
};

// ミュートの追加
const onClickAddMute = async () => {
    resetAddMuteC();
    $('#addMuteContainer').modal('show');
};

// ミュートの削除
const onClickRemoveMute = async (btn) => {
    const type       = $('.tab-pane.active.show')[0].id,
          $container = $('#mute' + type + 'Container');

    const index = $(btn).closest('tr').index();
    if (index < 0) return;

    UI.confirm(browser.i18n.getMessage('confirmDeleteTsMute'),
               async () => {
                   switch (type) {
                   case 'Keywords':
                       await TwitSideModule.Mutes.removeMuteKeyword(index);
                       UI.showMessage(TwitSideModule.Message.transMessage('muteKeywordDeleted'));
                       break;
                   case 'Users':
                       await TwitSideModule.Mutes.removeMuteUser(index);
                       UI.showMessage(TwitSideModule.Message.transMessage('muteUserDeleted'));
                       break;
                   }

                   showMutes();
               },
               TwitSideModule.config.getPref('confirm_deletemute'));
};

// ミュート追加コンテナリセット
const resetAddMuteC = () => {
    $('#muteKeyword').val('');
    $('#muteScreenname').val('')
    checkScreenname('');
    $('#okButton').addClass('disabled');
    $('#muteTypeKeyword').prop('checked', true);
    $('#muteKeywordRegexp').prop('checked', false);
    $('#muteTerm').val('0');

    checkboxControl();
    checkRegexp();
};

// ボタンの排他処理
const checkboxControl = () => {
    // keyword
    if ($('[name=muteType]:checked').val() == 'Keyword') {
        $('#muteKeywordTypeBox, #muteKeywordBox').removeClass('d-none');
        $('#muteScreennameBox').addClass('d-none');
        $('#muteKeyword').attr('required', '');
        $('#muteScreenname').removeAttr('required');

        if ($('#muteKeywordRegexp').is(':checked'))
            $('#keywordCheck').removeClass('d-none');
        else
            $('#keywordCheck').addClass('d-none');
    }
    // screenname
    else {
        $('#muteKeywordTypeBox, #muteKeywordBox').addClass('d-none');
        $('#muteScreennameBox').removeClass('d-none');
        $('#muteKeyword').removeAttr('required');
        $('#muteScreenname').attr('required', '');
    }
};

const keypressScreenname = (e) => {
    e = e.originalEvent;

    // サジェスト
    if (e && !e.shiftKey && e.key == 'Tab' || e && e.key == 'ArrowDown') {
        if ($('#suggestContainer').is(':visible')) {
            setTimeout(() => {$('#suggestContainer').focus(); }, 0);
            return false;
        }
    }
    return true;
};

const checkKeyword = () => {
    $('#okButton').toggleClass('disabled', $('#muteKeyword').val() == '');
};

const checkRegexp = () => {
    const $okButton    = $('#okButton'),
          $check       = $('#keywordCheck');

    // 未入力
    if (!$('#muteKeyword').val()) {
        $check.attr('data-status', 'unchecked');
        $okButton.addClass('disabled');
        return;
    }

    try {
        let re = new RegExp($('#muteKeyword').val());
        $check.attr('data-status', 'checkok');
        $okButton.removeClass('disabled');
    }
    catch (e) {
        // regular expression error
        $check.attr('data-status', 'checkng');
        $okButton.addClass('disabled');
    }
};


/**
 * Mute operation
 */
const onAcceptForAddMute = async () => {
    const term = parseInt($('#muteTerm').val());

    switch ($('[name=muteType]:checked').val()) {
    case 'Keyword':
        const regexp = $('#muteKeywordRegexp').is(':checked');
        await TwitSideModule.Mutes.addMuteKeyword(
            regexp,
            $('#muteKeyword').val(),
            term == 0 ? null : TwitSideModule.text.getUnixTime() + term
        );
        UI.showMessage(TwitSideModule.Message.transMessage('muteKeywordAdded'));
        break;
    case 'User':
        // 正規化スクリーンネーム
        const screenname = (/^@?(\S+)\s*$/.exec($('#muteScreenname').val()))[0];
        const result = TwitSideModule.Friends.searchFriendFromSn(screenname);

        await TwitSideModule.Mutes.addMuteUser(
            result.id_str,
            term == 0 ? null : TwitSideModule.text.getUnixTime() + term
        );
        UI.showMessage(TwitSideModule.Message.transMessage('muteUserAdded'));
        break;
    }

    showMutes();
    $('#addMuteContainer').modal('hide');
};
