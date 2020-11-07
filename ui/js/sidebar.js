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

    TwitSideModule = bg.TwitSideModule;

    TwitSideModule.timer(1000, () => {
        $('#loading').fadeOut(200).queue(function() { $(this).remove(); });
    });

    localization();
    buttonize(['.ts-btn, .tweetRetweeterImage'], commandExec);
    vivify();

    // UI初期化
    UI.initialize(TwitSideModule.WINDOW_TYPE.MAIN);

    // ユーザ無し
    if (!TwitSideModule.ManageUsers.allUserid.length)
        $('#newUserContainer').modal('show');

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
    // トースト有効化
    $().toast({ });

    $(window).resize(() => {
        // TODO horizontal resize
        calcColumns();
        UI.$columnC.scroll();
    });

    // トップメニュー
    $('#topMenuContainer > .dropdown')
        .on('shown.bs.dropdown', function () {
            $(this).children().addClass('active');
        })
        .on('hidden.bs.dropdown', function () {
            $(this).children().removeClass('active');
        });

    // ユーザ追加コンテナ
    $('#newUserContainer')
        .on('show.bs.modal', function () {
            oauth_token = null;
            $('#pin').val('');
            checkPinBox();
        })
        .on('shown.bs.modal', function() {
            $('#request').focus();
        });
    $('#pin').on('click keyup paste drop', () => { setTimeout(checkPinBox, 100); });

    // #newTweetContainer
    $('#newTweetContainer')
        .on('show.bs.collapse', function() {
            $('#sharePicture, #unpinNewTweetC, #pinNewTweetC').removeClass('d-none');
        })
        .on('hide.bs.collapse', function() {
            $('#sharePicture, #unpinNewTweetC, #pinNewTweetC').addClass('d-none');
        });

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
        .on('click', '.replyUser:gt(0)', function() { $(this).toggleClass('disabled'); });

    // カラムコンテナ
    $('#columnContainer')
        .on('mousedown', function(e) {
            cursor.x = e.originalEvent.clientX;
        })
        .on('mouseup mouseleave', function() {
            cursor.x = null;
        })
        .on('mousemove', function(e) {
            // 前のカーソル位置
            if (!cursor.x) return;
            // ドラッグされていない
            if (e.originalEvent.buttons != 1) {
                $(this).mouseup();
                return;
            }

            // this.classList.add('drag');
            const dx = cursor.x - e.originalEvent.clientX;
            // 右移動
            if (dx > 50) {
                // カーソルリセット
                cursor.x = e.originalEvent.clientX;
                scrollColumns(getColumnIndex().pop()+1);
            }
            // 左移動
            else if (dx < -100) {
                // カーソルリセット
                cursor.x = e.originalEvent.clientX;
                scrollColumns(getColumnIndex().shift()-1);
            }
        })
        .on('scroll', function() {
            changeColumnSpy();
        })
        .keypress(keyeventChangeFocus)
        .on('mouseover', '.columnTab', hoverColumnTab)
        .on('mouseout', '.columnTab', unhoverColumnTab)
        .on('focus', '> .column', function() {
            UI.setActiveColumn($(this));
        })
        .on('focus', '.timelineBox > .tweetBox', function(e) {
            e.stopPropagation();
            UI.setActiveBox($(this));
        })
        .on('click', '.tweetThumbnailImage', showPhotos); // サムネイル
    // タイムライン（scrollイベントは個別指定）
    $('#templateContainer .timelineBox')
        .on('scroll', function() {
            // ドラッグ判定
            if (cursor.x) $(this).mouseup();

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

    // カラムスパイ
    $('#columnSpyContainer')
        .on('click', '.columnSpy', function() {
            scrollColumns($(this).index());
        })
        .on('mouseover', hoverColumnTab)
        .on('mouseout', unhoverColumnTab);

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

    case 'sharePicture': // newTweetContainer
        return openFile();
    case 'sharePage':
        return sharePage();
    case 'unpinNewTweetC':
        return newTweetContainerToggle(false, false);
    case 'pinNewTweetC':
        return newTweetContainerToggle(true, true);
    case 'tweetButton':
        return sendTweet();
    case 'profileOwnImage':
        return TwitSideModule.ManageWindows.openWindow('profile', {
            userid  : UI.$tweetUserSelection.val(),
            keyword : UI.$tweetUserSelection[0].selectedOptions[0].textContent,
        }, fg.id);
    case 'clearRefButton':
        return clearTweetRef();
    case 'menuProfile': // topMenuContainer
        return TwitSideModule.ManageWindows.openWindow('profile', {
            userid : UI.$tweetUserSelection.val()
        }, fg.id);
    case 'menuSearch':
        return TwitSideModule.ManageWindows.openWindow('search', {
            userid : UI.$tweetUserSelection.val()
        }, fg.id);
    case 'menuManageColumns':
        return TwitSideModule.ManageWindows.openWindow('columns', {}, fg.id);
    case 'menuManageTsMutes':
        return TwitSideModule.ManageWindows.openWindow('ts_mutes', {}, fg.id);
    case 'menuPreferences':
        return browser.runtime.openOptionsPage();
    case 'menuHelp':
        return openURL(HELP_URL);
    case 'menuLogin':
        return $('#newUserContainer').modal('show');
    case 'menuLogout':
        return onClickLogout();
    case 'notifItemClear': // notifContainer
        return clearNotifications();
    case 'notifItemNext':
        return clearNotificationsNext();
    case 'notifItemNothing':
        return true;
    case 'request': // newUserContainer
        return onClickRequest();
    case 'access':
        return onClickAccess();
        //    case '':
        //        break;
    }

    // identify from class
    switch (true) {
    case btn.classList.contains('menuProfileItem'): // topMenuContainer
        return TwitSideModule.ManageWindows.openWindow('profile', {
            userid  : btn.dataset.userid,
            keyword : btn.dataset.screenname
        }, fg.id);
    case btn.classList.contains('notifItem'): // notifContainer
        return clearNotifications(btn);
    case btn.classList.contains('clearAllRepliesButton'): // column
        return clearAllReplies(btn);
    case btn.classList.contains('toTopButton'): // columnMenuBox
        btn.blur();
        return timelineMove('top');
    case btn.classList.contains('toBottomButton'):
        btn.blur();
        return timelineMove('bottom');
    case btn.classList.contains('columnUpdateButton'):
        btn.blur();
        return loadNewer(getColumnIndexFromBox(btn));
    case btn.classList.contains('newListButton'):
        return null;
    case btn.classList.contains('newDmButton'):
        btn.blur();
        return TwitSideModule.ManageWindows.openWindow('newdm', {
            userid : UI.getActiveColumn().attr('data-userid')
        }, fg.id);
    case btn.classList.contains('addColumnButton'):
        return null;

    case btn.classList.contains('tweetMoreBox'): // tweetBox
        return loadMore(btn);
    case btn.classList.contains('clearReplies'):
        return clearReplies(btn);
    case btn.classList.contains('tweetRetweeterImage'):
        return onClickRetweeterImage(btn);
    case btn.classList.contains('tweetMenuButton'):
        return UI.tweetMenuFuncList[btn.dataset.func](btn);

        //    case btn.classList.contains(''):
        //        break;
    }
    return null;
};


/**
 * Panel operation
 */
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
        ? $('#newTweetContainer').collapse('show')
        : $('#newTweetContainer').collapse(open ? 'show' : 'hide');

    if (open) $('#newTweet').focus();
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
        $newTweetCount.addClass('badge-danger').removeClass('badge-success badge-warning');
        $tweetButton.addClass('disabled');
    }
    else if (count > TWEET_MAX_LENGTH - warn) {
        $newTweetCount.addClass('badge-warning').removeClass('badge-success badge-danger');
        $tweetButton.removeClass('disabled');
    }
    else if (count > 0) {
        $newTweetCount.addClass('badge-success').removeClass('badge-warning badge-danger');
        $tweetButton.removeClass('disabled');
    }
    else {
        $newTweetCount.addClass('badge-success').removeClass('badge-warning badge-danger');
        if ($newTweet.attr('data-reply-id') == ''
            && $newTweet.attr('data-attachment-url') == ''
            && $('#pictureThumbnails').children().length == 0)
            $tweetButton.addClass('disabled');
        else
            $tweetButton.removeClass('disabled');
    }

    suggestScreenname($newTweet, $suggest);
    return false;
};

const keypressNewTweet = (e) => {
    e = e.originalEvent;

    // サジェスト
    if (e && !e.shiftKey && e.key == 'Tab' || e && e.key == 'ArrowDown') {
        if ($('#suggestContainer').is(':visible')) {
            setTimeout(() => {$('#suggestContainer').focus(); }, 0);
            return false;
        }
    }
    // ツイート
    else if (e && e.ctrlKey && e.key == 'Enter') {
        if (!$('#tweetButton').hasClass('disabled')) {
            UI.confirm(browser.i18n.getMessage('confirmTweet'),
                       sendTweet,
                       TwitSideModule.config.getPref('confirm_tweet'));
            return true;
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
        $tweetButton.removeClass('disabled');
        UI.showMessage(TwitSideModule.Message.transMessage(result));
        return Promise.reject();
    };

    const userid           = UI.$tweetUserSelection.val(),
          $tweetButton     = $('#tweetButton'),
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
        $('#replyUsersSelection').children('.replyUser.disabled').each(function() {
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

    $tweetButton.addClass('disabled');
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
        $thumbnails.attr('data-mode', 'tweet_image');
        // 最大枚数
        if ($thumbnails.children().length >= MAX_IMAGES)
            $('#sharePicture').addClass('disabled');
        break;
    case 'image/gif':
        // 静止画GIF
        if (!anigif_flag) {
            // モード変更
            $thumbnails.attr('data-mode', 'tweet_image');
            // 最大枚数
            if ($thumbnails.children().length >= MAX_IMAGES)
                $('#sharePicture').addClass('disabled');
        }
        // アニメーションGIF
        else {
            // モード変更
            $thumbnails.attr('data-mode', 'tweet_gif');
            // 最大枚数
            if (anigif_flag && $thumbnails.children().length >= MAX_ANIGIFS)
                $('#sharePicture').addClass('disabled');
        }
        break;
    case 'video/mp4':
        // モード変更
        $thumbnails.attr('data-mode', 'tweet_video');
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

const sharePage = () => {
    const $newTweet = $('#newTweet');

    browser.tabs.query({ active : true, windowId : fg.id }).then((tabs) => {
        newTweetContainerToggle(true);
        $newTweet.val(tabs[0].title + '\n' + tabs[0].url);
        $newTweet.focus();
        $newTweet[0].setSelectionRange(0, 0);
    });
};

// 返信・引用ツイート非表示
const clearTweetRef = () => {
    $('#refTweetBox').hide();
    $('#replyUsersSelection, #refTweetContainer').empty();
    $('#newTweet').attr({
        'data-attachment-url' : '',
        'data-reply-id'       : ''
    });
    countNewTweet();
};


/**
 * Column operation
 */
// 表示中のカラム番号を返す
const getColumnIndex = () => {
    const ret        = [],
          // 一画面に表示するカラム数
          count      = parseInt(UI.$columnC.attr('data-count')),
          width      = UI.$columnC.width(),
          scrollLeft = UI.$columnC.scrollLeft(),
          cWidth     = width / count,
          cSnapWidth = cWidth / 2,
          firstC     = parseInt((scrollLeft + cSnapWidth) / cWidth);

    return [...Array(count).keys()].map(i => i+firstC);
};

// 指定カラムに移動
const scrollColumns = (index_int) => {
    const $columns = UI.$columnC.children(),
          count    = $columns.length;

    // index_intの値がおかしい場合
    if (index_int == null || index_int < 0 || index_int >= count) return;

    $columns.eq(index_int)[0].focus({ preventScroll : true });
    $columns.eq(index_int)[0].scrollIntoView({ behavior : 'smooth' });
};

// カラム幅を計算
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
    UI.$columnC.attr('data-count', count)
        .children().css('width', 'calc(100vw / ' + count + ')');
};

// スパイ追従
const changeColumnSpy = () => {
    // 表示中のカラム番号一覧
    const indexes = getColumnIndex();

    // 変更
    if (UI.$columnSpyC.children('.active').index() != indexes[0]) {
        UI.$columnSpyC.children().removeClass('active').slice(indexes[0], indexes.pop()+1).addClass('active');

        // hover時は表示し続ける
        if (UI.$columnSpyC.hasClass('bg-light')) return;
        UI.$columnSpyC.addClass('show');
        TwitSideModule.timer(150, () => { UI.$columnSpyC.removeClass('show'); });
    }
};

// スパイ表示
const hoverColumnTab = () => {
    if ($('.columnTab').hasClass('hover')) return;
    $('.columnTab').addClass('hover')
        .eq(0).on('transitionstart.hover', function() {
            $(this)
                .on('transitionend.hover', function() {
                    $(this).off('transitionend.hover transitioncancel.hover');

                    const rect = $('.columnTab')[0].getBoundingClientRect(),
                          top  = rect.top + rect.height - 1;

                    UI.$columnSpyC.stop()
                        .addClass('show bg-light').removeClass('delay-transition').css('top', top+'px');
                })
                .on('transitioncancel.hover', function() {
                    $(this).off('transitionend.hover transitioncancel.hover');
                })
                .off('transitionstart.hover');
        })
};

// スパイ非表示
const unhoverColumnTab = () => {
    if (!$('.columnTab').hasClass('hover')) return;
    $('.columnTab').removeClass('hover')
        .eq(0).on('transitionstart.unhover', function() {
            $(this)
                .on('transitionend.unhover', function() {
                    $(this).off('transitionend.unhover transitioncancel.unhover');

                    UI.$columnSpyC.removeClass('show').delay(150).queue(function() {
                        $(this).css('top', '').addClass('delay-transition').removeClass('bg-light').dequeue();
                    });
                })
                .on('transitioncancel.unhover', function() {
                    $(this).off('transitionend.unhover transitioncancel.unhover');
                })
                .off('transitionstart.unhover');
        })
};


/**
 * Tweet operation
 */
// change screenname list
const changeTweetUser = (userid) => {
    // userid未指定
    if (userid == null) userid = UI.getActiveColumn().attr('data-userid');
    UI.$tweetUserSelection.val(userid).trigger('input');
};


/**
 * Authorization
 */
const onClickRequest = async () => {
    const error = (result) => {
        UI.showMessage(TwitSideModule.Message.transMessage(result));
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
        UI.showMessage(TwitSideModule.Message.transMessage(result));
        return Promise.reject();
    };

    const $pin = $('#pin');

    if ($pin.val().length != 7) {
        UI.showMessage(TwitSideModule.Message.transMessage('enterPinNumber'));
        return;
    }

    // アクセス送信
    const oauth_hash = await (new Tweet(oauth_token)).access($pin.val()).catch(error);

    $('#newUserContainer').modal('hide');

    // ユーザ作成
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
    $('#access').toggleClass('disabled', !(oauth_token != null && /\d{7}/.test($('#pin').val())));
};

// All users logout
const onClickLogout = () => {
    UI.confirm(browser.i18n.getMessage('confirmLogout'),
               () => {
                   // ユーザも一緒にリセット
                   TwitSideModule.ManageColumns.reset(TwitSideModule.WINDOW_TYPE.MAIN);
                   // ログイン画面
                   $('#newUserContainer').modal('show');
               });
};


/**
 * Notification
 */
// Get notifications
const updateNotifications = () => {
    const $notifList     = $('#notifList'),
          $notifTemplate = $('#templateContainer > .notifItem');
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
            $notif.children('.notifNever')
                .removeClass('d-none')
                .on('click', () => {
                    neverNotify(notif.id);
                });
            $notif.find('.notifUserName').text(userinfo.screen_name);
            const $notifUrl = $notif.children('.notifUrl');
            for (let url of notif.urls || [])
                $('<div class="text-link" />')
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

        // 通知追加
        $notif.appendTo($notifList);
    }

    // 通知続き
    $('#notifItemNext').text(browser.i18n.getMessage('clear_notif_next', notifs.count))
        .toggleClass('d-none', !notifs.next);

    // 通知件数0の時
    if (count == 0) {
        $('#notifItemClear, #notifItemSeparator').addClass('d-none');
        $('#notifItemNothing').removeClass('d-none');
    }
    else {
        $('#notifItemClear, #notifItemSeparator').removeClass('d-none');
        $('#notifItemNothing').addClass('d-none');
    }
};

// 通知カウント
const readNotifications = (count) => {
    $('#notifContainerToggle .badge').text(count ? count : '');
};

// 特定/全ての通知クリア
const clearNotifications = (notifItem) => {
    TwitSideModule.Message.removeNotifications(notifItem ? [notifItem.id] : null);
    // 通知件数0じゃない時はドロップダウンを閉じない
    return (TwitSideModule.Message.getNotifications()).data.length ? false : true;
};

// 今の通知を消して次の通知を表示
const clearNotificationsNext = () => {
   const notifIds = [];
   $('#notifList').children().each(function() { notifIds.push(this.id); });
   TwitSideModule.Message.removeNotifications(notifIds);
    // 通知件数0じゃない時はドロップダウンを閉じない
    return (TwitSideModule.Message.getNotifications()).data.length ? false : true;
};

// never notify a message from Twit Side
const neverNotify = (notifid) => {
    const hidden_message = JSON.parse(TwitSideModule.config.getPref('hidden_message'));

    if (hidden_message.indexOf(notifid) >= 0) return;
    hidden_message.push(parseInt(notifid));

    TwitSideModule.config.setPref('hidden_message', JSON.stringify(hidden_message));
};
