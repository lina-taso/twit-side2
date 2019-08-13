/**
 * @fileOverview Pref operation
 * @name pref.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

let bg, fg, TwitSideModule;

const LOADWAIT = 1000;

window.addEventListener('load', async () => {
    bg = await browser.runtime.getBackgroundPage();
    // private browsing mode
    if (!bg) return;
    fg = await browser.windows.getCurrent();

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

    vivify();
    showVersion();

    restorePrefs();
    localization();
    initHovermenu();
});

// add other event listener
const vivify = () => {
    // カラム並び替え
    $('#hovermenuContainer').sortable({
        items       : 'tr',
        cursor      : 'more',
        opacity     : '0.5',
        axis        : 'y',
        containment : '#hovermenuContainer',
        distance    : 10,
        tolerance   : 'pointer',
        update : (e, ui) => {
            $('button.save_button_hover').addClass('blink');
            $('#hovermenuContainer').attr('data-changed', 'true');
        }
    });
    // フォーム
    $('form')
        .on('change', function(e) {
            // 変更あり
            $(this).find('button.save_button').addClass('blink');
            e.target.dataset.changed = true;

            // ホバーメニュー
            if ($('#hovermenuContainer').find(e.target).length) {
                // 排他処理
                if (!checkHovermenu(e.target)) return;
                $('button.save_button_hover').addClass('blink');
                $('#hovermenuContainer').attr('data-changed', 'true');
            }

            // タイムスタンプ
            if ($('#timeformatContainer').find(e.target).length) {
                showTimestampSample();
            }
        });

    // 通常の保存ボタン
    $('button.save_button1')
        .on('click', saveSection);
    // UI変更の保存ボタン
    $('button.save_button2')
        .on('click', saveSection2);
    // 検索カラム変更の保存ボタン
    $('button.save_button3')
        .on('click', saveSection2);
    // ホバーメニュー保存ボタン
    $('button.save_button_hover')
        .on('click', saveHoverSection);
};


/**
 * 全体
 */
// localization content ui
const localization = () => {
    for (let datum of l10nDefinition) {
        if (datum.selector == 'title') {
            document.title = browser.i18n.getMessage(datum.word);
            continue;
        }

        switch (datum.place) {
        case "text":
            $(datum.selector).text(browser.i18n.getMessage(datum.word));
            break;
        case "html":
            $(datum.selector).html(browser.i18n.getMessage(datum.word));
            break;
        case "attr":
            $(datum.selector).attr(datum.attr, browser.i18n.getMessage(datum.word));
            break;
        }
    }

    // timestamp sample
    $('#time_locale').children().each(function() {
        if (this.value == 'locale') return;
        $(this).text(TwitSideModule.text.convertTimeStamp(
            new Date(),
            this.value,
            TwitSideModule.text.createTimeformat({
                date    : 'year',
                weekday : true,
                hour12  : true,
                sec     : true
            })
        ));
    });
    showTimestampSample();
};

const showVersion = () => {
    $('#ts-version').val(
        browser.runtime.getManifest().name + '/'
            + browser.runtime.getManifest().version
    );
};

const restorePrefs = () => {
    const prefs = TwitSideModule.config.getPref();
    for (let item in prefs) {
        switch (typeof prefs[item]) {
        case 'string':
        case 'number':
            $('#'+item).val(prefs[item]);
            break;
        case 'boolean':
            $('#'+item).prop('checked', prefs[item]);
            break;
        }
    }
};

// タイムスタンプサンプル表示
const showTimestampSample = () => {
    $('#time_sample').val(
        TwitSideModule.text.convertTimeStamp(
            new Date(),
            $('#time_locale').val(),
            TwitSideModule.text.createTimeformat({
                date    : $('#time_date').val(),
                weekday : $('#time_weekday').prop('checked'),
                hour12  : $('#time_hour12').prop('checked'),
                sec     : $('#time_sec').prop('checked')
            })
        ));
};

// ホバーメニュー初期化
const initHovermenu = () => {
    var menux = [];

    for (let i=0; i<4; i++)
        menux.push(TwitSideModule.config.getPref('hover_menu'+i));

    for (let i=0; i<4; i++) {
        if (menux[i] == '') continue;
        $('#hover_'+menux[i]).closest('tr').insertBefore($('#hovermenuContainer tr').eq(i));
    }
};

// ホバーメニューチェック数制限
const checkHovermenu = (checkbox) => {
    if ($('#hovermenuContainer').find('input[type=checkbox]:checked').length > 4) {
        $(checkbox).prop('checked', false);
        return false;
    }
    return true;
};

// セクション保存（UI変更無し）
const saveSection = async (e) => {
    const el    = e.target,
          $form = $(el).closest('form');

    if (!$form[0].checkValidity()) return;

    $(el).removeClass('blink');
    $(el).closest('form').find('[data-changed=true]').each(await async function() {
        switch(this.type) {
        case 'number':
            // コンフィグ設定
            await TwitSideModule.config.setPref(this.id, parseInt(this.value));
            break;
        case 'checkbox':
            // コンフィグ設定
            await TwitSideModule.config.setPref(this.id, this.checked);
            break;
        default:
            // コンフィグ設定
            await TwitSideModule.config.setPref(this.id, this.value);
        }
        $(this).removeAttr('data-changed');
    });
};

// セクション保存（UI変更あり）
const saveSection2 = async (e) => {
    const el    = e.target,
          $form = $(el).closest('form');

    if (!$form[0].checkValidity()) return;

    await saveSection(e);
    TwitSideModule.windows.sendMessage({
        reason : TwitSideModule.UPDATE.UI_CHANGED
    }, null, null);
};

// セクション保存（カラム更新あり）
const saveSection3 = async (e) => {
    const el    = e.target,
          $form = $(el).closest('form');

    if (!$form[0].checkValidity()) return;

    await saveSection(e);
    // 検索カラムの更新
    const columns = TwitSideModule.ManageColumns.searchColumn({
        tl_type : TwitSideModule.TL_TYPE.SEARCH
    });
    for (let idx of columns) {
        TwitSideModule.ManageColumns.editColumn(idx, {});
    }
};

// セクション保存（ホバーメニュー）
const saveHoverSection = async (e) => {
    const el = e.target;
    $(el).removeClass('blink');
    let $hovermenuContainer = $('#hovermenuContainer');
    // ホバーメニューの順序
    if ($hovermenuContainer.is('[data-changed=true]')) {
        let menux = $hovermenuContainer.find(':checked').toArray();
        for (let i=0; i<4; i++)
            await TwitSideModule.config.setPref('hover_menu'+i, menux[i] ? menux[i].value : '');
    }
    // ホバーメニューの有効無効
    $hovermenuContainer.find('input[data-changed=true]').each(await async function() {
        // コンフィグ設定
        await TwitSideModule.config.setPref(el.id, el.checked);
        $(el).removeAttr('data-changed');
    });
};
