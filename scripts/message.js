/**
 * @fileOverview Managing notifiactions
 * @name message.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

if (!TwitSideModule) var TwitSideModule = {};

TwitSideModule.Message = {

    _notifications : {}, // {id : {userid, title, content, datetime, boxid}, ...}
    _lastid        : 0,  // 特にカウントしているわけではない（重複防止）

    // エラーメッセージを解釈
    getErrorMessage : function(error) {
        return browser.i18n.getMessage(error.toString()) || error.toString();
    },

    // 通知一覧を取得（最初からの指定件数分）
    getNotifications : function() {
        const count   = TwitSideModule.config.getPref('notif_count'),
              ids     = Object.keys(this._notifications).sort().reverse(),
              retdata = [];

        for (let id of ids.slice(0, count))
            retdata.push(Object.assign({
                id       : id,
                userinfo : TwitSideModule.ManageUsers.getUserInfo(this._notifications[id].userid)
            }, this._notifications[id]));

        return { count : count, data : retdata, next : ids.length > count };
    },

    /**
     * parameter format
     * 1. ({result: String, error: Error object, status: xhr.status})
     * 2. (Error object)
     * 3. (String)
     */
    // メッセージ変換
    transMessage : function(error) {
        let content,
            forceText = true;

        TwitSideModule.debug.log(error);

        // エラーが何も無い
        if (!error)
            content = this.getErrorMessage('unknownError');

        // コールバック関数からのエラー
        else if (error.error != null
                 && error.result != null
                 && error.status != null) {

            // Twitterのリザルトコードを採用出来るとき
            if (error.result.code
                && this.getErrorMessage('code'+error.result.code) != 'code'+error.result.code) {
                content = this.getErrorMessage('code'+error.result.code);
            }
            // TwitterのMessageを採用出来るとき
            else if (error.result.message) {
                content = error.result.message;

                if (error.status)
                    content += ' (HTTP'+error.status+')';
            }
            // メッセージが文字列でそのまま利用できるとき
            else if (typeof(error.result) == 'string'
                     && this.getErrorMessage(error.result) == error.result)
                content = this.getErrorMessage(error.result);

            // HTTPのステータスコードを採用出来るとき
            else if (error.status
                     && (this.getErrorMessage('http'+error.status) != 'http'+error.status))
                content = this.getErrorMessage('http'+error.status);

            // XHRの生データを採用出来るとき
            else if (typeof(error.result) == 'string') {
                if (error.result.match(/Twitter\s\/\sOver\scapacity/m))
                    content = this.getErrorMessage('overCapacity');

                else
                    content = error.result;
            }

            // debug message
            if (TwitSideModule.config.debug)
                content += '\n('+error.error.fileName+' : '+error.error.lineNumber+')';
        }

        // 直接のエラー new Error()を受け取ったとき
        else if (error.message != null)
            content = this.getErrorMessage(error.message)
            + '\n('+error.fileName+' : '+error.lineNumber+')';

        // メッセージが文字列
        else if (typeof(error) == 'string')
            content = this.getErrorMessage(error);

        // その他
        else content = this.getErrorMessage('unknownError');

        return [content, forceText];
    },

    // 一覧に追加、通知表示
    showNotification : function(data, popuponly) {
        // id 払い出し
        const id = data.id || 'notif_'
              + TwitSideModule.text.getUnixTime()
              + (('000'+this._lastid).slice(-3));
        this._lastid++;

        // 整形 (userid, title, content, datetime, boxid)
        data.userid   = data.userid || '';
        data.title    = data.title || '';
        data.datetime = data.datetime || TwitSideModule.text.getUnixTime();
        data.content  = TwitSideModule.text.unescapeHTML(data.content)
            .replace(/\n/g, TwitSideModule.config.getPref('linefeed') ? '\n' : ' ');
        data.icon     = data.icon || browser.extension.getURL('images/logo.svg');
        data.boxid    = data.boxid || '';

        // ポップアップ
        browser.notifications.create('twit-side-'+id, {
            type    : 'basic',
            iconUrl : data.icon,
            title   : data.title,
            message : data.content
        });

        // 通知登録
        if (!popuponly) {
            this._notifications[id] = data;

            // 通知
            TwitSideModule.windows.sendMessage({
                reason : TwitSideModule.UPDATE.NOTIF_CHANGED
            });

            // バッジ
            browser.browserAction.setBadgeText({
                text : Object.keys(this._notifications).length.toString()
            });
        }
    },

    // 通知を削除
    removeNotifications : function(ids) {
        // 指定削除
        if (ids) {
            for (let id of ids)
                delete this._notifications[id];
        }
        // 全削除
        else
            this._notifications = {};

        // 通知
        TwitSideModule.windows.sendMessage({
            reason : TwitSideModule.UPDATE.NOTIF_CHANGED
        });

        // バッジ
        browser.browserAction.setBadgeText({
            text : Object.keys(this._notifications).length
                ? Object.keys(this._notifications).length.toString()
                : ''
        });
    },

    // エラー投げ（background用）
    throwError : function(error) {
        const tsException = (message) => {
            let text_flag = false;
            if (Array.isArray(message)) [message, text_flag] = message;

            this.message   = message;
            this.text_flag = text_flag;
            this.toString  = message;
        };

        const message = this.transMessage(error);
        TwitSideModule.debug.log(message);
        throw new tsException(message);
    }
};
