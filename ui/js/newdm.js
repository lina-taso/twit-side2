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
      LIMIT_NEWDM_TERM = 86400,
      MAX_IMAGES        = 1,
      MAX_ANIGIFS       = 1,
      MAX_VIDEOS        = 1,
      MAX_SIZE_IMAGE    = 5 * 1024 * 1024,
      MAX_SIZE_ANIGIF   = 15 * 1024 * 1024,
      MAX_SIZE_VIDEO    = 512 * 1024 * 1024;


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

    // newdm
    initialize();
});

// add other event listener
const vivify = () => {
    // 宛先
    $('#recipientScreenname')
        .on('keyup', function(e) { suggestScreenname($('#recipientScreenname'), $('#suggestContainer'), e); })
        .on('keydown', keypressRecipient)
        .on('paste drop blur', function(e) {
            setTimeout(() => {
                if ($('#suggestContainer').is(':focus')) return;
                hideSuggest($('#suggestContainer'));
                checkScreenname(this.value)
                    .then(countNewTweet)
                    .catch(() => { $('#tweetButton').addClass('disabled'); });
            }, 100);
        });
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
        })
        .on('blur', function() {
            setTimeout(() => {
                if ($('#recipientScreenname').is(':focus')) return;
                checkScreenname($('#recipientScreenname').val())
                    .then(countNewTweet)
                    .catch(() => { $('#tweetButton').addClass('disabled'); });
            }, 100);
        });
    // 入力ボックス
    $('#newTweet')
        .on('keyup focus', countNewTweet)
        .on('keydown', keypressNewTweet);
    // ファイル選択
    $('#filepicker')
        .on('change', function() {
            pickedFile(this);
        });
    // ファイルキャンセル
    $('#pictureThumbnails')
        .on('click', '> div', function() {
            cancelFile(this);
        });
};

// event asignment
const commandExec = (btn) => {
    if (btn.classList.contains('disabled')) return false;

    // identify from id
    switch (btn.id) {
    case 'sharePicture':
        return openFile();
    case 'tweetButton':
        return sendTweet();
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
    $('#tweetUserSelection')
        .on('input', function() {
            $('#profileOwnImage').css('background-image', 'url(' + this.selectedOptions[0].dataset.image + ')');
        });

    // ツイートユーザ
    const all_userinfo = TwitSideModule.ManageUsers.getUserInfo();
    UI.updateTweetUserSelection($('#tweetUserSelection'), $('#templateContainer > .tweetUserOption'), all_userinfo);

    changeTweetUser(searchParams.userid);
    if (searchParams.recipient) {
        $('#recipientScreenname').val(searchParams.recipient);
        checkScreenname(searchParams.recipient)
            .then(countNewTweet)
            .catch(() => { $('#tweetButton').addClass('disabled'); });
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

    // TODO:configurationを取得
    const warn = 20,
          $newTweetCount = $('#newTweetCount'),
          $newTweet      = $('#newTweet'),
          $tweetButton   = $('#tweetButton'),
          count          = twttr.txt.parseTweet($newTweet.val()).weightedLength,
          status         = $('#screennameCheck').attr('data-status');

    // 文字数
    $newTweetCount.text((TWEET_MAX_LENGTH - count).toString() + '/' + TWEET_MAX_LENGTH);
    if (count > TWEET_MAX_LENGTH) {
        $newTweetCount.addClass('badge-danger').removeClass('badge-success badge-warning');
        $tweetButton.addClass('disabled');
    }
    else if (count > TWEET_MAX_LENGTH - warn) {
        $newTweetCount.addClass('badge-warning').removeClass('badge-success badge-danger');
        status == 'checkok' && $tweetButton.removeClass('disabled');
    }
    else if (count > 0) {
        $newTweetCount.addClass('badge-success').removeClass('badge-warning badge-danger');
        status == 'checkok' && $tweetButton.removeClass('disabled');
    }
    else {
        $newTweetCount.addClass('badge-success').removeClass('badge-warning badge-danger');
        if ($('#pictureThumbnails').children().length == 0)
            $tweetButton.addClass('disabled');
        else
            status == 'checkok' && $tweetButton.removeClass('disabled');
    }

    return false;
};

const keypressNewTweet = (e) => {
    e = e.originalEvent;

    // ツイート
    if (e && e.ctrlKey && e.key == 'Enter') {
        if (!$('#tweetButton').hasClass('disabled')) {
            UI.confirm(browser.i18n.getMessage('confirmMessage'),
                       sendTweet,
                       TwitSideModule.config.getPref('confirm_tweet'));
            return true;
        }
    }
    return true;
};

const keypressRecipient = (e) => {
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

// メッセージ送信
const sendTweet = async () => {
    const afterTweet = () => {
        showProgressbar(100);
        UI.showMessage(TwitSideModule.Message.transMessage('dmSent'));
        $newTweet.val('');
        countNewTweet();
        cancelAllFile();

        // 回数制限
        while (limitHistory.length >= LIMIT_NEWDM_CNT) limitHistory.shift();
        limitHistory.push(TwitSideModule.text.getUnixTime());
        TwitSideModule.config.setPref('limit_newdm', JSON.stringify(limitHistory));
    };
    const error = (result) => {
        showProgressbar(100);
        $tweetButton.removeClass('disabled');
        UI.showMessage(TwitSideModule.Message.transMessage(result));
        return Promise.reject();
    };

    // 回数制限
    const limitHistory = JSON.parse(TwitSideModule.config.getPref('limit_newdm'));
    if (!TwitSideModule.config.debug
        && limitHistory.length >= LIMIT_NEWDM_CNT
        && TwitSideModule.text.getUnixTime() - (limitHistory[0] || 0) < LIMIT_NEWDM_TERM) {
        UI.showMessage(TwitSideModule.Message.transMessage('newdmLimit'));
        return;
    }

    const userid           = $('#tweetUserSelection').val(),
          $tweetButton     = $('#tweetButton'),
          $newTweet        = $('#newTweet'),
          optionsHashImage = {},
          files            = [];

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
    // 画像
    if ($('#pictureThumbnails').attr('data-mode')) {
        $('#pictureThumbnails').children().each(function() {
            files.push(this.file);
        });
        // 画像/GIF/動画
        optionsHashImage.media_category = $('#pictureThumbnails').attr('data-mode');
    }

    $tweetButton.addClass('disabled');

    // 通常ツイート
    if (!files.length) {
        await (new Tweet(TwitSideModule.ManageUsers.getUserInfo(userid))).dmNew2(optionsHash).catch(error);
        afterTweet();
    }
    // 画像付きツイート
    else {
        const result = await (new Tweet(TwitSideModule.ManageUsers.getUserInfo(userid))).upload_media(
            optionsHashImage, files, showProgressbar
        ).catch(error);
        optionsHash.event.message_create.message_data.attachment = {
            type : 'media',
            media : { id : result.media_ids }
        };
        await (new Tweet(TwitSideModule.ManageUsers.getUserInfo(userid))).dmNew2(optionsHash).catch(error);
        afterTweet();
    }
};

const openFile = () => {
    $('#filepicker').click();
};

const pickedFile = async (filepicker) => {
    if (!filepicker.files.length) return;

    const filetypeError = () => {
        UI.showMessage(browser.i18n.getMessage('messageUploadType'));
        closeFile();
    };
    const filesizeError = (type) => {
        switch (type) {
        case 'image':
            UI.showMessage(browser.i18n.getMessage('messageUploadFilesizeImages'));
            break;
        case 'gif':
            UI.showMessage(browser.i18n.getMessage('messageUploadFilesizeAniGifs'));
            break;
        case 'video':
            UI.showMessage(browser.i18n.getMessage('messageUploadFilesizeVideos'));
            break;
        }
        closeFile();
    };
    const closeFile = () => {
        URL.revokeObjectURL(file);
        filepicker.value = null;
    };

    const $thumbnails = $('#pictureThumbnails'),
          file        = filepicker.files[0],
          url         = URL.createObjectURL(file);

    // gif フラグ
    const anigif_flag = file.type === 'image/gif'
          && await(async () => {
              const file_buf = await file.arrayBuffer(),
                    file_arr = new Uint8Array(file_buf);
              let i, len,
                  frames = 0,
                  length = file_arr.length;

              for (i=0, len = length - 3; i < len && frames < 2; ++i) {
                  if (file_arr[i] === 0x00 && file_arr[i+1] === 0x21 && file_arr[i+2] === 0xF9) {
                      let blocklength = file_arr[i+3];
                      let afterblock = i + 4 + blocklength;
                      if (afterblock + 1 < length &&
                          file_arr[afterblock] === 0x00 &&
                          (file_arr[afterblock+1] === 0x2C || file_arr[afterblock+1] === 0x21)) {
                          frames++;
                      }
                  }
              }
              // 2以上ならanimation GIF
              return frames > 1;
          })() || null;

    // ファイルサイズチェック
    const filesizeError_flag = (() => {
        switch (file.type) {
        case 'image/png':
        case 'image/jpeg':
            if (file.size > MAX_SIZE_IMAGE)
                return 'image';
            break;
        case 'image/gif':
            if (!anigif_flag && file.size > MAX_SIZE_IMAGE)
                return 'image';
            else if (anigif_flag && file.size > MAX_SIZE_ANIGIF)
                return 'gif';
            break;
        case 'video/mp4':
            if (file.size > MAX_SIZE_VIDEO)
                return 'video';
            break;
        }
        return null;
    })();

    // 種別チェック
    const filetypeError_flag = (() => {
        switch ($thumbnails.attr('data-mode')) {
        case '':
            break;
        case 'tweet_image':
            return !(new RegExp('image/(png|jpeg)')).test(file.type) && anigif_flag !== false;
        case 'tweet_gif':
            return !anigif_flag;
        case 'tweet_video':
            return file.type !== 'video/mp4';
        }
        return null;
    })();

    // エラーメッセージ
    if (filesizeError_flag) {
        filesizeError(filesizeError_flag);
        return;
    }
    else if (filetypeError_flag) {
        filetypeError();
        return;
    }
    // アップロードファイルへ登録
    else if (file.type !== 'video/mp4')
        $('<div class="rounded" />').css('background-image', 'url(' + url + ')').attr({
            title    : file.name,
            tabindex : 1
        })
        .appendTo($thumbnails)[0].file = file;
    else
        $('<div />').attr({
            title    : file.name,
            tabindex : 1
        })
        .append(
            $('<video />').append(
                $('<source />').attr({ src : url, type : file.type })))
        .appendTo($thumbnails)[0].file = file;

    closeFile();
    countNewTweet();

    // ステータス変更・枚数チェック
    switch (file.type) {
    case 'image/png':
    case 'image/jpeg':
        // モード変更
        $thumbnails.attr('data-mode', 'dm_image');
        // 最大枚数
        if ($thumbnails.children().length >= MAX_IMAGES)
            $('#sharePicture').addClass('disabled');
        break;
    case 'image/gif':
        // 静止画GIF
        if (!anigif_flag) {
            // モード変更
            $thumbnails.attr('data-mode', 'dm_image');
            // 最大枚数
            if ($thumbnails.children().length >= MAX_IMAGES)
                $('#sharePicture').addClass('disabled');
        }
        // アニメーションGIF
        else {
            // モード変更
            $thumbnails.attr('data-mode', 'dm_gif');
            // 最大枚数
            if (anigif_flag && $thumbnails.children().length >= MAX_ANIGIFS)
                $('#sharePicture').addClass('disabled');
        }
        break;
    case 'video/mp4':
        // モード変更
        $thumbnails.attr('data-mode', 'dm_video');
        // 最大枚数
        if ($thumbnails.children().length >= MAX_VIDEOS)
            $('#sharePicture').addClass('disabled');
        break;
    }
};

const cancelFile = (file) => {
    $('#sharePicture').removeClass('disabled');
    $(file).remove();

    if ($('#pictureThumbnails').children().length == 0) {
        // ステータスアイコン
        $('.attachmentStatus').addClass('disabled');
        // モード変更
        $('#pictureThumbnails').removeAttr('data-mode');
    }
    countNewTweet();
};

const cancelAllFile = () => {
    $('#sharePicture').removeClass('disabled');
    $('#pictureThumbnails').empty();

    // ステータスアイコン
    $('.attachmentStatus').addClass('disabled');
    // モード変更
    $('#pictureThumbnails').removeAttr('data-mode');

    countNewTweet();
};


/**
 * Tweet operation
 */
// change screenname list
const changeTweetUser = (userid) => {
    $('#tweetUserSelection').val(userid).trigger('input');
};
