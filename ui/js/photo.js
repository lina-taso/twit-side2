/**
 * @fileOverview photo content script
 * @name photo.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

let bg, fg, searchParams, TwitSideModule;

const SUFFIX = 'photo';

let photos;

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
    // photo
    initialize();
    changePhoto(parseInt(searchParams.index));
});

// add other event listener
const vivify = () => {
    $('body')
        .on('keydown', function(e) {
            e = e.originalEvent;
            if (e && e.key == 'ArrowRight')     $('#nextPhoto').click();
            else if (e && e.key == 'ArrowLeft') $('#prevPhoto').click();
        });
};

// event asignment
const commandExec = (btn) => {
    if (btn.classList.contains('disabled')) return false;

    // identify from id
    switch (btn.id) {
    case 'openDirectUrl':
        openURL(photos[$('#photoContainer').attr('data-active-photo')].fullurl);
        break;
    case 'closeButton':
        window.close();
        break;
    case 'fullscreenPhoto':
        if (document.fullscreenElement)
            document.exitFullscreen();
        else
            document.documentElement.requestFullscreen();
        break;
    case 'prevPhoto':
            changePhoto(parseInt($('#photoContainer').attr('data-active-photo')) - 1);
        break;
    case 'nextPhoto':
            changePhoto(parseInt($('#photoContainer').attr('data-active-photo')) + 1);
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
    const $photoContainer = $('#photoContainer').empty().attr('data-active-photo', 0);

    const tl = TwitSideModule.ManageColumns
          .getTimelineInfo(parseInt(searchParams.columnindex),
                           'timeline',
                           parseInt(searchParams.win_type));

    photos = tl.tweetInfo(searchParams.boxid).tweetinfo.meta.pics;

    // 写真を追加
    for (let i=0; i<photos.length; i++) {
        let $box = $('<video />');
        // youtube
        if (photos[i].provider == 'youtube')
            $box = $('<iframe />').addClass('youtube')
            .attr('src', photos[i].embedurl + '?enablejsapi=1');
        // 動画
        else if (photos[i].variants) {
            $box.addClass('video').attr({
                preload  : 'auto',
                loop     : 'loop',
                controls : 'contols',
                muted    : 'muted'
            });
            // twitter
            for (let source of photos[i].variants)
                $('<source />').attr({
                    src  : source.url,
                    type : source.content_type
                }).appendTo($box);
        }
        // 写真
        else {
            $box.addClass('photo').attr('poster', photos[i].rawurl);
        }
        $box.appendTo($photoContainer);
    }
};

// 写真切り替え
const changePhoto = (index) => {
    const $photoContainer = $('#photoContainer'),
          len = $photoContainer.children().length;

    if (index < 0 || index >= len) return;

    // indexだけ表示
    $photoContainer.attr('data-active-photo', index)
        .children().eq(index).css('display', '').each(function() {
            if (this.className == 'video') this.play();
        })
        .siblings().css('display', 'none').each(function() {
            if (this.className == 'video') this.pause();
            else if (this.className == 'youtube')
                this.contentWindow.postMessage(JSON.stringify({
                    event : 'command',
                    func  : 'pauseVideo',
                    args  : ''
                }), '*');
        });

    // 矢印表示切り替え
    $('#prevPhoto').toggleClass('disabled', index == 0);
    $('#nextPhoto').toggleClass('disabled', index+1 == len);

    // URL
    $('#directUrl').val(photos[index].rawurl);
};
