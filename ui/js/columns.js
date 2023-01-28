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
    buttonize(['.ts-btn'], commandExec);
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
    $('#columnListBody').sortable({
        items       : '.columnListRow',
        opacity     : '0.5',
        axis        : 'y',
        containment : 'parent',
        helper      : 'clone',
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
    // 排他処理
    $('#tlType, input[type="checkbox"]')
        .on('change', checkboxControl);
    // デフォルトラベル
    $('#tlType, #screenname').
        on('change', setDefaultLabel);
    // ラベル
    $('#columnLabel')
        .on('keyup paste drop blur', function() {
            $('#okButton').toggleClass('disabled', this.value == '');
        });
    // カラム追加コンテナ
    $('#addColumnContainer')
        .on('shown.bs.modal', function() {
            $('#tlType').focus();
        });
    // フォーム送信しない
    $('#addColumnForm')
        .on('submit', function() {
            onAcceptForAddColumn();
            return false;
        });
};

// event asignment
const commandExec = (btn) => {
    if (btn.classList.contains('disabled')) return false;

    // identify from id
    switch (btn.id) {

    case 'addButton':
        return onClickAddColumn();
//    case '':
//        break;
    }

    // identify from class
    switch (true) {
    case btn.classList.contains('removeButton'):
        onClickRemoveColumn(btn);
        break;
    case btn.classList.contains('editButton'):
        onClickEditColumn(btn);
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

const showColumns = async (focus) => {
    const $columnList = $('#columnListBody');

    // 初期化
    $columnList.empty();

    const all_colinfo  = await TwitSideModule.ManageColumns.getColumnInfo();
    const all_userinfo = await TwitSideModule.ManageUsers.getUserInfo();

    for (let idx in all_colinfo) {
        const columninfo = all_colinfo[idx],
              $listItem  = $('#templateContainer > .columnListRow').clone().attr('data-tltype', columninfo.tl_type);

        $listItem.children().eq(0).attr('title', columninfo.columnlabel);
        $listItem.children().eq(1).attr('title', '@' + all_userinfo[columninfo.userid].screen_name);
        $listItem.children().eq(2).attr('title', browser.i18n.getMessage(
            'column_' + TwitSideModule.getTimelineName(columninfo.tl_type)
        ));
        $listItem.children().eq(3).find('input').prop('checked', columninfo.options.notif);
        $listItem.children().eq(4).find('input').prop('checked', columninfo.options.onstart);
        $listItem.children().eq(5).find('input').prop('checked', columninfo.options.autoreload);
        $listItem.children().eq(6).find('input').prop('checked', columninfo.options.veil);

        if (columninfo.parameters.q)
            $listItem.children().eq(7).attr('title', 'KEYWORD: ' + columninfo.parameters.q);
        if (columninfo.parameters.list_id)
            $listItem.children().eq(7).attr('title', 'LISTID: ' + columninfo.parameters.list_id);

        $listItem.appendTo($columnList);
    }
};

// カラムの追加
const onClickAddColumn = async () => {
    const all_userinfo = await TwitSideModule.ManageUsers.getUserInfo();

    UI.updateTweetUserSelection($('#screenname'), $('#templateContainer > .tweetUserOption'), all_userinfo);
    resetAddColumnC();
    setDefaultLabel();
    $('#addColumnContainer').attr('data-edit-columnindex', 0).modal('show');
};

const setDefaultLabel = async () => {
    const defaultLabel = TwitSideModule.text.makeDefaultColumnlabel(
        parseInt($('#tlType').val()),
        $('#screenname > :selected').text()
    );

    const label = $('#columnLabel').val();
    if (label == '')
        $('#columnLabel').val(defaultLabel).attr('data-value', defaultLabel);
    else if (label == $('#columnLabel').attr('data-value'))
        $('#columnLabel').val(defaultLabel).attr('data-value', defaultLabel);
    else
        $('#columnLabel').attr('data-value', defaultLabel);

    $('#columnLabel').trigger('keyup');
};

// カラムの編集
const onClickEditColumn = async (btn) => {
    const index = $(btn).closest('tr').index();
    if (index < 0) return;

    const colinfo      = TwitSideModule.ManageColumns.getColumnInfo(index),
          all_userinfo = await TwitSideModule.ManageUsers.getUserInfo();

    UI.updateTweetUserSelection($('#screenname'), $('#templateContainer > .tweetUserOption'), all_userinfo);
    resetAddColumnC(colinfo);
    $('#addColumnContainer').attr('data-edit-columnindex', index).modal('show');
};

// カラムの削除
const onClickRemoveColumn = async (btn) => {
    const index = $(btn).closest('tr').index();
    if (index < 0) return;

    UI.confirm(browser.i18n.getMessage('confirmDeleteColumn'),
               async () => {
                   await TwitSideModule.ManageColumns.deleteColumn(index);
                   UI.showMessage(TwitSideModule.Message.transMessage('columnDeleted'));
                   showColumns();
               },
               TwitSideModule.config.getPref('confirm_deletecolumn'));
};

// カラム追加コンテナリセット
const resetAddColumnC = (columninfo) => {
    if (!columninfo) {
        $('#addColumnContainer').attr('data-type', 'add');

        $('#addColumnTitle').removeClass('d-none');
        $('#editColumnTitle').addClass('d-none');
        $('#columnLabel').val('');
        $('#screenname').removeAttr('disabled')[0].selectedIndex = 0;
        $('#tlType > .tlTypeOption.tlTypeOptionHidden').addClass('d-none');
        $('#tlType').removeAttr('disabled')[0].selectedIndex = 0;
        $('#notif, #onstart, #autoreload, #veil').prop('checked', false);
        $('#parameter').val('').closest('.form-group').addClass('d-none');
    }
    else {
        $('#addColumnContainer').attr('data-type', 'edit');

        $('#addColumnTitle').addClass('d-none');
        $('#editColumnTitle').removeClass('d-none');
        $('#columnLabel').val(columninfo.columnlabel);
        $('#screenname').attr('disabled', 'disabled').val(columninfo.userid);
        $('#tlType > .tlTypeOption').removeClass('d-none');
        $('#tlType').attr('disabled', 'disabled').val(columninfo.tl_type);

        $('#notif').prop('checked', columninfo.options.notif);
        $('#onstart').prop('checked', columninfo.options.onstart);
        $('#autoreload').prop('checked', columninfo.options.autoreload);
        $('#veil').prop('checked', columninfo.options.veil);
        $('#parameter').val('').closest('.form-group').addClass('d-none');
        if (columninfo.parameters.q) {
            $('#parameter').closest('.form-group').removeClass('d-none');
            $('#parameter').val(
                'KEYWORD: ' + columninfo.parameters.q
            );
        }
        if (columninfo.parameters.list_id) {
            $('#parameter').closest('.form-group').removeClass('d-none');
            $('#parameter').val(
                'LISTID: ' + columninfo.parameters.list_id
            );
        }
    }
    checkboxControl();
};

// ボタンの排他処理
const checkboxControl = () => {
    const tlType      = parseInt($('#tlType').val()),
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
    switch ($('#addColumnContainer').attr('data-type')) {
    case 'add':
        await TwitSideModule.ManageColumns.addColumn(
            parseInt($('#tlType').val()),
            $('#columnLabel').val(),
            $('#screenname').val(),
            { onstart    : $('#onstart').prop('checked'),
              autoreload : $('#autoreload').prop('checked'),
              notif      : $('#notif').prop('checked'),
              veil       : $('#veil').prop('checked') },
            null
        );
        UI.showMessage(TwitSideModule.Message.transMessage('columnAdded'));
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
        UI.showMessage(TwitSideModule.Message.transMessage('columnEdited'));
        break;
    }
    $('#addColumnContainer').modal('hide');
    showColumns();
};

const onSortColumn = async (newIndex) => {
    if (originalIndex == null || newIndex == null || originalIndex == newIndex)
        return;

    await TwitSideModule.ManageColumns.sortColumn(originalIndex, newIndex);
    originalIndex = null;
};
