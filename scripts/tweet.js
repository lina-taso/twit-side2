/**
 * @fileOverview Tweet Module
 * @name tweet.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

const TWEET_UL_CHUNK_SIZE = 1 * 1024 * 1024, // 1MB
      CONSUMER_KEY        = '8cJhiTxoeMV4z1c3bfLhw';

class Tweet {

    constructor(userinfo) {

        // Set initial consumer_key
        this.consumer_key = TwitSideModule.config.getPref('altkey') || CONSUMER_KEY;

        // userinfoが無いときは初回認証（request）時
        if (userinfo) {
            this.oauth_token        = userinfo.oauth_token;
            this.oauth_token_secret = userinfo.oauth_token_secret;
            if (userinfo.user_id)
                this.user_id        = userinfo.user_id;
        }

        TwitSideModule.debug.log('tweet.js: initialized userid ' + (this.user_id || 'initial'));
    }

    get basicValues() {
        return {
            'oauth_consumer_key'     : this.consumer_key,
            'oauth_nonce'            : '',
            'oauth_signature_method' : 'HMAC-SHA1',
            'oauth_timestamp'        : '',
            'oauth_token'            : this.oauth_token,
            'oauth_version'          : '1.0'
        };
    }

    static get userAgent() {
        return browser.runtime.getManifest().name + '/'
            + browser.runtime.getManifest().version;
    }

    // Authentication
    async request() {
        const data = {
            method  : 'GET',
            baseurl : TwitSideModule.urls.twit.oauthBase,
            url     : TwitSideModule.urls.twit.urlRequest
        };
        return await this._sendRequest('REQUEST', data);
        // return {url: URL to callback, userinfo: token hash} to callback
    }

    async access(pin) {
        return await this._sendRequest('ACCESS', {
            method  : 'POST',
            pin     : pin,
            baseurl : TwitSideModule.urls.twit.oauthBase,
            url     : TwitSideModule.urls.twit.urlAccess
        });
        // return token hash to callback
    }

    async getMessage() {
        return await this._createOauthSignature('MESSAGE', null, TwitSideModule.text.getUnixTime());
        // return messageTitle"\n"messageBody to callback
    }

    // 発言
    async tweet(optionsHash) {
        // optionsHash['weighted_character_count'] = 'true';
        const result = await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'POST',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlStatusesUpdate
        });
        return result;
    }

    // 発言
    async upload_media(optionsHash, files, progressFunc) {
        const media_ids = await this._uploadMedia({
            api     : 'UPLOAD',
            method  : 'POST',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.uploadBase,
            url     : TwitSideModule.urls.twit.urlMediaUpload,
            files   : files
        }, (e) => { progressFunc(e.loaded / e.total * 100); });
        return { media_ids : media_ids.join(',') };
    }

    // 公式リツイート
    async retweet(optionsHash, retweetid) {
        optionsHash['include_entities'] = 'true';
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'POST',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlStatusesRetweet + retweetid + '.json'
        });
    }

    // 指定IDのツイート読み込み
    async show(optionsHash) {
        optionsHash['tweet_mode'] = 'extended';
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'GET',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlStatusesShow
        });
    }

    // 指定IDのツイート削除
    async destroy(optionsHash, tweetid) {
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'POST',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlStatusesDestroy + tweetid + '.json'
        });
    }

    // ファボ一覧
    async favoritelist(optionsHash) {
        optionsHash['tweet_mode'] = 'extended';
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'GET',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlFavoritesList
        });
    }

    // ファボ
    async favorite(optionsHash) {
        optionsHash['include_entities'] = 'true';
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'POST',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlFavoritesCreate
        });
    }

    // アンファボ
    async unfavorite(optionsHash) {
        optionsHash['include_entities'] = 'true';
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'POST',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlFavoritesDestroy
        });
    }

    // タイムライン
    async timeline(optionsHash) {
        optionsHash['include_entities'] = 'true';
        optionsHash['tweet_mode']       = 'extended';
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'GET',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlStatusesHomeTimeline
        });
    }

    // ユーザータイムライン
    async userTimeline(optionsHash) {
        optionsHash['include_entities'] = 'true';
        optionsHash['tweet_mode']       = 'extended';
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'GET',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlStatusesUserTimeline
        });
    }

    // リストタイムライン
    async listTimeline(optionsHash) {
        optionsHash['include_entities'] = 'true';
        optionsHash['tweet_mode']       = 'extended';
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'GET',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlListsStatuses
        });
    }

    // つながり
    async connect(optionsHash) {
        optionsHash['include_entities'] = 'true';
        optionsHash['tweet_mode']       = 'extended';
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'GET',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlStatusesMentionsTimeline
        });
    }

    // リツイートされたツイート
    async retweeted(optionsHash) {
        optionsHash['include_entities'] = 'true';
        optionsHash['tweet_mode']       = 'extended';
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'GET',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlStatusesRetweetsOfMe
        });
    }

    // リツイートした人
    async retweeters(optionsHash) {
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'GET',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlStatusesRetweets
        });
    }

    // ユーザプロフィール（複数）
    async userLookup(optionsHash) {
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'GET',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlUsersLookup
        });
    }

    // ユーザプロフィール（単体詳細）
    async userShow(optionsHash) {
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'GET',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlUsersShow
        });
    }

    // フォロー
    async followlist(optionsHash) {
        optionsHash['stringify_ids'] = 'true';
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'GET',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlFriendsIds
        });
    }

    // フォロワー
    async followerlist(optionsHash) {
        optionsHash['stringify_ids'] = 'true';
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'GET',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlFollowersIds
        });
    }

    // ミュート
    async mutelist(optionsHash) {
        optionsHash['stringify_ids'] = 'true';
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'GET',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlMutesUsersIds
        });
    }

    // ミュート追加
    async mute(optionsHash) {
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'POST',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlMutesUsersCreate
        });
    }

    // ミュート削除
    async unmute(optionsHash) {
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'POST',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlMutesUsersDestroy
        });
    }

    // ブロック
    async blocklist(optionsHash) {
        optionsHash['stringify_ids'] = 'true';
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'GET',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlBlocksIds
        });
    }

    // ブロック追加
    async block(optionsHash) {
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'POST',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlBlocksCreate
        });
    }

    // ブロック削除
    async unblock(optionsHash) {
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'POST',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlBlocksDestroy
        });
    }

    // API制限
    async showAPI(optionsHash) {
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'GET',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlAPI
        });
    }

    // 検索
    async search(optionsHash) {
        optionsHash['include_entities'] = 'true';
        optionsHash['tweet_mode']       = 'extended';
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'GET',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlSearchTweets
        });
    }

    // フォロー
    async follow(optionsHash) {
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'POST',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlFriendshipsCreate
        });
    }

    // アンフォロー
    async unfollow(optionsHash) {
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'POST',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlFriendshipsDestroy
        });
    }

    // リツイートを表示しないユーザ
    async noretweets(optionsHash) {
        optionsHash['stringify_ids'] = 'true';
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'GET',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlFriendshipsNoRetweets
        });
    }

    // フレンドシップ更新
    async updateFriendship(optionsHash) {
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'POST',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlFriendshipsUpdate
        });
    }

    // フレンドシップ取得
    async showFriendship(optionsHash) {
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'GET',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlFriendshipsShow
        });
    }

    // ダイレクトメッセージ一覧（新API）
    async dmList2(optionsHash) {
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'GET',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlDirectMessagesEventsList
        });
    }

    // ダイレクトメッセージ削除（新API）
    async destroyDm2(optionsHash) {
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'DELETE',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlDirectMessagesEventsDestory
        });
    }

    // ダイレクトメッセージ作成（新API）
    async dmNew2(optionsHash) {
        const result = await this._sendRequest('SIGNATURE', {
            api     : 'API_JSON',
            method  : 'POST',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlDirectMessagesEventsNew
        });
        return result;
    }

    // 自分のリスト一覧
    async ownershipListsList(optionsHash) {
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'GET',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlListsOwnerships
        });
    }

    // 購読リスト一覧
    async subscriptionListsList(optionsHash) {
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'GET',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlListsSubscriptions
        });
    }

    // フォローされたリスト一覧
    async membershipListsList(optionsHash) {
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'GET',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlListsMemberships
        });
    }

    // リスト購読者一覧
    async listSubscribers(optionsHash) {
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'GET',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlListsSubscribers
        });
    }

    // リストメンバー一覧
    async listMembers(optionsHash) {
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'GET',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlListsMembers
        });
    }

    // リスト購読
    async subscribeList(optionsHash) {
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'POST',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlListsSubscribersCreate
        });
    }

    // リスト購読解除
    async unsubscribeList(optionsHash) {
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'POST',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlListsSubscribersDestroy
        });
    }

    // リストメンバー追加
    async createListMembers(optionsHash) {
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'POST',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlListsMembersCreateAll
        });
    }

    // リストメンバー削除
    async destroyListMembers(optionsHash) {
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'POST',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlListsMembersDestroyAll
        });
    }

    // リスト作成
    async createList(optionsHash) {
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'POST',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlListsCreate
        });
    }

    // リスト修正
    async updateList(optionsHash) {
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'POST',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlListsUpdate
        });
    }

    // リスト削除
    async destroyList(optionsHash) {
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'POST',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlListsDestroy
        });
    }

    // 現状設定取得
    async configuration(optionsHash) {
        return await this._sendRequest('SIGNATURE', {
            api     : 'API',
            method  : 'GET',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.apiBase,
            url     : TwitSideModule.urls.twit.urlHelpConfiguration
        });
    }

    // DM OAuth
    async dmOAuth(urlpath, optionsHash) {
        return await this._sendRequest('SIGNATURE', {
            api     : 'TON',
            method  : 'GET',
            options : optionsHash,
            baseurl : TwitSideModule.urls.twit.tonBase,
            url     : urlpath
        });
    }

    // リクエストの振り分け
    // cb, errorはストリーム用
    async _sendRequest(type, data_hash, cb, error) {
        const timestamp = TwitSideModule.text.getUnixTime();

        switch (type) {
        case 'REQUEST':
            break;
        case 'ACCESS':
            if (!this.oauth_token || !this.oauth_token_secret) return null;
            data_hash.oauth_token        = this.oauth_token;
            data_hash.oauth_token_secret = this.oauth_token_secret;
            break;
        case 'SIGNATURE':
            data_hash.oauth_token        = this.oauth_token;
            data_hash.oauth_token_secret = this.oauth_token_secret;
            switch (data_hash.api) {
            case 'MULTI':
            case 'UPLOAD':
            case 'API_JSON':
                data_hash.form = TwitSideModule.hash.hash2sortedForm({
                    url : data_hash.url
                });
                break;
            default:
                data_hash.form = TwitSideModule.hash.hash2sortedForm(
                    Object.assign({ url : data_hash.url }, data_hash.options)
                );
            }
            break;
        default:
            return null;
        }

        const signature = await this._createOauthSignature(type, data_hash, timestamp);
        return await this._send2Twitter(type, data_hash, timestamp, cb, error, signature);
    }

    async _uploadMedia(data_hash, cb) {
        const media_uploading = [];
        // 待ち関数
        const timer = (secs) => {
            return new Promise((resolve, reject) => {
                setTimeout(() => { resolve(); }, secs * 1000);
            });
        };

        data_hash.oauth_token        = this.oauth_token;
        data_hash.oauth_token_secret = this.oauth_token_secret;

        // アップロード並列処理
        for (let file of data_hash.files) {
            // INIT
            const timestamp_init = TwitSideModule.text.getUnixTime(),
                  data_hash_init = Object.assign({
                      form    : TwitSideModule.hash.hash2sortedForm({ url : data_hash.url })
                  }, data_hash, {
                      options : Object.assign({}, data_hash.options, {
                          command     : 'INIT',
                          media_type  : file.type,
                          total_bytes : file.size
                      })
                  });

            const uploading = async () => {
                // 同時接続数計測ループ
                const wait_connection = async (segment) => {
                    const MAX_CONN = 10;
                    if (segment >= MAX_CONN) {
                        // 完了済コネクション
                        const done = seg_uploading_percent.filter((ele) => ele == 1).length;
                        // 待機
                        if ((segment - done) >= MAX_CONN) {
                            await timer(5);
                            await wait_connection(segment);
                            return;
                        }
                        // 接続開始
                        else return;
                    }
                    else return;
                };
                const update_progress = (segment, cb, e) => {
                    seg_uploading_percent[segment] = e.loaded / e.total;
                    const loaded = seg_uploading_percent
                          .reduce((prev, current, i, arr) => {
                              return prev + current;
                          }) / seg_uploading_percent.length;

                    cb({ loaded : loaded, total : 1 });
                };

                const signature_init = await this._createOauthSignature('SIGNATURE',
                                                                        data_hash_init, timestamp_init);
                const response_init  = await this._send2Twitter('SIGNATURE',
                                                                data_hash_init, timestamp_init,
                                                                cb, null, signature_init);
                const media_id       = response_init.data.media_id_string;

                // APPEND
                // 先にシグネチャ生成
                const timestamp_append = TwitSideModule.text.getUnixTime(),
                      data_hash_append = {
                          api                : data_hash.api,
                          method             : 'POST',
                          oauth_token        : data_hash.oauth_token,
                          oauth_token_secret : data_hash.oauth_token_secret,
                          baseurl            : data_hash.baseurl,
                          url                : data_hash.url,
                          options            : {
                              command  : 'APPEND',
                              media_id : media_id
                          },
                          form : TwitSideModule.hash.hash2sortedForm({ url : data_hash.url })
                      };

                const signature_append = await this._createOauthSignature('SIGNATURE',
                                                                          data_hash_append, timestamp_append);

                // 分割
                const segments = Math.ceil(file.size / TWEET_UL_CHUNK_SIZE),
                      seg_uploading = [],
                      seg_uploading_percent = new Array(segments);

                for (let i=0; i<segments; i++) {
                    // セグメント毎のパラメータ
                    const data_hash_seg = Object.assign({}, data_hash_append, {
                        options : Object.assign({}, data_hash_append.options, {
                            media         : file.slice(TWEET_UL_CHUNK_SIZE * i,
                                                       TWEET_UL_CHUNK_SIZE * (i+1),
                                                       file.type),
                            segment_index : i
                        })
                    });

                    // アップロード
                    const uploading = wait_connection(i).then(
                        () => this._send2Twitter('SIGNATURE', data_hash_seg, timestamp_append,
                                                 e => update_progress(i, cb, e), null, signature_append));
                    seg_uploading.push(uploading);
                }

                await Promise.all(seg_uploading);

                // FINALIZE
                const timestamp_finalize = TwitSideModule.text.getUnixTime(),
                      data_hash_finalize = {
                          api                : data_hash.api,
                          method             : 'POST',
                          oauth_token        : data_hash.oauth_token,
                          oauth_token_secret : data_hash.oauth_token_secret,
                          baseurl            : data_hash.baseurl,
                          url                : data_hash.url,
                          options            : {
                              command  : 'FINALIZE',
                              media_id : media_id
                          },
                          form : TwitSideModule.hash.hash2sortedForm({ url : data_hash.url })
                      };

                const signature_finalize = await this._createOauthSignature('SIGNATURE',
                                                                            data_hash_finalize, timestamp_finalize);
                const response_finalize  = await this._send2Twitter('SIGNATURE',
                                                                    data_hash_finalize, timestamp_finalize,
                                                                    cb, null, signature_finalize);
                // STATUSチェックが必要
                if (response_finalize.data.processing_info) {
                    const data_hash_status = {
                        api                : data_hash.api,
                        method             : 'GET',
                        oauth_token        : data_hash.oauth_token,
                        oauth_token_secret : data_hash.oauth_token_secret,
                        baseurl            : data_hash.baseurl,
                        url                : data_hash.url + '?',
                        options            : {
                            command  : 'STATUS',
                            media_id : media_id
                        }
                    };

                    data_hash_status.form = TwitSideModule.hash.hash2sortedForm(
                        Object.assign({ url : data_hash_status.url }, data_hash_status.options)
                    );

                    // ステータスチェック用ループ
                    const loop = async () => {
                        // STATUS
                        const timestamp_status = TwitSideModule.text.getUnixTime();
                        const signature_status = await this._createOauthSignature('SIGNATURE',
                                                                                  data_hash_status, timestamp_status);
                        const response_status  = await this._send2Twitter('SIGNATURE',
                                                                          data_hash_status, timestamp_status,
                                                                          cb, null, signature_status);
                        // ステータスチェック
                        switch (response_status.data.processing_info.state) {
                        case 'succeeded':
                            return media_id;
                        case 'failed':
                            return Promise.reject((
                                { result : response_status.data.processing_info.error.message,
                                  error : new Error(),
                                  status : '' }));
                        case 'in_progress':
                            // Twitter処理率
                            cb({ loaded : response_status.data.processing_info.progress_percent || 0,
                                 total  : 100 });
                            // 待機時間（2回目以降）
                            await timer(response_status.data.processing_info.check_after_secs);
                            return loop();
                        default:
                            return Promise.reject();
                        }
                    };

                    // 待機時間（初回）
                    await timer(response_finalize.data.processing_info.check_after_secs);
                    return await loop();
                }
                // STATUSが完了
                else {
                    return media_id;
                }
            }; // uploading

            media_uploading.push(uploading());
        }
        return Promise.all(media_uploading);
    }

    _send2Twitter(type, data_hash, timestamp, cb, error, signature) {
        return new Promise((resolve, reject) => {

            const xhr  = new XMLHttpRequest(),
                  form = this.basicValues,
                  json = JSON.parse(signature);

            const returnRequest = () => {
                if (xhr.status == 200) {
                    const res = xhr.responseText.split('&'),
                          len = res.length,
                          oauthToken = {};

                    for (let i=0; i<len; i++) {
                        oauthToken[res[i].split('=')[0]] = res[i].split('=')[1];
                    }
                    // return URL and token
                    resolve({
                        url : TwitSideModule.urls.twit.oauthBase
                            + TwitSideModule.urls.twit.urlAuthorize
                            + 'oauth_token=' + oauthToken.oauth_token,
                        userinfo : oauthToken
                    });
                }
                else
                    reject({
                        result : 'commonError',
                        error  : new Error(),
                        status : xhr.status
                    });
            };

            const returnAccess = () => {
                if (xhr.status == 200) {
                    const res = xhr.responseText.split('&'),
                          len = res.length,
                          oauthToken = {};

                    for (let i=0; i<len; i++) {
                        oauthToken[res[i].split('=')[0]] = res[i].split('=')[1];
                    }
                    // return tokens
                    resolve(oauthToken);
                }
                else
                    reject({
                        result : 'commonError',
                        error  : new Error(),
                        status : xhr.status
                    });
            };

            const returnResponse = () => {
                switch (data_hash.api) {
                case 'TON':
                    if (xhr.status == 200) {
                        resolve({ data : xhr.response });
                        return;
                    }
                    break;
                case 'UPLOAD':
                    if (xhr.status >= 200 && xhr.status < 300) {
                        if (xhr.getResponseHeader('Content-Type').indexOf('application/json') != -1)
                            resolve({ data : JSON.parse(xhr.responseText) });
                        else
                            resolve({ data : null });
                        return;
                    }
                    break;
                default:
                    if (xhr.status == 200) {
                        if (xhr.getResponseHeader('Content-Type').indexOf('application/json') != -1)
                            resolve({ data : JSON.parse(xhr.responseText) });
                        else
                            reject({
                                result : 'commonError',
                                error  : new Error(),
                                status : xhr.status
                            });
                        return;
                    }
                    // DELETE method
                    else if (xhr.status == 204) {
                        resolve({ data : null });
                    }
                }

                // エラー
                if (xhr.responseText) {
                    if (xhr.getResponseHeader('Content-Type')
                        .indexOf('application/json') != -1 &&
                        JSON.parse(xhr.responseText).errors)
                        reject({
                            result : JSON.parse(xhr.responseText).errors[0],
                            error  : new Error(),
                            status : xhr.status
                        });
                    else reject({
                        result : xhr.responseText,
                        error  : new Error(),
                        status : xhr.status
                    });
                }
                else
                    reject({ result : 'noResponse',
                             error : new Error(),
                             status : xhr.status });
            };

            const createFormData = (dataHash) => {
                const formData = new FormData();
                for (let key in dataHash)
                    formData.append(key, dataHash[key]);
                return formData;
            };

            let param      = '',
                authHeader = '';

            form.oauth_timestamp = timestamp;
            form.oauth_nonce     = json.oauth_nonce;
            form.oauth_signature = json.oauth_signature;

            // タイムアウト初期値
            xhr.timeout = TwitSideModule.config.getPref('timeout') * 1000;
            // エラー初期値
            xhr.onerror = () => { reject('networkError'); };

            switch (type) {
            case 'REQUEST':
                delete form.oauth_token;
                param = TwitSideModule.hash.hash2sortedForm(form);
                xhr.open('GET', data_hash.baseurl + data_hash.url + param);
                xhr.onload = returnRequest;
                break;
            case 'ACCESS':
                form.oauth_verifier = data_hash.pin;
                param = TwitSideModule.hash.hash2sortedForm(form);
                xhr.open('POST', data_hash.baseurl + data_hash.url);
                xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
                xhr.setRequestHeader('Authorization', 'OAuth');
                xhr.onload = returnAccess;
                break;
            case 'SIGNATURE':
                param = TwitSideModule.hash.hash2sortedForm(data_hash.options);
                authHeader = TwitSideModule.hash.hash2oauthHeader(form);

                switch (data_hash.method) {
                case 'GET':
                    xhr.open('GET', data_hash.baseurl + data_hash.url + param);
                    break;
                case 'POST':
                    xhr.open('POST', data_hash.baseurl + data_hash.url);
                    if (!/^(MULTI|UPLOAD|API_JSON)$/.test(data_hash.api))
                        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
                    break;
                case 'DELETE':
                    xhr.open('DELETE', data_hash.baseurl + data_hash.url + param);
                    data_hash.method = 'GET';
                    break;
                }

                switch (data_hash.api) {
                case 'TON':
                    xhr.responseType = 'blob';
                    break;
                case 'MULTI':
                    param = createFormData(data_hash.options);
                    // タイムアウト
                    xhr.timeout = TwitSideModule.config.getPref('timeout_upload') * 1000;
                    // プログレスバー
                    xhr.upload.onprogress = cb;
                    break;
                case 'UPLOAD':
                    param = createFormData(data_hash.options);
                    // タイムアウト
                    xhr.timeout = TwitSideModule.config.getPref('timeout_upload') * 1000;
                    // プログレスバー
                    xhr.upload.onprogress = cb;
                    break;
                case 'API_JSON':
                    xhr.setRequestHeader('Content-Type', 'application/json');
                    param = JSON.stringify(data_hash.options);
                    break;
                }
                xhr.setRequestHeader('Authorization', authHeader);
                xhr.onload = returnResponse;
                break;
            default:
                return;
            }

            xhr.setRequestHeader('User-Agent', Tweet.userAgent);
            xhr.ontimeout = function() { reject('timeout'); };
            xhr.send(data_hash.method === 'GET' ? null : param);
        });
    }

    // 認証サーバへシグネチャ取得
    _createOauthSignature(type, data_hash, timestamp) {
        return new Promise(async (resolve, reject) => {

            const xhr = new XMLHttpRequest();
            const returnSignature = () => {
                if (xhr.status == 200) resolve(xhr.responseText);
                else if (xhr.status == 500) reject('authError');
                else reject(xhr.statusText);
            };

            switch (type) {
            case 'REQUEST':
                xhr.open('GET', TwitSideModule.urls.auth.urlBase
                         + TwitSideModule.urls.auth.urlRequest
                         + timestamp);
                break;
            case 'ACCESS':
                xhr.open('GET', TwitSideModule.urls.auth.urlBase
                         + TwitSideModule.urls.auth.urlAccess
                         + timestamp
                         + '/' + data_hash.oauth_token
                         + '/' + data_hash.pin
                         + '/' + data_hash.oauth_token_secret);
                break;
            case 'MESSAGE':
                xhr.open('GET', TwitSideModule.urls.auth.urlBase
                         + TwitSideModule.urls.auth.urlMessage
                         + timestamp);
                break;
            case 'SIGNATURE':
                let api = data_hash.api;
                if (api == 'API_JSON') api = 'API';
                xhr.open('POST', TwitSideModule.urls.auth.urlBase
                         + TwitSideModule.urls.auth.urlSignature
                         + timestamp
                         + '/' + api
                         + '/' + data_hash.method
                         + '/' + data_hash.oauth_token
                         + '/' + data_hash.oauth_token_secret);
                xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
                break;
            }

            xhr.setRequestHeader('User-Agent', Tweet.userAgent);
            xhr.timeout   = TwitSideModule.config.getPref('timeout') * 1000;
            xhr.onerror   = () => { reject('networkError'); };
            xhr.ontimeout = () => { reject('timeout'); };
            xhr.onload    = returnSignature;
            xhr.send(data_hash && data_hash.form || null);
        });
    }
}
