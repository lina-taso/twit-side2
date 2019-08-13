/**
 * @fileOverview columns content script
 * @name columns.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

let bg, fg, searchParams, TwitSideModule;

const SUFFIX = 'columns';

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
    showColumns();
});

// add other event listener
const vivify = () => {
    // カラム並び替え
    $('#columnListContainer').sortable({
        items       : 'tr',
        cursor      : 'more',
        opacity     : '0.5',
        axis        : 'y',
        containment : '#columnListBody',
        distance    : 10,
        tolerance   : 'pointer',
        // 並べ替え開始
        start : (e, ui) => {
            originalIndex = $(ui.item).index();
        },
        // 並べ替え終了
        update : (e, ui) => {
            onSortColumn($(ui.item).index());
        }
    });
    // 行アクティブ
    $('#columnListBody')
        .on('click focus', '.columnListRow', function() {
            $(this).attr('data-selected', 'true')
                .siblings().attr('data-selected', '');
        })
        .on('dblclick', '.columnListRow', onClickEditColumn);
    // 排他処理
    $('#tlType, input[type="checkbox"]')
        .on('change', checkboxControl);
    // デフォルトラベル
    $('#tlType, #screenname').
        on('change', setDefaultLabel);
};

// event asignment
const commandExec = (btn) => {
    // identify from id
    switch (btn.id) {
    case 'addButton':
        onClickAddColumn();
        break;
    case 'removeButton':
        onClickRemoveColumn();
        break;
    case 'editButton':
        onClickEditColumn();
        break;
    case 'closeButton':
        window.close();
        break;
    case 'closeAddColumnC':
    case 'cancelButton':
        addColumnContainerToggle(false);
        break;
    case 'okButton':
        onAcceptForAddColumn();
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

const showColumns = async (focus) => {
    const $columnList = $('#columnListBody'),
          selected    = $columnList.children('[data-selected="true"]').index();

    // 初期化
    $columnList.empty();

    // フォーカスを外す
    $columnList.children().attr('data-selected', 'false');

    const all_colinfo  = await TwitSideModule.ManageColumns.getColumnInfo();
    const all_userinfo = await TwitSideModule.ManageUsers.getUserInfo();

    for (let idx in all_colinfo) {
        const columninfo = all_colinfo[idx],
              $listItem  = $('#templateContainer .columnListRow').clone()
              .attr('data-tltype', columninfo.tl_type);

        $listItem.children().eq(0).attr('title', columninfo.columnlabel);
        $listItem.children().eq(1).attr('title', '@' + all_userinfo[columninfo.userid].screen_name);
        $listItem.children().eq(2).attr('title', browser.i18n.getMessage(
            'column_' + TwitSideModule.getTimelineName(columninfo.tl_type)
        ));
        $listItem.children().eq(3).find('input').prop('checked', columninfo.options.notif);
        $listItem.children().eq(4).find('input').prop('checked', columninfo.options.onstart);
        $listItem.children().eq(5).find('input').prop('checked', columninfo.options.autoreload);
        $listItem.children().eq(6).find('input').prop('checked', columninfo.options.veil);

        if (columninfo.parameters.q) {
            $listItem.children().eq(7).attr('title', 'KEYWORD: ' + columninfo.parameters.q);
        }
        if (columninfo.parameters.list_id) {
            $listItem.children().eq(7).attr('title', 'LISTID: ' + columninfo.parameters.list_id);
        }
        $listItem.appendTo($columnList);
    }
};

const addColumnContainerToggle = (open) => {
    $('#addColumnContainer').attr('data-open', open);
    if (open) $('#columnLabel').focus();
};

// カラムの追加
const onClickAddColumn = async () => {
    const all_userinfo = await TwitSideModule.ManageUsers.getUserInfo();

    $('#screenname').empty();
    for (let userid in all_userinfo){
        const userinfo = all_userinfo[userid];

        $('#templateContainer .tweetUserOption').clone()
            .val(userinfo.user_id)
            .text('@' + userinfo.screen_name)
            .appendTo('#screenname');
    }
    resetAddColumnC();
    setDefaultLabel();
    addColumnContainerToggle(true);
    $('#addColumnContainer').attr('data-edit-columnindex', 0);
};

const setDefaultLabel = async () => {
    const defaultLabel = TwitSideModule.text.makeDefaultColumnlabel(
        parseInt($('#tlType')[0].selectedOptions[0].value),
        $('#screenname')[0].selectedOptions[0].text
    );

    const label = $('#columnLabel').val();
    if (label == '')
        $('#columnLabel').val(defaultLabel).attr('data-value', defaultLabel);
    else if (label == $('#columnLabel').attr('data-value'))
        $('#columnLabel').val(defaultLabel).attr('data-value', defaultLabel);
    else
        $('#columnLabel').attr('data-value', defaultLabel);
};

// カラムの編集
const onClickEditColumn = async () => {
    const index = $('.columnListRow[data-selected="true"]').index();
    if (index < 0) return;

    const colinfo = TwitSideModule.ManageColumns.getColumnInfo(index);

    resetAddColumnC(colinfo);
    addColumnContainerToggle(true);
    $('#addColumnContainer').attr('data-edit-columnindex', index);
};

// カラムの削除
const onClickRemoveColumn = async () => {
    const index = $('.columnListRow[data-selected="true"]').index();
    if (index < 0) return;

    if (TwitSideModule.config.getPref('confirm_deletecolumn')
        && !confirm(browser.i18n.getMessage('confirmDeleteColumn')))
        return;

    await TwitSideModule.ManageColumns.deleteColumn(index);
    showColumns();
};

// カラム追加コンテナリセット
const resetAddColumnC = (columninfo) => {
    // リセット
    if (!columninfo) {
        $('#addColumnContainer').attr('data-type', 'add');

        $('#columnLabel').val('');
        $('#screenname').removeAttr('disabled')[0].selectedIndex = 0;
        $('#tlType > .tlTypeOption:gt(4)').css('display', 'none').attr('disabled', 'disabled');
        $('#tlType').removeAttr('disabled')[0].selectedIndex = 0;
        $('#notif, #onstart, #autoreload, #veil').prop('checked', false);
        $('#parameter').css('display', 'none');
    }
    else {
        $('#addColumnContainer').attr('data-type', 'edit');

        $('#columnLabel').val(columninfo.columnlabel);
        $('#screenname').attr('disabled', 'disabled')[0].selectedIndex =
            $('#screenname > .tweetUserOption[value="'+ columninfo.userid +'"]').index();
        $('#tlType > .tlTypeOption').css('display', '').removeAttr('disabled');
        $('#tlType').attr('disabled', 'disabled')[0].selectedIndex =
            $('#tlType > .tlTypeOption[value="'+ columninfo.tl_type +'"]').index();
        checkboxControl();

        $('#notif').prop('checked', columninfo.options.notif);
        $('#onstart').prop('checked', columninfo.options.onstart);
        $('#autoreload').prop('checked', columninfo.options.autoreload);
        $('#veil').prop('checked', columninfo.options.veil);
        if (columninfo.parameters.q) {
            $('.columninfoBox:eq(8)').css('display', '');
            $('#parameter').val(
                'KEYWORD: ' + columninfo.parameters.q
            );
        }
        if (columninfo.parameters.list_id) {
            $('.columninfoBox:eq(8)').css('display', '');
            $('#parameter').val(
                'LISTID: ' + columninfo.parameters.list_id
            );
        }
    }
    checkboxControl();
};

// ボタンの排他処理
const checkboxControl = () => {
    const tlType      = parseInt($('#tlType')[0].selectedOptions[0].value),
          $notif      = $('#notif'),
          $onstart    = $('#onstart'),
          $autoreload = $('#autoreload');

    switch (tlType) {
    case TwitSideModule.TL_TYPE.TIMELINE:
        $notif.removeAttr('disabled');
        $onstart.removeAttr('disabled');
        $autoreload.removeAttr('disabled');
        break;
    case TwitSideModule.TL_TYPE.CONNECT:
        $notif.attr('disabled', 'disabled'); $notif.prop('checked', false);
        $onstart.removeAttr('disabled');
        $autoreload.removeAttr('disabled');
        break;
    case TwitSideModule.TL_TYPE.RETWEETED:
        $notif.attr('disabled', 'disabled'); $notif.prop('checked', false);
        $onstart.removeAttr('disabled');
        $autoreload.removeAttr('disabled');
        break;
    case TwitSideModule.TL_TYPE.FAVORITE:
        $notif.attr('disabled', 'disabled'); $notif.prop('checked', false);
        $onstart.removeAttr('disabled');
        $autoreload.removeAttr('disabled');
        break;
    case TwitSideModule.TL_TYPE.DIRECTMESSAGE:
        $notif.removeAttr('disabled');
        $onstart.removeAttr('disabled');
        $autoreload.removeAttr('disabled');
        break;
    case TwitSideModule.TL_TYPE.SEARCH:
        $notif.removeAttr('disabled');
        $onstart.removeAttr('disabled');
        $autoreload.removeAttr('disabled');
        break;
    case TwitSideModule.TL_TYPE.LISTTIMELINE:
        $notif.removeAttr('disabled');
        $onstart.removeAttr('disabled');
        $autoreload.removeAttr('disabled');
        break;
    }

    if ($notif.attr('disabled')) $notif.prop('checked', false);
    if ($onstart.attr('disabled')) $onstart.prop('checked', false);
    if ($autoreload.attr('disabled')) $autoreload.prop('checked', false);
};


/**
 * Column operation
 */
const onAcceptForAddColumn = async () => {
    const type = $('#addColumnContainer').attr('data-type');

    if (!$('#columnLabel').val()) {
        alert(browser.i18n.getMessage('columnsMessageEntercolumnlabel'));
        return;
    }

    switch (type) {
    case 'add':
        await TwitSideModule.ManageColumns.addColumn(
            parseInt($('#tlType')[0].selectedOptions[0].value),
            $('#columnLabel').val(),
            $('#screenname')[0].selectedOptions[0].value,
            { onstart    : $('#onstart').prop('checked'),
              autoreload : $('#autoreload').prop('checked'),
              notif      : $('#notif').prop('checked'),
              veil       : $('#veil').prop('checked') },
            null
        );
        addColumnContainerToggle(false);
        showColumns();
        break;
    case 'edit':
        await TwitSideModule.ManageColumns.editColumn(
            parseInt($('#addColumnContainer').attr('data-edit-columnindex')),
            { columnlabel : $('#columnLabel').val(),
              options     : {
                  onstart    : $('#onstart').prop('checked'),
                  autoreload : $('#autoreload').prop('checked'),
                  notif      : $('#notif').prop('checked'),
                  veil       : $('#veil').prop('checked')
              },
              parameters  : null }
        );
        addColumnContainerToggle(false);
        showColumns();
        break;
    }
};

const onSortColumn = async (newIndex) => {
    if (originalIndex == null || newIndex == null || originalIndex == newIndex)
        return;

    await TwitSideModule.ManageColumns.sortColumn(originalIndex, newIndex);
    originalIndex = null;
};
