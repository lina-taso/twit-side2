/**
 * @fileOverview status code definition shared by content script and background script
 * @name common_code.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

if (!TwitSideModule) var TwitSideModule = {};

// update notify (from background to content)
TwitSideModule.UPDATE = {
    TWEET_LOADED :     1,  // ツイート取得後
    REPLACE_LOADED :   2,  // 既存ツイートの差し替え時
    REPLY_LOADED :     3,  // 返信ツイート取得時
    PROGRESS :         5,  // 画像ツイート進捗
    IMAGE_LOADED :     8,  // 画像イメージ更新時
    TWEET_DELETED :    9,  // 既存ツイートの削除時
    TWEET_ALLDELETED : 10, // 既存ツイートの削除時
    STATE_CHANGED :    11, // タイムラインのステータス更新時
    ACTION_COMPLETED : 12, // ツイートの操作完了時
    MESSAGE      :     21, // メッセージ受信時
    NOTIF_CHANGED :    22, // 通知内容更新時
    VOTE_REQUIRED :    23, // 投票
    UI_CHANGED :       31, // UI更新時
    COLUMN_CHANGED :   32, // カラム情報更新時
    BUTTON_CHANGED :   33, // ツールバーボタン更新時
//    WINDOW_CHANGED :   34, // ウィンドウ更新時
    USER_CHANGED :     41, // ユーザ情報更新時
    RUN_FUNCTION :     51, // メインウィンドウ向け関数実行時
    ERROR :            91  // エラー時
};

TwitSideModule.TL_STATE = {
    STOPPED :         1,  // 取得前、取得後停止
    STARTING :        11, // 最新ツイート取得中
    STARTED :         12, // ツイート取得後：自動更新動作中
    LOADING :         13, // ツイート取得後：過去、途中ツイート取得中
    LOADED :          14  // ツイート取得後：過去、途中ツイート取得後
};

// columns, addcolumnsと連携
TwitSideModule.TL_TYPE = {
    TIMELINE_V2 :   101,
    CONNECT_V2 :    102,
    FAVORITE_V2 :   104,
    TIMELINE :      1,
    CONNECT :       2,
    RETWEETED :     3,
    FAVORITE :      4,
    DIRECTMESSAGE : 5,
    SEARCH :        6,
    LISTTIMELINE :  7,
    TEMP_USERTIMELINE_V2 :   111,
    TEMP_FAVORITE_V2 :       114,
    TEMP_USERTIMELINE :      11,
    TEMP_FOLLOW :            12,
    TEMP_FOLLOWER :          13,
    TEMP_FAVORITE :          14,
    TEMP_OWNERSHIPLISTS :    15,
    TEMP_SUBSCRIPTIONLISTS : 16,
    TEMP_MEMBERSHIPLISTS :   17,
    TEMP_DIRECTMESSAGE :     18,
    TEMP_SEARCH :            21,
    TEMP_MUTE :              31,
    TEMP_BLOCK :             32,
    TEMP_NORETWEET :         33,
    TEMP_LISTMEMBER :        34,
    TEMP_LISTSUBSCRIBER :    35
};

TwitSideModule.getTimelineName = (tl_type) => {
    const tlNameMap = new Map([
        [101,'timeline_v2'],
        [102,'connect_v2'],
        [104,'favorite_v2'],
        [1,  'timeline'],
        [2,  'connect'],
        [3,  'retweeted'],
        [4,  'favorite'],
        [5,  'directmessage'],
        [6,  'search'],
        [7,  'listtimeline'],
        [111,'usertimeline_v2'],
        [114,'favorite_v2'],
        [11, 'usertimeline'],
        [12, 'follow'],
        [13, 'follower'],
        [14, 'favorite'],
        [15, 'ownershiplists'],
        [16, 'subscriptionlists'],
        [17, 'membershiplists'],
        [18, 'directmessage'],
        [21, 'search'],
        [31, 'mute'],
        [32, 'block'],
        [33, 'noretweet'],
        [34, 'listmember'],
        [35, 'listsubscriber']
    ]);

    return tlNameMap.get(tl_type);
};

TwitSideModule.WINDOW_TYPE = {
    MAIN :     1,
    PROFILE :  2,
    SEARCH :   3,
    MUTE :     4,
    BLOCK :    5,
    NORETWEET: 6,
    LISTMEMBER:7
};

TwitSideModule.FRIEND_TYPE = {
    FOLLOW :    1,
    FOLLOWER :  2,
    MUTE :      3,
    BLOCK :     4,
    NORETWEET : 5
};

TwitSideModule.FUNCTION_TYPE = {
    QUOTE :   1,
    RT :      2,
    REPLY :   3,
    REPLYALL: 4,
    NEWTWEET: 11
};

TwitSideModule.ACTION = {
    ADD :        1,
    EDIT :       2,
    SORT :       3,
    DELETE :     11,
    DELETE_ALL : 12
};
