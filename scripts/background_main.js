/**
 * @fileOverview Main background script
 * @name background_main.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

const firstrun_url = 'https://www2.filewo.net/wordpress/category/products/twit-side-addon/',
      sidebar_url  = browser.runtime.getURL('/ui/sidebar.xhtml');

this.initialized = false;

const startup = () => {};
browser.runtime.onStartup.addListener(startup);

const install = async (details) => {
    if (!TwitSideModule.config.initialized)
        await TwitSideModule.config.initialize();

    const current_version = browser.runtime.getManifest().version,
          config_version  = TwitSideModule.config.getPref('version');

    // update
    if (details.reason == 'install' || details.reason == 'update') {
        TwitSideModule.config.setPref('version', current_version);
        TwitSideModule.browsers.openURL(firstrun_url);
    }

    // do something after upgrading if necessary.
    // from ver 0.9.4 stream disable
    if (config_version < '0.9.4') {
        let columns = JSON.parse(TwitSideModule.config.getPref('columns') || '{}');
        for (let i in columns) {
            if (columns[i].options.stream != null) {
                // if stream is enabled, enable autoreload
                if (columns[i].options.stream)
                    columns[i].options.autoreload = true;
                delete columns[i].options.stream;
            }
        }
        TwitSideModule.config.setPref('columns', JSON.stringify(columns));
    }
    // from ver 1.1.0 theme system changed
    if (config_version < '1.1.0') {
        TwitSideModule.config.setPref('theme');
    }
};
browser.runtime.onInstalled.addListener(install);

const onclicked = (tab) => {
    // opened
    if (TwitSideModule.windows.hasReceiver(tab.windowId))
        browser.sidebarAction.close();
    // closed or other sidebar opened
    else {
        browser.sidebarAction.open();
        browser.sidebarAction.setPanel({
            panel    : sidebar_url,
            windowId : tab.windowId
        });
    }
};
browser.browserAction.onClicked.addListener(onclicked);

const init = async () => {
    if (!TwitSideModule.config.initialized)
        await Promise.all([TwitSideModule.config.initialize(),
                           new Promise((resolve, reject) => { TwitSideModule.timer(500, resolve); }) ]);

    TwitSideModule.debug.log('TwitSide startup');

    // start TwitSide in background
    TwitSideModule.ManageUsers.initialize();
    TwitSideModule.ManageColumns.initialize();
    TwitSideModule.Mutes.initialize();

    TwitSideModule.debug.log('TwitSide working in background');

    this.initialized = true;
};
init ();

const onremoved = (windowId) => {
    TwitSideModule.windows.removeReceiver(windowId);
};
browser.windows.onRemoved.addListener(onremoved);

const oncommand = async (command) => {
    const win = await browser.windows.getCurrent();
    if (!win.focused) return;
    switch (command) {
    case 'focus-newtweet':
        TwitSideModule.windows.sendMessage({
            reason   : TwitSideModule.UPDATE.RUN_FUNCTION,
            function : TwitSideModule.FUNCTION_TYPE.NEWTWEET
        }, win.id);
        break;
    }
};
browser.commands.onCommand.addListener(oncommand);
