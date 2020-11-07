/**
 * @fileOverview Managing Windows
 * @name manage_windows.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

if (!TwitSideModule) var TwitSideModule = {};

TwitSideModule.ManageWindows = {
    _windows : {},

    _options : {
        profile : {
            url   : '/ui/profile.xhtml',
            width : 550, height : 750,
        },
        search : {
            url   : '/ui/search.xhtml',
            width : 550, height : 750,
        },
        columns : {
            url   : '/ui/columns.xhtml',
            width : 900, height : 600,
        },
        ts_mutes : {
            url   : '/ui/ts_mutes.xhtml',
            width : 800, height : 600,
        },
        newdm : {
            url   : '/ui/newdm.xhtml',
            width : 600, height : 400,
        },
        text : {
            url   : '/ui/text.xhtml',
            width : 400, height : 300,
        },
        mute : {
            url   : '/ui/mute.xhtml',
            width : 550, height : 750,
        },
        block : {
            url   : '/ui/block.xhtml',
            width : 550, height : 750,
        },
        noretweet : {
            url   : '/ui/noretweet.xhtml',
            width : 550, height : 750,
        },
        listmember : {
            url   : '/ui/listmember.xhtml',
            width : 550, height : 750,
        },
        photo : {
            url   : '/ui/photo.xhtml',
            width : 800, height : 600,
        },
        api : {
            url   : '/ui/api.xhtml',
            width : 800, height : 600,
        }
    },

    openWindow : async function(suffix, parameters, mainWindowId) {
        const url = this._options[suffix].url + '?' + TwitSideModule.hash.hash2sortedForm(parameters);
        const createWindow = async () => {
            const win = await browser.windows.create(
                Object.assign({ type : 'panel' }, this._options[suffix],
                              { url : url })
            );
            this._windows[suffix] = {
                windowId : win.id,
                openerId : mainWindowId
            };
        };

        if (this._windows[suffix]) {
            const win = await browser.windows.get(this._windows[suffix].windowId,
                                                  { populate : true })
                  .catch(() => {
                      // 新規
                      createWindow();
                  });
            // 既存
            if (win) {
                await browser.tabs.update(win.tabs[0].id,
                                          { url : url });
                await browser.windows.update(win.id, { focused : true });
                this._windows[suffix].openerId = mainWindowId;
            }
        }
        else
            // 新規
            createWindow();
    },

    getOpenerId : function(suffix) {
        if (!this._windows[suffix]) return null;
        return this._windows[suffix].openerId;
    }
};
