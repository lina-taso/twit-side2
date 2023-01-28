/**
 * @fileOverview Managing columns
 * @name manage_colmuns.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

if (!TwitSideModule) var TwitSideModule = {};

TwitSideModule.ManageColumns = {

    initialize : function() {
        this._columns   = {};
        this._timelines = {};

        // 変数へ読み込み
        // {windowtype : {idx : { columninfo }}}
        this._columns[TwitSideModule.WINDOW_TYPE.MAIN]
            = JSON.parse(TwitSideModule.config.getPref('columns') || '{}');
        // {windowtype : {idx : { id , timeline }}}
        this._timelines[TwitSideModule.WINDOW_TYPE.MAIN] = {};

        // temp初期化
        [
            TwitSideModule.WINDOW_TYPE.PROFILE,
            TwitSideModule.WINDOW_TYPE.SEARCH,
            TwitSideModule.WINDOW_TYPE.MUTE,
            TwitSideModule.WINDOW_TYPE.BLOCK,
            TwitSideModule.WINDOW_TYPE.NORETWEET,
            TwitSideModule.WINDOW_TYPE.LISTMEMBER
        ].forEach((v) => {
            this._columns[v]   = {};
            this._timelines[v] = {};
        });

        // カラム初期化
        for (let idx in this._columns[TwitSideModule.WINDOW_TYPE.MAIN])
            this._initColumn(idx);

        TwitSideModule.debug.log('Manage columns initialized');
    },

    // カラムの初期化（Iが無い可能性もある）
    _initColumn : function(columnindex_int, win_type) {
        win_type = win_type || TwitSideModule.WINDOW_TYPE.MAIN;

        const columninfo = this._columns[win_type][columnindex_int],
              domid      = this._makeID();

        // ユーザ情報
        const userinfo = TwitSideModule.ManageUsers.getUserInfo(columninfo.userid);

        let tl;
        // Timeline作成
        switch (columninfo.tl_type) {
        case TwitSideModule.TL_TYPE.TEMP_FOLLOW:
        case TwitSideModule.TL_TYPE.TEMP_FOLLOWER:
        case TwitSideModule.TL_TYPE.TEMP_MUTE:
        case TwitSideModule.TL_TYPE.TEMP_BLOCK:
        case TwitSideModule.TL_TYPE.TEMP_NORETWEET:
            tl = new FriendTimeline(
                columninfo.tl_type,
                domid,
                userinfo,
                win_type,
                columninfo.parameters.user_id
            );
            break;
        case TwitSideModule.TL_TYPE.TEMP_OWNERSHIPLISTS:
        case TwitSideModule.TL_TYPE.TEMP_SUBSCRIPTIONLISTS:
        case TwitSideModule.TL_TYPE.TEMP_MEMBERSHIPLISTS:
            tl = new ListTimeline(
                columninfo.tl_type,
                domid,
                userinfo,
                win_type,
                columninfo.parameters.user_id
            );
            break;
        case TwitSideModule.TL_TYPE.TEMP_LISTMEMBER:
        case TwitSideModule.TL_TYPE.TEMP_LISTSUBSCRIBER:
            tl = new ListTimeline(
                columninfo.tl_type,
                domid,
                userinfo,
                win_type,
                columninfo.parameters.list_id
            );
            break;
        case TwitSideModule.TL_TYPE.DIRECTMESSAGE:
        case TwitSideModule.TL_TYPE.TEMP_DIRECTMESSAGE:
            tl = new DmTimeline(
                columninfo.tl_type,
                domid,
                userinfo,
                win_type
            );
            break;
        case TwitSideModule.TL_TYPE.TIMELINE_V2:
            tl = new TimelineV2(
                columninfo.tl_type,
                domid,
                userinfo,
                win_type
            );
            break;
        case TwitSideModule.TL_TYPE.CONNECT_V2:
        case TwitSideModule.TL_TYPE.FAVORITE_V2:
        case TwitSideModule.TL_TYPE.TEMP_USERTIMELINE_V2:
        case TwitSideModule.TL_TYPE.TEMP_FAVORITE_V2:
            tl = new TimelineV2(
                columninfo.tl_type,
                domid,
                userinfo,
                win_type
            );
            break;
        default:
            tl = new Timeline(
                columninfo.tl_type,
                domid,
                userinfo,
                win_type
            );
        }

        // バインド
        this._timelines[win_type][columnindex_int] = {
            timeline : tl,
            id       : domid
        };

        // タイムライン更新
        this._updateTimeline(tl, columninfo);
        return domid;
    },

    // タイムラインパラメータ設定
    // return none
    _updateTimeline : function(timeline, columninfo) {
        columninfo = JSON.parse(JSON.stringify(columninfo));
        // 基本的にはmute, noretweetは見ない
        columninfo.options.mute      = false;
        columninfo.options.noretweet = false;

        switch (columninfo.tl_type) {
        case TwitSideModule.TL_TYPE.FAVORITE:
            // TEMPじゃないお気に入りはユーザ指定なし
            timeline.getNewerHash = { count : TwitSideModule.config.getPref('favorite_count') };
            timeline.getOlderHash = { count : TwitSideModule.config.getPref('autopager_count')+1 };
            break;
        case TwitSideModule.TL_TYPE.TEMP_FOLLOW:
        case TwitSideModule.TL_TYPE.TEMP_FOLLOWER:
            break;
        case TwitSideModule.TL_TYPE.TEMP_FAVORITE:
            // TEMPのお気に入りはユーザ指定あり
            timeline.getNewerHash = {
                count   : TwitSideModule.config.getPref('favorite_count'),
                user_id : columninfo.parameters.user_id
            };
            timeline.getOlderHash = {
                count   : TwitSideModule.config.getPref('autopager_count')+1,
                user_id : columninfo.parameters.user_id
            };
            break;
        case TwitSideModule.TL_TYPE.TEMP_OWNERSHIPLISTS:
        case TwitSideModule.TL_TYPE.TEMP_SUBSCRIPTIONLISTS:
        case TwitSideModule.TL_TYPE.TEMP_MEMBERSHIPLISTS:
        case TwitSideModule.TL_TYPE.TEMP_LISTMEMBER:
        case TwitSideModule.TL_TYPE.TEMP_LISTSUBSCRIBER:
            break;
        case TwitSideModule.TL_TYPE.DIRECTMESSAGE:
        case TwitSideModule.TL_TYPE.TEMP_DIRECTMESSAGE:
            timeline.getNewerHash = { count : TwitSideModule.config.getPref('dm_count') };
            timeline.getOlderHash = { count : TwitSideModule.config.getPref('dm_count') };
            break;
        case TwitSideModule.TL_TYPE.SEARCH:
        case TwitSideModule.TL_TYPE.TEMP_SEARCH:
            // 検索タイムラインはmute有効
            columninfo.options.mute = TwitSideModule.config.getPref('mute_onsearch');

            timeline.getNewerHash = {
                q           : columninfo.parameters.q,
                count       : TwitSideModule.config.getPref('search_count'),
                result_type : columninfo.parameters.result_type
            };
            timeline.getOlderHash = {
                q           : columninfo.parameters.q,
                count       : TwitSideModule.config.getPref('autopager_count')+1,
                result_type : columninfo.parameters.result_type
            };
            break;
        case TwitSideModule.TL_TYPE.LISTTIMELINE:
            // リストタイムラインはmute, noretweet有効
            columninfo.options.mute      = true;
            columninfo.options.noretweet = true;

            timeline.getNewerHash = {
                count   : TwitSideModule.config.getPref('timeline_count'),
                list_id : columninfo.parameters.list_id
            };
            timeline.getOlderHash = {
                count   : TwitSideModule.config.getPref('autopager_count')+1,
                list_id : columninfo.parameters.list_id
            };
            break;
        case TwitSideModule.TL_TYPE.TEMP_USERTIMELINE:
            timeline.getNewerHash = {
                count       : TwitSideModule.config.getPref('profile_count'),
                user_id     : columninfo.parameters.user_id,
                include_rts : 'true'
            };
            timeline.getOlderHash = {
                count       : TwitSideModule.config.getPref('autopager_count')+1,
                user_id     : columninfo.parameters.user_id,
                include_rts : 'true'
            };
            break;
        case TwitSideModule.TL_TYPE.TIMELINE:
            // ホームタイムラインはmute, noretweet有効
            columninfo.options.mute      = true;
            columninfo.options.noretweet = true;
            timeline.getNewerHash = { count : TwitSideModule.config.getPref(TwitSideModule.getTimelineName(columninfo.tl_type)+'_count') };
            timeline.getOlderHash = { count : TwitSideModule.config.getPref('autopager_count')+1 };
            break;


        case TwitSideModule.TL_TYPE.TEMP_USERTIMELINE_V2:
            // TEMPはユーザ指定あり
            // TODO v2のユーザ指定
            timeline.getNewerHashV2 = { max_results : TwitSideModule.config.getPref('profile_count') };
            timeline.target_userid  = columninfo.parameters.user_id;
            timeline.getNewerHash   = {
                count   : TwitSideModule.config.getPref('profile_count')+10,
                user_id : columninfo.parameters.user_id
            };
            timeline.getOlderHashV2 = { max_results : TwitSideModule.config.getPref('autopager_count') };
            timeline.target_userid  = columninfo.parameters.user_id;
            timeline.getOlderHash   = {
                count   : TwitSideModule.config.getPref('autopager_count')+10,
                user_id : columninfo.parameters.user_id
            };
            break;
        case TwitSideModule.TL_TYPE.TEMP_FAVORITE_V2:
            // TEMPはユーザ指定あり
            // TODO v2のユーザ指定
            timeline.getNewerHashV2 = { max_results : TwitSideModule.config.getPref('favorite_count') };
            timeline.target_userid  = columninfo.parameters.user_id;
            timeline.getNewerHash   = {
                count   : TwitSideModule.config.getPref('favorite_count')+10,
                user_id : columninfo.parameters.user_id
            };
            timeline.getOlderHashV2 = { max_results : TwitSideModule.config.getPref('autopager_count') };
            timeline.target_userid  = columninfo.parameters.user_id;
            timeline.getOlderHash   = {
                count   : TwitSideModule.config.getPref('autopager_count')+10,
                user_id : columninfo.parameters.user_id
            };
            break;
        case TwitSideModule.TL_TYPE.TIMELINE_V2:
            // ホームタイムラインはmute, noretweet有効
            columninfo.options.mute      = true;
            columninfo.options.noretweet = true;
            // TODO timeline_v2_count
            timeline.getNewerHashV2 = { max_results : TwitSideModule.config.getPref('timeline_count') };
            // TODO timeline_v2_count
            timeline.getNewerHash   = { count : TwitSideModule.config.getPref('timeline_count')+10 };
            timeline.getOlderHashV2 = { max_results : TwitSideModule.config.getPref('autopager_count') };
            timeline.getOlderHash   = { count : TwitSideModule.config.getPref('autopager_count')+10 };
            break;
        case TwitSideModule.TL_TYPE.CONNECT_V2:
        case TwitSideModule.TL_TYPE.FAVORITE_V2:
            // TODO v2_count
            timeline.getNewerHashV2 = { max_results : 50 };
            // TODO v2_count
            timeline.getNewerHash   = { count : 50 };
            timeline.getOlderHashV2 = { max_results : TwitSideModule.config.getPref('autopager_count') };
            timeline.getOlderHash   = { count : TwitSideModule.config.getPref('autopager_count')+10 };
            break;
        default:
            timeline.getNewerHash   = { count : TwitSideModule.config.getPref(TwitSideModule.getTimelineName(columninfo.tl_type)+'_count') };
            timeline.getOlderHash   = { count : TwitSideModule.config.getPref('autopager_count')+10 };
        }

        // オプション再読込
        timeline.updateOptions(columninfo.options);
    },

    // make DOM id for columns
    _makeID : function(win_type) {
        const array = [];
        let str = '';

        for (let i = 0; i < 26; i++)
            array.push(String.fromCharCode('a'.charCodeAt() + i));
        for (let i = 0; i < 26; i++)
            array.push(String.fromCharCode('A'.charCodeAt() + i));

        for (let i = 0; i < 5; i++)
            str += array[Math.floor(Math.random() * 52)];

        // 重複チェック
        if (this._checkIDused(str, win_type))
            return this._makeID(win_type);
        else
            return str;
    },

    // DOM ID重複チェック
    _checkIDused : function(id, win_type) {
        win_type = win_type || TwitSideModule.WINDOW_TYPE.MAIN;

        const target_timelines = this._timelines[win_type];
        for (let idx in target_timelines) {
            if (target_timelines[idx].id === id) return true; //used
        }
        return false; //unused
    },

    // カラムの情報を更新
    _writeColumns : async function(columnindex, tl_type, columnlabel, userid, options, parameters, win_type) {
        win_type = win_type || TwitSideModule.WINDOW_TYPE.MAIN;

        if (win_type === TwitSideModule.WINDOW_TYPE.MAIN) {
            // カラム保存
            this._columns[win_type][columnindex] = {
                tl_type     : tl_type,
                columnlabel : columnlabel,
                userid      : userid,
                options     : options,
                parameters  : parameters,
                lastnotify  : this._columns[win_type][columnindex]
                    && this._columns[win_type][columnindex].lastnotify
            };

            // 値を保存
            await TwitSideModule.config.setPref('columns', JSON.stringify(this._columns[win_type]));
        }

        else
            // カラム保存
            this._columns[win_type][columnindex] = {
                tl_type     : tl_type,
                columnlabel : columnlabel,
                userid      : userid,
                options     : options,
                parameters  : parameters
            };
    },

    /**
     * options_hash
     * { onstart : {boolean}
     *   autoreload : {boolean}
     *   notif : {boolean} }
     */

    // カラムを追加
    addColumn : async function(
        tl_type,         // タイムライン種別文字列
        columnlabel,     // タイムライン更新ボタンラベル文字列
        userid,          // ユーザーID数字
        options_hash,    // カラムの設定ハッシュ
        parameters_hash, // 検索等のキーワードハッシュ
        win_type,
        temp_index) {
        if (tl_type == null || columnlabel == null || userid == null)
            throw new Error('PARAMETER_IS_NOT_DEFINED');

        win_type = win_type || TwitSideModule.WINDOW_TYPE.MAIN;
        if (win_type !== TwitSideModule.WINDOW_TYPE.MAIN && temp_index == null)
            throw new Error('INDEX_IS_REQUIRED');
        if (parameters_hash == null)
            parameters_hash = {};

        // オブジェクトコピー
        options_hash = Object.assign({}, options_hash);
        parameters_hash = Object.assign({}, parameters_hash);

        // カラム作成
        const columnindex = win_type !== TwitSideModule.WINDOW_TYPE.MAIN
              ? temp_index : this.count();
        await this._writeColumns(columnindex, tl_type, columnlabel, userid,
                                 options_hash, parameters_hash, win_type);
        // カラム初期化
        const domid = this._initColumn(columnindex, win_type);

        // 更新通知
        await TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.COLUMN_CHANGED,
            action   : TwitSideModule.ACTION.ADD,
            index    : columnindex,
            columnid : domid,
            columninfo : this._columns[win_type][columnindex]
        }, null, win_type);
    },

    // カラムを編集
    editColumn : async function(columnindex, update_info_hash, win_type) {
        if (columnindex == null || update_info_hash == null)
            throw new Error('PARAMETER_IS_NOT_DEFINED');

        win_type = win_type || TwitSideModule.WINDOW_TYPE.MAIN;

        const columninfo  = this._columns[win_type][columnindex],
              tl          = this._timelines[win_type][columnindex].timeline,
              tl_type     = columninfo.tl_type,
              columnlabel = update_info_hash.columnlabel || columninfo.columnlabel,
              userid      = columninfo.userid,
              options     = Object.assign({}, columninfo.options, update_info_hash.options),
              parameters  = Object.assign({}, columninfo.parameters, update_info_hash.parameters);

        // カラム更新
        await this._writeColumns(columnindex, tl_type, columnlabel, userid,
                                 options, parameters, win_type);
        // タイムライン更新
        this._updateTimeline(tl, this._columns[win_type][columnindex]);

        // 更新通知
        await TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.COLUMN_CHANGED,
            action   : TwitSideModule.ACTION.EDIT,
            index    : columnindex,
            columnid : this._timelines[win_type][columnindex].id,
            columninfo : this._columns[win_type][columnindex]
        }, null, win_type);
    },

    // カラムの順序を変更 tempは未使用
    sortColumn : async function(oldindex, newindex) {
        const win_type = TwitSideModule.WINDOW_TYPE.MAIN;

        for (let index = oldindex;
             oldindex < newindex
             ? index < newindex
             : index > newindex;) {

            // 入れ替え
            [this._columns[win_type][index],
             this._columns[win_type][oldindex < newindex ? index+1 : index-1]]
                = [this._columns[win_type][oldindex < newindex ? index+1 : index-1],
                   this._columns[win_type][index]];
            // 入れ替え、ここでインクリメント、デクリメントする
            [this._timelines[win_type][index],
             this._timelines[win_type][oldindex < newindex ? ++index : --index]]
                = [this._timelines[win_type][oldindex < newindex ? index+1 : index-1],
                   this._timelines[win_type][index]];
        }

        // 値を保存
        await TwitSideModule.config.setPref('columns', JSON.stringify(this._columns[win_type]));
        // 更新通知
        await TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.COLUMN_CHANGED,
            action   : TwitSideModule.ACTION.SORT,
            old_index : oldindex,
            new_index : newindex,
            columnid : this._timelines[win_type][oldindex].id
        }, null, win_type);
    },

    // 設定上からカラムを削除
    deleteColumn : async function(columnindex, win_type) {
        if (columnindex == null) throw new Error('PARAMETER_IS_NOT_DEFINED');

        win_type = win_type || TwitSideModule.WINDOW_TYPE.MAIN;

        const target_columns   = this._columns[win_type],
              target_timelines = this._timelines[win_type];

        if (target_columns[columnindex] == null)
            throw new Error('COLUMN_IS_NOT_REGISTERED');

        const delete_id = target_timelines[columnindex].id,
              userid    = target_columns[columnindex].userid;

        target_timelines[columnindex].timeline.beforeDestroy();
        target_timelines[columnindex].timeline = null;
        delete target_timelines[columnindex];
        delete target_columns[columnindex];

        if (win_type === TwitSideModule.WINDOW_TYPE.MAIN) {
            const c = this.count();
            // カラムを詰める
            for (let i = columnindex; i < c; i++) {
                target_timelines[i] = target_timelines[i+1];
                target_columns[i]   = target_columns[i+1];
            }
            delete target_timelines[c];
            delete target_columns[c];

            // 値を保存
            await TwitSideModule.config.setPref('columns', JSON.stringify(this._columns[win_type]));
            // 更新通知
            await TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.COLUMN_CHANGED,
                action   : TwitSideModule.ACTION.DELETE,
                old_index : columnindex,
                columnid : delete_id
            }, null, win_type);

            // ユーザーが使用しているカラムが0件の場合は、ユーザーも削除
            if (this.count(userid) == 0)
                await TwitSideModule.ManageUsers.deleteUser(userid);
        }
    },

    // カラム検索
    searchColumn : function(query_hash, win_type) {
        win_type = win_type ||  TwitSideModule.WINDOW_TYPE.MAIN;

        const result_index = [];

        for (let idx in this._columns[win_type]) {
            let match = true;
            for (let key in query_hash) {
                // キー存在無し
                if (!this._columns[win_type][idx][key])
                    throw new Error('QUERY_KEY_IS_NOT_DEFINED');
                // キー不一致
                if (this._columns[win_type][idx][key] != query_hash[key]) {
                    match = false;
                    break;
                }
                // 残りは一致
            }
            if (match) result_index.push(idx);
        }
        return result_index;
    },

    // タイムライン検索
    searchTimeline : function(query_hash, win_type) {
        win_type = win_type ||  TwitSideModule.WINDOW_TYPE.MAIN;

        const result_index = [];

        for (let idx in this._timelines[win_type]) {
            let match = true;
            for (let key in query_hash) {
                // キー存在無し
                if (!this._timelines[win_type][idx][key])
                    throw new Error('QUERY_KEY_IS_NOT_DEFINED');
                // キー不一致
                if (this._timelines[win_type][idx][key] != query_hash[key]) {
                    match = false;
                    break;
                }
                // 残りは一致
            }
            if (match) result_index.push(idx);
        }
        return result_index;
    },

    // カラム設定を取得
    getColumnInfo : function(columnindex, key_str, win_type) {
        win_type = win_type || TwitSideModule.WINDOW_TYPE.MAIN;

        // columnindexが無い場合はすべてを返す
        if (columnindex == null) return this._columns[win_type];

        const column = this._columns[win_type][columnindex];

        if (column == null) throw new Error('COLUMN_IS_NOT_REGISTERED');
        // keyが無い場合はオブジェクトを返す
        if (!key_str) return column;

        if (column[key_str] === undefined) throw new Error('KEY_IS_NOT_DEFINED');
        // 値を返す
        return column[key_str];
    },

    // タイムライン情報を取得
    getTimelineInfo : function(columnindex, key_str, win_type) {
        win_type = win_type || TwitSideModule.WINDOW_TYPE.MAIN;

        // columnindexが無い場合はすべてを返す
        if (columnindex == null) return this._timelines[win_type];

        const timeline = this._timelines[win_type][columnindex];

        if (timeline == null) throw new Error('COLUMN_IS_NOT_REGISTERED');
        // keyが無い場合はオブジェクトを返す
        if (!key_str) return timeline;

        if (timeline[key_str] === undefined) throw new Error('KEY_IS_NOT_DEFINED');
        // 値を返す
        return timeline[key_str];
    },

    // 最終通知ID
    getLastNotifyId : function(columnid) {
        if (columnid == null) throw new Error('PARAMETER_IS_NOT_DEFINED');

        const columnindex = this.searchTimeline({ id : columnid })[0];
        return this._columns[TwitSideModule.WINDOW_TYPE.MAIN][columnindex].lastnotify || '0';
    },

    setLastNotifyId : async function(columnid, id) {
        if (columnid == null) throw new Error('PARAMETER_IS_NOT_DEFINED');

        const win_type = TwitSideModule.WINDOW_TYPE.MAIN;
        const columnindex = this.searchTimeline({ id : columnid })[0];
        this._columns[win_type][columnindex]['lastnotify'] = id;

        // 値を保存
        await TwitSideModule.config.setPref('columns', JSON.stringify(this._columns[win_type]));
    },

    // カラムの総数を取得
    count : function(userid, win_type) {
        win_type = win_type || TwitSideModule.WINDOW_TYPE.MAIN;

        const target = this._columns[win_type];
        let i = 0;

        for (let idx in target) {
            if (!userid) i++;
            else if (target[idx].userid == userid) i++;
        }
        return i;
    },

    // リセット
    reset : async function(win_type) {
        win_type = win_type || TwitSideModule.WINDOW_TYPE.MAIN;

        const target_columns   = this._columns[win_type],
              target_timelines = this._timelines[win_type];

        for (let idx in target_timelines) {
            target_timelines[idx].timeline.beforeDestroy();
            target_timelines[idx] = null;
            delete target_timelines[idx];
            delete target_columns[idx];
        }

        if (win_type === TwitSideModule.WINDOW_TYPE.MAIN) {
            // 値を保存
            await TwitSideModule.config.setPref('columns', JSON.stringify({}));
            // ユーザもリセット
            await TwitSideModule.ManageUsers.reset();
        }
        // 更新通知
        await TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.COLUMN_CHANGED,
            action   : TwitSideModule.ACTION.DELETE_ALL
        }, null, win_type);
    }
};
