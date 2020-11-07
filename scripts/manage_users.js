/**
 * @fileOverview Manageing Twit Side user accounts
 * @name manage_users.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

const USERS_INTERVAL = 900 * 1000; // 900sec

if (!TwitSideModule) var TwitSideModule = {};

TwitSideModule.ManageUsers = {

    initialize : function() {
        this._userUpdated = {};

        // ユーザ情報定期更新開始
        this.updateAllUsersInfo();
        this.autoUpdateTimer = setInterval(() => {
            this.updateAllUsersInfo();
        }, USERS_INTERVAL);

        // メッセージ取得
        this.getServersideMessage();

        TwitSideModule.debug.log('Manage users initialized');
    },

    // ユーザ情報の更新
    _updateUser : async function(userid, userinfo) {
        // 保存値読み込み、保存されていない場合は初期ハッシュ
        const users = JSON.parse(TwitSideModule.config.getPref('users') || '{}');
        let updated = false;

        if (users[userid].screen_name != userinfo.screen_name) {
            users[userid].screen_name = userinfo.screen_name;
            updated = true;
        }
        if (!users[userid].profile_image_url
            || users[userid].profile_image_url != userinfo.profile_image_url) {
            users[userid].profile_image_url = userinfo.profile_image_url;
            updated = true;
        }

        // 設定更新無し
        if (!updated) return null;
        // 設定に保存
        await TwitSideModule.config.setPref('users', JSON.stringify(users));
        return users[userid];
    },

    get profileKyes() {
        return ['oauth_token',
                'oauth_token_secret',
                'user_id',
                'screen_name'];
    },

    // ユーザIDを順番に列挙した配列
    get allUserid() {
        // 保存値読み込み、保存されていない場合は初期ハッシュ
        const users = JSON.parse(TwitSideModule.config.getPref('users') || '{}');
        return Object.keys(users);
    },

    // 初回サーバサイドメッセージ
    getServersideMessage : async function() {
        const tweet          = new Tweet(),
              message        = JSON.parse(await tweet.getMessage().catch((e) => {
                  TwitSideModule.debug.log(e);
                  return Promise.reject();
              })),
              lang           = browser.i18n.getUILanguage() == 'ja' ? 'ja' : 'en',
              // 非表示一覧
              hidden_message = JSON.parse(TwitSideModule.config.getPref('hidden_message'));

        // 通知しない
        if (!message.notify) return;

        for (let notif of message.notifications) {
            // 非表示チェック
            if (hidden_message.indexOf(notif.id) >= 0)
                continue;
            // 掲載日時チェック
            if (notif.term && notif.term.start
                && new Date(notif.term.start) > Date.now())
                continue;
            if (notif.term && notif.term.end
                && new Date(notif.term.end) < Date.now())
                continue;
            // バージョンチェック
            if (notif.version && notif.version.min
                && notif.version.min > browser.runtime.getManifest().version)
                continue;
            if (notif.version && notif.version.max
                && notif.version.max < browser.runtime.getManifest().version)
                continue;

            TwitSideModule.Message.showNotification({
                id       : notif.id,
                urls     : notif.urls,
                userid   : '-1',
                title    : notif.title[lang],
                content  : notif.message[lang],
                datetime : notif.term.start
                    ? ~~((new Date(notif.term.start)).getTime() / 1000)
                    : null
            });
        }
    },

    // OAuth認証後のパラメータから設定上にユーザを追加
    addUser : async function(oauth_hash) {
        if (oauth_hash == null) throw new Error('PARAMETER_IS_NOT_DEFINED');

        // 保存値読み込み、保存されていない場合は初期ハッシュ
        const users = JSON.parse(TwitSideModule.config.getPref('users') || '{}');
        // ユーザ既存
        if (users[oauth_hash.user_id] != null) throw new Error('userAlready');

        users[oauth_hash.user_id] = {};
        // キー名称変換
        for (let key of this.profileKyes)
            users[oauth_hash.user_id][key] = oauth_hash[key];
        // 設定に保存
        await TwitSideModule.config.setPref('users', JSON.stringify(users));
        // 更新通知
        await TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.USER_CHANGED
        }, null, TwitSideModule.WINDOW_TYPE.MAIN);
        // プロフィール画像取得
        await this.updateUserInfo(oauth_hash.user_id);
    },

    // 設定上からユーザを削除
    deleteUser : async function(userid) {
        if (userid == null) throw new Error('PARAMETER_IS_NOT_DEFINED');

        // 保存値読み込み、保存されていない場合は初期ハッシュ
        const users = JSON.parse(TwitSideModule.config.getPref('users') || '{}');
        if (users[userid] == null) throw new Error('USER_IS_NOT_REGISTERED');
        delete this._userUpdated[userid];
        delete users[userid];

        // 設定に保存
        await TwitSideModule.config.setPref('users', JSON.stringify(users));
        // 更新通知
        await TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.USER_CHANGED
        }, null, TwitSideModule.WINDOW_TYPE.MAIN);
    },

    // 全ユーザの情報を最新化
    updateAllUsersInfo : async function() {
        const users   = this.allUserid,
              updates = [];

        for (let userid of users)
            updates.push(this.updateUserInfo(userid));

        await Promise.all(updates);
    },

    // ユーザ情報を最新化
    updateUserInfo : async function(userid) {
        // 保存値読み込み、保存されていない場合は初期ハッシュ
        const users = JSON.parse(TwitSideModule.config.getPref('users') || '{}');

        // 最終アップデート時刻確認
        if (this._userUpdated[userid]
            && this._userUpdated[userid] + USERS_INTERVAL > TwitSideModule.text.getUnixTime())
            return null;

        const tweet  = new Tweet(users[userid]),
              result = await tweet.userShow({
                  user_id : users[userid].user_id
              }).catch((e) => {
                  TwitSideModule.debug.log(e);
                  return Promise.reject();
              });

        const userinfo = {
            profile_image_url : result.data.profile_image_url_https,
            screen_name       : result.data.screen_name
        };

        // 設定保存
        const userinfoUpdated = await this._updateUser(userid, userinfo);
        if (userinfoUpdated) {
            // 更新通知
            await TwitSideModule.windows.sendMessage({
                reason   : TwitSideModule.UPDATE.USER_CHANGED
            }, null, TwitSideModule.WINDOW_TYPE.MAIN);
        }

        // アップデート時刻更新
        this._userUpdated[userid] = TwitSideModule.text.getUnixTime();

        // mute, block, noretweet取得
        return Promise.all([
            TwitSideModule.Friends.loadFriendIdList(TwitSideModule.FRIEND_TYPE.MUTE, tweet, null),
            TwitSideModule.Friends.loadFriendIdList(TwitSideModule.FRIEND_TYPE.BLOCK, tweet, null),
            TwitSideModule.Friends.loadFriendIdList(TwitSideModule.FRIEND_TYPE.NORETWEET, tweet, null)
        ]).catch((e) => {
            TwitSideModule.debug.log(e);
            return Promise.reject();
        });
    },

    // ユーザ設定を取得
    getUserInfo : function(userid, key) {
        // 保存値読み込み、保存されていない場合は初期ハッシュ
        const users = JSON.parse(TwitSideModule.config.getPref('users') || '{}');

        // useridが無い場合はすべてを返す
        if (!userid) return users;

        // useridが-1の時はTwitSide
        if (userid == -1) {
            const ts_user = {
                oauth_token        : '',
                oauth_token_secret : '',
                user_id            : -1,
                screen_name        : 'from Twit Side',
                profile_image_url  : browser.extension.getURL('images/logo-32.png')
            };
            if (!key) return ts_user;
            if (ts_user[key] === undefined) throw new Error('KEY_IS_NOT_DEFINED');
            return ts_user[key];
        }

        // 通常のユーザ
        if (users[userid] == null) throw new Error('USER_IS_NOT_REGISTERED');
        // keyが無い場合はオブジェクトを返す
        if (!key) return users[userid];

        if (users[userid][key] === undefined) throw new Error('KEY_IS_NOT_DEFINED');
        // 値を返す
        return users[userid][key];
    },

    // リセット
    reset : async function() {
        this._userUpdated = {};
        await TwitSideModule.config.setPref('users', JSON.stringify({}));
        // 更新通知
        await TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.USER_CHANGED
        }, null, TwitSideModule.WINDOW_TYPE.MAIN);
    }
};
