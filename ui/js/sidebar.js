/**
 * @fileOverview sidebar content script
 * @name sidebar.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

let bg, fg, oauth_token, TwitSideModule;

const COLUMN_TAB_WIDTH  = 150,
      COLUMN_TAB_MARGIN = 2, // horizontal margin
      HELP_URL          = 'https://www2.filewo.net/wordpress/%e8%a3%bd%e4%bd%9c%e7%89%a9/'
      + 'twit-side-%e8%aa%ac%e6%98%8e%e6%9b%b8/',
      TWITTER_AUTH_URL  = 'https://api.twitter.com/oauth/authorize',
      TWEET_MAX_LENGTH  = 280,
      MAX_IMAGES        = 4,
      MAX_ANIGIFS       = 1,
      MAX_VIDEOS        = 1,
      MAX_SIZE_IMAGE    = 5 * 1024 * 1024,
      MAX_SIZE_ANIGIF   = 15 * 1024 * 1024,
      MAX_SIZE_VIDEO    = 512 * 1024 * 1024,
      LOADWAIT          = 1000;

const cursor = { x:null, y:null };

window.addEventListener('load', async () => {

    bg = await browser.runtime.getBackgroundPage();
    // private browsing mode
    if (!bg) return;
    fg = await browser.windows.getCurrent();
    // if this is not normal window (such as panel)
    if (fg.type != 'normal') return;

    // waiting for loading background script
    if (!bg.initialized) {
        await (new Promise((resolve, reject) => {
            let i = 0;
            const interval = setInterval(() => {
                if (bg.initialized) {
                    clearInterval(interval);
                    resolve();
                }
                i++;
                if (i == 10) {
                    clearInterval(interval);
                    reject();
                }
            }, LOADWAIT);
        }));
    }
    $('#loading').addClass('hidden');

    TwitSideModule = bg.TwitSideModule;

    localization();
    buttonize(['.buttonItem', '.menuItem', '.notifItem',
               '.tweetRetweeterImage', '.tweetMoreBox',
               '.clearRepliesBox', '.tweetMenuButton'],
              commandExec);
    vivify();

    // UI初期化
    UI.initialize(TwitSideModule.WINDOW_TYPE.MAIN);

    // チュートリアル
    if (TwitSideModule.config.getPref('tutorial'))
        runTutorial();
    // ユーザ無し
    else if (!TwitSideModule.ManageUsers.allUserid.length)
        newUserContainerToggle(true);

    // 初期化
    newTweetContainerToggle(
        TwitSideModule.config.getPref('newtweet_pinned'),
        TwitSideModule.config.getPref('newtweet_pinned')
    );

    window.addEventListener('unload', () => {
        TwitSideModule.windows.removeReceiver(fg.id);
    });
});

// add other event listener
const vivify = () => {
    $(window).resize(() => {
        // TODO horizontal resize
        $('#mainContainer').scrollLeft(0);
        calcColumns();
        scrollColumns();
    });
    $('#pin').on('click keyup paste drop', () => { setTimeout(checkPinBox, 100); });

    // 入力ボックス
    $('#newTweet')
        .on('keyup focus', countNewTweet)
        .on('keydown', keypressNewTweet);
    $('#suggestContainer')
        .on('click', 'option', function() {
            suggestOnSelect(null, $('#newTweet'), $('#suggestContainer'));
            return false;
        })
        .on('focus', 'option', function() {
            $(this).parent().focus();
            return false;
        })
        .on('keydown', function(e) {
            suggestOnSelect(e, $('#newTweet'), $('#suggestContainer'), $('#tweetButton'));
            return false;
        });
    $('#replyUsersSelection')
        .on('click', '.replyUser:gt(0)', toggleReplyUser);
    // メインコンテナ
    $('#mainContainer')
        .on('scroll', function() {
            if (this.timer) { clearTimeout(this.timer); }
            this.timer = setTimeout(scrollColumns, 150);
        })
        .on('mousedown', function(e) {
            cursor.x = e.originalEvent.clientX;
        })
        .on('mouseup', function() {
            if (cursor.x != null) cursor.x = null;
        })
        .on('mousemove', function(e) {
            // 前のカーソル位置
            if (!cursor.x) return;
            // ドラッグされていない
            if (e.originalEvent.buttons == 0) {
                $(this).mouseup();
                return;
            }
            const dx = cursor.x - e.originalEvent.clientX;
            cursor.x = e.originalEvent.clientX;
            UI.$mainC.scrollLeft(UI.$mainC.scrollLeft() + dx * 2);
        });
    // カラムコンテナ
    $('#columnContainer')
        .keypress(keyeventChangeFocus)
        .on('focus', '.column', function() {
            UI.setActiveColumn($(this));
        })
        .on('focus', '.timelineBox > .tweetBox', function(e) {
            e.stopPropagation();
            UI.setActiveBox($(this));
        })
        .on('click','.tweetThumbnailImage', showPhotos); // サムネイル
    // タイムライン
    $('#templateContainer .timelineBox')
        .on('scroll', function() {
            // 影
            $(this).siblings('.columnShadowBox')
                .height(this.scrollTop < 10 ? this.scrollTop : 10);

            // 最上部
            if (this.scrollTop == 0) {
                if (this.parentNode.dataset.top == 'false')
                    this.parentNode.dataset.top = true;
            }
            else {
                if (this.parentNode.dataset.top == 'true')
                    this.parentNode.dataset.top = false;
                // オートページャ
                if (this.scrollHeight - this.clientHeight - 200 < this.scrollTop
                    && TwitSideModule.config.getPref('autopager'))
                    loadMore(this.lastChild);
            }
        });
    // カラムタブ
    $('#columnTabContainer')
        .mousemove(scrollColumnTabC)
        .hover(hoverColumnTabC, unhoverColumnTabC)
        .on('mouseenter', '.columnTab', hoverColumnTab)
        .on('mouseout', '.columnTab', function() {
            UI.$columnTabC.find('.columnTab').removeClass('hoverTab');
        })
        .on('click', '.columnTab', function(ptr) {
            const idx = $(this).index();
            UI.setActiveColumn(UI.$columnC.children().eq(idx));
            scrollColumns(idx, true, ptr);
        });
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
    // グレーアウト
    $('#grayout').on('click', function() {
        leftContainerToggle(false);
        notifContainerToggle(false);
    });
}

// event asignment
const commandExec = (btn) => {
    // identify from id
    switch (btn.id) {

    case 'openLeftC': // topMenuContainer
        return leftContainerToggle(true);
    case 'openNewTweetC':
        return newTweetContainerToggle(true, false);
    case 'sharePicture': // newTweetContainer
        return openFile();
    case 'sharePage':
        return sharePage();
    case 'unpinNewTweetC':
        return newTweetContainerToggle(false, false);
    case 'pinNewTweetC':
        return newTweetContainerToggle(true, true);
    case 'closeNewTweetC':
        return newTweetContainerToggle(false, false);
    case 'tweetButton':
        return sendTweet();
    case 'clearRefButton':
        return clearTweetRef();
    case 'closeLeftC': // leftContainer
        return leftContainerToggle(false);
    case 'openNotifC':
        return notifContainerToggle(true);
    case 'menuProfile':
        leftContainerToggle(false);
        return TwitSideModule.ManageWindows.openWindow('profile', {
            userid : UI.$tweetUserSelection[0].selectedOptions[0].value
        }, fg.id);
    case 'menuSearch':
        leftContainerToggle(false);
        return TwitSideModule.ManageWindows.openWindow('search', {
            userid : UI.$tweetUserSelection[0].selectedOptions[0].value
        }, fg.id);
    case 'menuLogin':
        leftContainerToggle(false);
        return newUserContainerToggle(true);
    case 'menuManageColumns':
        leftContainerToggle(false);
        return TwitSideModule.ManageWindows.openWindow('columns', {}, fg.id);
    case 'menuManageTsMutes':
        leftContainerToggle(false);
        return TwitSideModule.ManageWindows.openWindow('ts_mutes', {}, fg.id);
    case 'menuPreferences':
        leftContainerToggle(false);
        return browser.runtime.openOptionsPage();
    case 'menuHelp':
        leftContainerToggle(false);
        return openURL(HELP_URL);
    case 'menuLogout':
        leftContainerToggle(false);
        return onClickLogout();
    case 'closeNotifC': // notifContainer
        return notifContainerToggle(false);
    case 'clearNotif':
        return clearNotifications();
    case 'clearNotifNext':
        return clearNotificationsNext();
    case 'closeNewUserC': // newUserContainer
        return newUserContainerToggle(false);
    case 'request':
        return onClickRequest();
    case 'access':
        return onClickAccess();
        //    case '':
        //        break;
    }

    // identify from class
    switch (true) {
    case btn.classList.contains('menuProfileItem'):
        leftContainerToggle(false);
        return TwitSideModule.ManageWindows.openWindow('profile', {
            userid  : btn.dataset.userid,
            keyword : btn.dataset.screenname
        }, fg.id);
    case btn.classList.contains('clearRepliesBox'): // column
        return clearAllReplies(btn);

    case btn.classList.contains('toTopButton'): // columnMenuBox
        return timelineMove('top');
    case btn.classList.contains('toBottomButton'):
        return timelineMove('bottom');
    case btn.classList.contains('updateButton'):
        return loadNewer(getColumnIndexFromBox(btn));
    case btn.classList.contains('newListButton'):
        return null;
    case btn.classList.contains('newDmButton'):
        return TwitSideModule.ManageWindows.openWindow('newdm', {
            userid : UI.getActiveColumn().attr('data-userid')
        }, fg.id);
    case btn.classList.contains('addColumnButton'):
        return null;

    case btn.classList.contains('tweetMoreBox'): // tweetBox
        return loadMore(btn);
    case btn.classList.contains('clearReplyButton'):
        return clearReplies(btn);
    case btn.classList.contains('tweetRetweeterImage'):
        return onClickRetweeterImage(btn);
    case btn.classList.contains('tweetMenuButton'):
        return UI.getTweetMenuFunc(
            UI.getActiveColumn().attr('data-column-type'),
            $(btn).index())(btn);

    case btn.classList.contains('notifItem'): // notifContainer
        return clearNotifications(btn);

        //    case btn.classList.contains(''):
        //        break;
    }
    return null;
};

const runTutorial = () => {
    leftContainerToggle(true);
    $('#menuHelp').addClass('blink')
        .delay(6000).queue(function() {
            $(this).removeClass('blink');
        });

    TwitSideModule.config.setPref('tutorial', false);
};


/**
 * Panel operation
 */
const leftContainerToggle = (open) => {
    $('#leftContainer')[0].dataset.open = open;
    $('#grayout').toggleClass('hidden', !open);
};

const notifContainerToggle = (open) => {
    $('#notifContainer')[0].dataset.open = open;
    $('#leftContainer')[0].dataset.open = false;
    $('#grayout').toggleClass('hidden', !open);
};

const newTweetContainerToggle = async (open, pin) => {
    let pinned = TwitSideModule.config.getPref('newtweet_pinned');

    // ピン留め指定
    if (pin != null) {
        $('body')[0].dataset.newtweetPinned = pin;
        if (pinned != pin) {
            await TwitSideModule.config.setPref('newtweet_pinned', pin);
            pinned = pin;
        }
    }
    pinned
        ? $('#newTweetContainer')[0].dataset.open = true
        : $('#newTweetContainer')[0].dataset.open = open;

    if (open) $('#newTweet').focus();
};

const newUserContainerToggle = (open) => {
    $('#newUserContainer')[0].dataset.open = open;
    if (!open) {
        // Clear temporary value
        oauth_token = null;
        $('#pin').val('');
        checkPinBox();
    }
};


/**
 * Posting tweet operation
 */
// 新規ツイート文字数カウント
const countNewTweet = (e) => {
    const $suggest = $('#suggestContainer');
    if (e) e = e.originalEvent;

    // TODO:configurationを取得
    const warn           = 20,
          $newTweetCount = $('#newTweetCount'),
          $newTweet      = $('#newTweet'),
          $tweetButton   = $('#tweetButton'),
          count          = twttr.txt.parseTweet($newTweet.val()).weightedLength;

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
        if ($newTweet.attr('data-reply-id') == ''
            && $newTweet.attr('data-attachment-url') == ''
            && $('#pictureThumbnails').children().length == 0)
            $tweetButton.attr('data-disabled', 'true');
        else
            $tweetButton.attr('data-disabled', 'false');
    }

    suggestScreenname($newTweet, $suggest);
    return false;
};

const keypressNewTweet = (e) => {
    e = e.originalEvent;

    // サジェスト
    if (e && !e.shiftKey && e.key == 'Tab'
        || e && e.key == 'ArrowDown') {
        if ($('#suggestContainer').is(':visible')) {
            setTimeout(() => {$('#suggestContainer').focus(); }, 0);
            return false;
        }
    }
    // ツイート
    else if (e && e.ctrlKey && e.key == 'Enter') {
        if ($('#tweetButton').attr('data-disabled') == 'false') {
            if (TwitSideModule.config.getPref('confirm_tweet')
                && !confirm(browser.i18n.getMessage('confirmTweet'))) return true;

            sendTweet();
        }
    }
    return true;
};

// ツイート送信
const sendTweet = async () => {
    const afterTweet = () => {
        showProgressbar(100);
        UI.showMessage(TwitSideModule.Message.transMessage('tweetSent'));
        $newTweet.val('');
        countNewTweet();
        cancelAllFile();
        clearTweetRef();
        newTweetContainerToggle(false);

        // ツイート後ツイートユーザタイムライン読み込み
        if (TwitSideModule.config.getPref('autoreload_aftertweet')) {
            const indexes = TwitSideModule.ManageColumns.searchColumn({
                userid  : userid,
                tl_type : TwitSideModule.TL_TYPE.TIMELINE
            },TwitSideModule.WINDOW_TYPE.MAIN);

            for (let i of indexes) loadNewer(i);
        }
    };
    const error = (result) => {
        showProgressbar(100);
        button.dataset.disabled = false;
        UI.showMessage(TwitSideModule.Message.transMessage(result));
        return Promise.reject();
    };

    const userid           = UI.$tweetUserSelection[0].selectedOptions[0].value,
          button           = $('#tweetButton')[0],
          $newTweet        = $('#newTweet'),
          optionsHash      = { status : $newTweet.val() },
          optionsHashImage = {},
          files            = [];

    // 返信
    if ($newTweet.attr('data-reply-id')) {
        optionsHash.in_reply_to_status_id        = $newTweet.attr('data-reply-id');
        optionsHash.auto_populate_reply_metadata = true;
        // 返信除外
        const noreply = [];
        $('#replyUsersSelection').children('.replyUser[data-reply="false"]').each(function() {
            noreply.push(this.dataset.userid);
        });
        optionsHash.exclude_reply_user_ids = noreply.join(',');
    }
    // 引用
    if ($newTweet.attr('data-attachment-url')) {
        optionsHash.attachment_url = $newTweet.attr('data-attachment-url');
    }
    // 画像
    else if ($('#pictureThumbnails').attr('data-mode')) {
        $('#pictureThumbnails').children().each(function() {
            files.push(this.file);
        });
        // 画像/GIF/動画
        optionsHashImage.media_category = $('#pictureThumbnails').attr('data-mode');
    }

    button.dataset.disabled = true;
    // 通常ツイート
    if (!files.length) {
        await (new Tweet(TwitSideModule.ManageUsers.getUserInfo(userid))).tweet(optionsHash).catch(error);
        afterTweet();
    }
    // 画像付きツイート
    else {
        const result = await (new Tweet(TwitSideModule.ManageUsers.getUserInfo(userid))).upload_media(
            optionsHashImage, files, showProgressbar
        ).catch(error);
        optionsHash.media_ids = result.media_ids;
        await (new Tweet(TwitSideModule.ManageUsers.getUserInfo(userid))).tweet(optionsHash).catch(error);
        afterTweet();
    }
};

const openFile = () => {
    $('#filepicker').click();
};

const pickedFile = (filepicker) => {
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
          ? confirm(browser.i18n.getMessage('confirmAniGif')) : null;

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
        $('<div tabindex="1" />').css('background-image', 'url(' + url + ')')
        .appendTo($thumbnails)[0].file = file;
    else
        $('<div tabindex="1" />').append(
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
        $thumbnails.attr('data-mode', 'tweet_image');
        // ステータスアイコン
        $('#imageEnabled').attr('data-enabled', true)
            .siblings('.attachmentStatus').attr('data-enabled', false);
        // 最大枚数
        if ($thumbnails.children().length >= MAX_IMAGES)
            $('#sharePicture').attr('data-disabled', true);
        break;
    case 'image/gif':
        // 静止画GIF
        if (!anigif_flag) {
            // モード変更
            $thumbnails.attr('data-mode', 'tweet_image');
            // ステータスアイコン
            $('#imageEnabled').attr('data-enabled', true)
                .siblings('.attachmentStatus').attr('data-enabled', false);
            // 最大枚数
            if ($thumbnails.children().length >= MAX_IMAGES)
                $('#sharePicture').attr('data-disabled', true);
        }
        // アニメーションGIF
        else {
            // モード変更
            $thumbnails.attr('data-mode', 'tweet_gif');
            // ステータスアイコン
            $('#anigifEnabled').attr('data-enabled', true)
                .siblings('.attachmentStatus').attr('data-enabled', false);
            // 最大枚数
            if (anigif_flag && $thumbnails.children().length >= MAX_ANIGIFS)
                $('#sharePicture').attr('data-disabled', true);
        }
        break;
    case 'video/mp4':
        // モード変更
        $thumbnails.attr('data-mode', 'tweet_video');
        // ステータスアイコン
        $('#videoEnabled').attr('data-enabled', true)
            .siblings('.attachmentStatus').attr('data-enabled', false);
        // 最大枚数
        if ($thumbnails.children().length >= MAX_VIDEOS)
            $('#sharePicture').attr('data-disabled', true);
        break;
    }
};

const cancelFile = (file) => {
    $('#sharePicture').attr('data-disabled', 'false');
    $(file).remove();

    if ($('#pictureThumbnails').children().length == 0) {
        // ステータスアイコン
        $('.attachmentStatus').attr('data-enabled', false);
        // モード変更
        $('#pictureThumbnails').attr('data-mode', '');
    }
    countNewTweet();
};

const cancelAllFile = () => {
    $('#sharePicture').attr('data-disabled', 'false');
    $('#pictureThumbnails').empty();

    // ステータスアイコン
    $('.attachmentStatus').attr('data-enabled', false);
    // モード変更
    $('#pictureThumbnails').attr('data-mode', '');

    countNewTweet();
};

const sharePage = () => {
    const $newTweet = $('#newTweet');

    browser.tabs.query({ active : true, windowId : fg.id }).then((tabs) => {
        newTweetContainerToggle(true);
        $newTweet.val(tabs[0].title + '\n' + tabs[0].url);
        $newTweet.focus();
        $newTweet[0].setSelectionRange(0, 0);
    });
};

const toggleReplyUser = (e) => {
    const user = e.target;
    user.dataset.reply = user.dataset.reply == 'false';
};

// 返信・引用ツイート非表示
const clearTweetRef = () => {
    $('#replyUsersSelection, #refTweetBox').empty();
    $('#refTweetContainer').attr('data-type', '');
    $('#newTweet').attr({
        'data-attachment-url' : '',
        'data-reply-id'       : ''
    });
    countNewTweet();
};


/**
 * Column operation
 */
// visible column index
const getColumnIndex = () => {
    const ret   = [],
          // 一画面に表示するカラム数
          count = parseInt(UI.$columnC.attr('data-count'));

    for (let i=0; i<count; i++)
        ret.push(parseInt(UI.$columnC.attr('data-first')) + i);

    return ret;
};

// scroll snap
const scrollColumns = (index_int, edge, ptr) => {
    UI.$mainC.stop(true, true);

    const now          = UI.$mainC.scrollLeft(),
          $columns     = UI.$columnC.children(),
          count        = $columns.length,
          columnsCount = parseInt(UI.$columnC.attr('data-count'));
    let left  = 0,
        right = null;

    // index_intの値がおかしい場合
    if (index_int && (index_int < 0 || index_int >= count))
        return;

    // 自動スクロールイベント（スクロールの最後に必ず実行される）
    if (index_int == null) {
        let start = 0;
        for (start; start < count; start++) {
            const offsetleft = $columns.eq(start).position().left + now;
            now >= offsetleft
                ? left = offsetleft
                : right = offsetleft;
            if (right) break;
        }
        // 右端
        if (right == null) right = left;
        // 右移動
        if (now - left > right - now) left = right;
        // 左移動
        else start--;

        // 移動後カラムタブ
        UI.$columnC.attr('data-first', start);
        colorColumnTab();
        // 移動
        UI.$mainC.animate({
            scrollLeft : left
        }, 200, 'swing', () => {
            // 移動後のフォーカス
            const focus = (() => {
                const columnIndexes = getColumnIndex();
                // より左
                if (UI.getActiveColumn().index() < columnIndexes[0])
                    return columnIndexes[0];
                // より右
                else if (UI.getActiveColumn().index() > columnIndexes[columnIndexes.length - 1])
                    return columnIndexes[columnIndexes.length - 1];
                // 表示内
                else return -1;
            })();
            if (focus >= 0)
                UI.getActiveBox(UI.$columnC.children().eq(focus)).focus();
            else
                UI.getActiveBox().focus();
        });
    }
    // 移動先指定（移動必要）
    else {
        if (edge)
            left = $columns.eq(index_int).position().left + now;
        else if (getColumnIndex().indexOf(index_int) < 0) {
            left = $columns.eq(
                index_int < getColumnIndex()[0]
                    ? index_int
                    : index_int - columnsCount + 1
            ).position().left + now;
        }
        // 移動無し、フォーカスのみ
        else {
            UI.getActiveBox().focus();
            return;
        }
        // 移動
        UI.$mainC.animate({
            scrollLeft : left
        }, 100, 'swing').queue(() => {
            // カラムタブクリック時
            if (ptr && UI.$columnTabC.attr('data-hover') == 'true')
                scrollColumnTabC(ptr);
        });
    }
};

// Adjust column's width
const calcColumns = () => {
    const winWidth = window.innerWidth,
          minWidth = TwitSideModule.config.getPref('column_minwidth'),
          len      = UI.$columnC.children().length;

    const count = (() => {
        const c = Math.floor(winWidth / minWidth);
        if (c < 1) return 1;
        else if (c > len) return len;
        else return c;
    })();

    // タイムラインコンテナ＋カラムタブの幅
    //    UI.$mainC.css('scroll-snap-points-x', 'repeat( calc( 100vw / ' + count + ' )' );
    UI.$columnC.attr('data-count', count)
        .children().css('width', 'calc(100vw / ' + count + ')');
    UI.$columnTabC.children().css('width',
                                  'calc(100vw / ' + count + ' - ' + COLUMN_TAB_MARGIN + 'px )');
};

const hoverColumnTabC = () => {
    if (UI.$columnTabC.timer) clearTimeout(UI.$columnTabC.timer);
    if (UI.$columnTabC[0].dataset.hover == 'true') return;

    UI.$columnTabC.timer = setTimeout(() => {
        // 動作中アニメーション停止
        if (UI.$columnTabC[0].style.transition != '')
            UI.$columnTabC.off('transitionend').css({ transition : '' });

        const count     = UI.$columnTabC.children().length,
              winWidth  = window.innerWidth;
        let tabWidth  = COLUMN_TAB_WIDTH - COLUMN_TAB_MARGIN,
            tabCWidth = COLUMN_TAB_WIDTH * count;

        // ウィンドウが大きいときは等分
        if (winWidth > count * COLUMN_TAB_WIDTH) {
            tabWidth = winWidth / count - COLUMN_TAB_MARGIN;
            tabCWidth = winWidth;
        }
        // 画面上の位置を固定
        UI.$columnC.css('margin-top', UI.$columnTabC.height());
        UI.$columnTabC.attr('data-hover', true).css({
            width    : tabCWidth,
            position : 'fixed'
        }).children().css({ width : tabWidth });
    }, 200);
};

const unhoverColumnTabC = () => {
    if (UI.$columnTabC.timer) clearTimeout(UI.$columnTabC.timer);
    if (UI.$columnTabC[0].dataset.hover != 'true') return;

    UI.$columnTabC.timer = setTimeout(() => {
        // 一旦margin-leftを調整
        UI.$columnTabC.attr('data-hover', false).css({
            width      : '',
            transition : ''
        });
        // タブ幅を戻す
        setTimeout(() => {
            UI.$columnTabC.css({
                transition : 'margin-left 0.4s ease 0s',
                marginLeft : -1 * $('#mainContainer').scrollLeft()
            }).on('transitionend', function() {
                $(this).css({
                    transition : '',
                    position   : '',
                    marginLeft : 0
                }).off('transitionend');
                // 画面上の位置固定を解除
                UI.$columnC.css('margin-top', 0);
                // カラムタブ初期化
                calcColumns();
            }).children().css({
                width : UI.$columnC.children().width() - COLUMN_TAB_MARGIN
            });
        }, 0);
    }, 600);
};

// adjust margin-left on mouse hovering
const scrollColumnTabC = (ptr) => {
    const count     = UI.$columnTabC.children().length,
          winWidth  = window.innerWidth;
    let tabWidth  = COLUMN_TAB_WIDTH - COLUMN_TAB_MARGIN,
        tabCWidth = COLUMN_TAB_WIDTH * count,
        margin    = 0;

    // ウィンドウの方が大きい
    if (winWidth > count * COLUMN_TAB_WIDTH) {
        tabWidth = winWidth / count - COLUMN_TAB_MARGIN;
        tabCWidth = winWidth;
        margin = 0;
    }
    // タブの方が大きい
    else
        margin = (ptr.clientX + 1) * (winWidth - tabCWidth) / winWidth;

    if (UI.$columnTabC[0].dataset.hover == 'true')
        UI.$columnTabC.css({ marginLeft : margin });
};

// color hovering column tab
const hoverColumnTab = (e) => {
    const $tab         = $(e.target),
          columnsCount = parseInt(UI.$columnC.attr('data-count')),
          count        = UI.$columnC.children().length,
          index        = parseInt($tab.index());

    UI.$columnTabC.children().removeClass('hoverTab');
    // マウス位置が表示カラムタブ左端よりも左側
    if (index + columnsCount < count) {
        for (let i=index; i<index+columnsCount; i++)
            UI.$columnTabC.children().eq(i).addClass('hoverTab');
    }
    // マウス位置が表示カラムタブ左端よりも右側
    else {
        for (let i=-1; i>-1-columnsCount; i--)
            UI.$columnTabC.children().eq(i).addClass('hoverTab');
    }
};

// カラムタブの色（現在表示中）
const colorColumnTab = () => {
    // 表示中のカラム番号一覧
    const indexes = getColumnIndex();

    UI.$columnTabC.children().removeClass('displayTab');
    for (let i=0; i<indexes.length; i++) {
        UI.$columnTabC.children().eq(indexes[i]).addClass('displayTab');
    }
};


/**
 * Tweet operation
 */
// change screenname list
const changeTweetUser = (userid) => {
    // userid未指定
    if (userid == null) userid = UI.getActiveColumn().attr('data-userid');
    UI.$tweetUserSelection.select2('val', [userid]);
};


/**
 * Authorization
 */
const onClickRequest = async () => {
    const error = (result) => {
        UI.showMessage(result.message, result.text_flag);
        return Promise.reject();
    };
    // リクエスト送信
    const result = await (new Tweet()).request().catch(error);
    // store tokens
    oauth_token = result.userinfo;

    // タブで開く
    const tab = await openURL(result.url);
};

const onClickAccess = async () => {
    const error = (result) => {
        UI.showMessage(result.message, result.text_flag);
        return Promise.reject();
    };

    const $pin = $('#pin');

    if ($pin.val().length != 7) {
        UI.showMessage(TwitSideModule.Message.transMessage('enterPinNumber'));
        return;
    }

    // アクセス送信
    const oauth_hash = await (new Tweet(oauth_token)).access($pin.val()).catch(error);

    newUserContainerToggle(false);

    // ユーザー作成
    await TwitSideModule.ManageUsers.addUser(oauth_hash);
    const count = TwitSideModule.ManageUsers.allUserid.length;

    // 1ユーザ目：初期カラム作成（3つ）
    if (count == 1) {
        await TwitSideModule.ManageColumns.addColumn(
            TwitSideModule.TL_TYPE.TIMELINE,
            TwitSideModule.text.makeDefaultColumnlabel(
                TwitSideModule.TL_TYPE.TIMELINE,
                '@' + oauth_hash.screen_name
            ),
            oauth_hash.user_id,
            { onstart    : true,
              autoreload : true,
              notif      : true,
              veil       : false },
            null
        );

        await TwitSideModule.ManageColumns.addColumn(
            TwitSideModule.TL_TYPE.CONNECT,
            TwitSideModule.text.makeDefaultColumnlabel(
                TwitSideModule.TL_TYPE.CONNECT,
                '@' + oauth_hash.screen_name
            ),
            oauth_hash.user_id,
            { onstart    : true,
              autoreload : true,
              notif      : false,
              veil       : false },
            null
        );

        await TwitSideModule.ManageColumns.addColumn(
            TwitSideModule.TL_TYPE.RETWEETED,
            TwitSideModule.text.makeDefaultColumnlabel(
                TwitSideModule.TL_TYPE.RETWEETED,
                '@' + oauth_hash.screen_name
            ),
            oauth_hash.user_id,
            { onstart    : true,
              autoreload : true,
              notif      : false,
              veil       : false },
            null
        );
    }
    // 2ユーザ目以降：タイムラインカラムのみ作成
    else {
        await TwitSideModule.ManageColumns.addColumn(
            TwitSideModule.TL_TYPE.TIMELINE,
            TwitSideModule.text.makeDefaultColumnlabel(
                TwitSideModule.TL_TYPE.TIMELINE,
                '@' + oauth_hash.screen_name
            ),
            oauth_hash.user_id,
            { onstart    : true,
              autoreload : true,
              notif      : true,
              veil       : false },
            null
        );
    }
};

const checkPinBox = () => {
    $('#access')[0].dataset.disabled =
        oauth_token != null && $('#pin').val().length == 7
        ? false : true;
};

// All users logout
const onClickLogout = () => {
    if (!confirm(browser.i18n.getMessage('confirmLogout'))) return;

    // ユーザも一緒にリセット
    TwitSideModule.ManageColumns.reset(TwitSideModule.WINDOW_TYPE.MAIN);
    // ログイン画面
    newUserContainerToggle(true);
};


/**
 * Notification
 */
// Get notifications
const updateNotifications = () => {
    const $notifList     = $('#notifItemList'),
          $notifTemplate = $('#templateContainer .notifItem'),
          $clearButton   = $('#clearNotif'),
          $nextButton    = $('#clearNotifNext');

    // 通知取得
    const notifs = TwitSideModule.Message.getNotifications(),
          count  = notifs.data.length;
    readNotifications(count);

    // 通知クリア
    $notifList.children().remove();

    // 通知情報
    for (let notif of notifs.data) {
        const $notif   = $notifTemplate.clone().attr('id', notif.id),
              userinfo = notif.userinfo;

        // from Twit Side
        if (notif.userid == '-1') {
            $notif.children('.neverNotifyButton')
                .attr('data-notifid', notif.id)
                .on('click', () => {
                    neverNotify(notif.id);
                });
            $notif.find('.notifUserName').text(userinfo.screen_name);
            const $notifUrl = $notif.children('.notifUrl');
            for (let url of notif.urls)
                $('<div />').addClass('text-link')
                .attr('href', url).text(url)
                .on('click', () => { openURL(url); return false; })
                .appendTo($notifUrl);
        }
        else
            $notif.find('.notifUserName').text('@' + userinfo.screen_name);

        $notif.find('.notifUserImage').attr('src', userinfo.profile_image_url);
        $notif.children('.notifTitle').text(notif.title);
        $notif.children('.notifContent').text(notif.content);
        $notif.children('.notifTime').text(
            TwitSideModule.text.convertTimeStamp(
                new Date(notif.datetime * 1000),
                TwitSideModule.config.getPref('time_locale'),
                TwitSideModule.text.createTimeformat()
            ));
        $notif.appendTo($notifList);
    }

    // 通知削除
    $clearButton.text(browser.i18n.getMessage(count ? 'clear_notif' : 'no_notif'));

    // 通知続き
    $nextButton.text(browser.i18n.getMessage('clear_notif_next', notifs.count));
    $nextButton.css('display', notifs.next ? '' : 'none');

    // 通知件数0の時
    if (count == 0 && $('#notifContainer').attr('data-open') == 'true')
        notifContainerToggle(false);
};

// read notifications
const readNotifications = (count) => {
    document.documentElement.dataset.unreadNotif = count != 0;
    $('#openLeftC .badge').text(count);
};

// clear specific / all notifications
const clearNotifications = (notifItem) => {
    TwitSideModule.Message.removeNotifications(notifItem ? [notifItem.id] : null);
};

// clear displayed notifications and show continuations
const clearNotificationsNext = () => {
    const notifIds = [];
    $('#notifItemList').children().each(function() {
        notifIds.push(this.id);
    });
    TwitSideModule.Message.removeNotifications(notifIds);
};

// never notify a message from Twit Side
const neverNotify = (notifid) => {
    const hidden_message = JSON.parse(TwitSideModule.config.getPref('hidden_message'));

    if (hidden_message.indexOf(notifid) >= 0) return;
    hidden_message.push(parseInt(notifid));

    TwitSideModule.config.setPref('hidden_message', JSON.stringify(hidden_message));
};
