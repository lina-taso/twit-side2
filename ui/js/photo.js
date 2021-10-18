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
            if (!e) return;
            switch (e.key) {
            case 'ArrowRight':
                $('#nextPhoto').click();
                break;
            case 'ArrowLeft':
                $('#prevPhoto').click();
                break;
            case '+':
                if (e.ctrlKey) return;
                zoomPhoto('in');
                break;
            case '-':
                if (e.ctrlKey) return;
                zoomPhoto('out');
                break;
            case 'q':
                zoomPhoto('reset');
                break;
            case 'a':
            case 'h':
                movePhoto(-10, 0);
                break;
            case 'd':
            case 'l':
                movePhoto(10, 0);
                break;
            case 'w':
            case 'k':
                movePhoto(0, -10);
                break;
            case 's':
            case 'j':
                movePhoto(0, 10);
                break;
            }
        });
    $('#photoContainer')
        .on('mouseup mouseout', 'video.photo', function() {
            $(this).removeClass('dragging');
        })
        .on('mousemove', 'video.photo', function(e) {
            if (e.buttons == 1) {
                $(this).addClass('dragging');
                movePhoto(e.originalEvent.movementX, e.originalEvent.movementY, true);
            }
        })
        .on('wheel', 'video.photo', function(e) {
            if (e.originalEvent.deltaY < 0) zoomPhoto('out');
            else if (e.originalEvent.deltaY > 0) zoomPhoto('in');
            else if (e.originalEvent.deltaX < 0) rotatePhoto(true);
            else if (e.originalEvent.deltaX > 0) rotatePhoto();
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
    case 'zoominPhoto':
            zoomPhoto('in');
        break;
    case 'zoomoutPhoto':
            zoomPhoto('out');
        break;
    case 'rotatePhoto':
            rotatePhoto();
        break;
    case 'resetPhoto':
            zoomPhoto('reset');
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
            $box.addClass('photo').attr({
                'poster'      : photos[i].rawurl,
                'data-scale'  : 10,
                'data-x'      : 0,
                'data-y'      : 0,
                'data-rotate' : 0
            });
        }
        $box.appendTo($photoContainer);
    }
};

// ズームin/out
const zoomPhoto = (dir) => {
    const index = $('#photoContainer').attr('data-active-photo'),
          $photo = $('#photoContainer').children().eq(index),
          scale = parseInt($photo.attr('data-scale')),
          x = parseInt($photo.attr('data-x')) / 10,
          y = parseInt($photo.attr('data-y')) / 10,
          rotate = parseInt($photo.attr('data-rotate')),
          MAXSCALE = 50,
          SCALESTEP = 2;

    let retScale;

    switch (dir) {
    case 'in':
        retScale = scale+SCALESTEP >= MAXSCALE ? MAXSCALE : scale+SCALESTEP;
        $photo.attr('data-scale', retScale);
        $photo.css('transform',
                   'scale(' + retScale/10 + ') '
                   +'translate('  + x + '%,' + y + '%) '
                   +'rotate(' + rotate + 'deg)');
        break;
    case 'out':
        retScale = scale-SCALESTEP <= 10 ? 10 : scale-SCALESTEP;
        $photo.attr('data-scale', retScale);
        $photo.css('transform',
                   'scale(' + retScale/10 + ') '
                   +'translate('  + x + '%,' + y + '%) '
                   +'rotate(' + rotate + 'deg)');
        break;
    case 'reset':
        $photo.attr({
            'data-scale'  : 10,
            'data-x'      : 0,
            'data-y'      : 0,
            'data-rotate' : 0
        });
        $photo.css('transform', 'scale(1) translate(0%, 0%) rotate(0deg)');
        break;
    }
};

// 画像移動
const movePhoto = (moveX, moveY) => {
    const index = $('#photoContainer').attr('data-active-photo'),
          $photo = $('#photoContainer').children().eq(index),
          scale = parseInt($photo.attr('data-scale')) / 10,
          x = parseInt($photo.attr('data-x')),
          y = parseInt($photo.attr('data-y')),
          rotate = parseInt($photo.attr('data-rotate'));

    const retX = x+moveX <= -500 ? -500 : x+moveX >= 500 ? 500 : x+moveX;
    const retY = y+moveY <= -500 ? -500 : y+moveY >= 500 ? 500 : y+moveY;

    $photo.attr({
        'data-x' : retX,
        'data-y' : retY
    });
    $photo.css('transform',
               'scale(' + scale + ') '
               +'translate('  + retX/10 + '%,' + retY/10 + '%) '
               +'rotate(' + rotate + 'deg)');
};

// 画像回転
const rotatePhoto = (left) => {
    const index = $('#photoContainer').attr('data-active-photo'),
          $photo = $('#photoContainer').children().eq(index),
          scale = parseInt($photo.attr('data-scale')) / 10,
          x = parseInt($photo.attr('data-x')) / 10,
          y = parseInt($photo.attr('data-y')) / 10,
          rotate = parseInt($photo.attr('data-rotate'));

    const moveRotate = left ? -90 : 90;
    const retRotate = rotate+moveRotate >= 360 ? 0
          : rotate+moveRotate < 0 ? 270
          : rotate+moveRotate;

    $photo.attr('data-rotate', retRotate);
    $photo.css('transform',
               'scale(' + scale + ') '
               +'translate('  + x + '%,' + y + '%) '
               +'rotate(' + retRotate + 'deg)');
};

// 写真切り替え
const changePhoto = (index) => {
    const $photoContainer = $('#photoContainer'),
          len = $photoContainer.children().length;

    if (index < 0 || index >= len) return;

    // indexだけ表示
    $photoContainer.attr('data-active-photo', index)
        .children().eq(index).css('display', '').each(function() {
            if ($(this).hasClass('video')) {
                $('#zoomoutPhoto, #zoominPhoto, #rotatePhoto, #resetPhoto').css('display', 'none');
                this.play();
            }
            else if ($(this).hasClass('youtube')) {
                $('#zoomoutPhoto, #zoominPhoto, #rotatePhoto, #resetPhoto').css('display', 'none');
            }
            else if ($(this).hasClass('photo')) {
                $('#zoomoutPhoto, #zoominPhoto, #rotatePhoto, #resetPhoto').css('display', '');
            }
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
