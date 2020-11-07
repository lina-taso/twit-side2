/**
 * @fileOverview text operation functions shared by content script and background script
 * @name text-ope.js
 * @author tukapiyo <webmaster@filewo.net>
 * @license Mozilla Public License, version 2.0
 */

if (!TwitSideModule) var TwitSideModule = {};

TwitSideModule.text = {
    encodeURI : (str) => {
        return encodeURIComponent(str)
            .replace(/!/g,  "%21")
            .replace(/'/g,  "%27")
            .replace(/\(/g, "%28")
            .replace(/\)/g, "%29")
            .replace(/\*/g, "%2A");
    },

    unescapeHTML : (str) => {
        return str.replace(/(&amp;|&lt;|&gt;|&quot;|&#039;)/g,
                           function($0) {
                               return {
                                   "&amp;"  : "&",
                                   "&lt;"   : "<",
                                   "&gt;"   : ">",
                                   "&quot;" : "'",
                                   "&#039;" : "'"
                               }[$0];
                           });
    },

    escapeHTML : (str) => {
        return str.replace(/[&<>"']/g,
                           function($0){
                               return {
                                   "&" : "&amp;",
                                   "<" : "&lt;",
                                   ">" : "&gt;",
                                   '"' : "&quot;",
                                   "'" : "&#039;"
                               }[$0];
                           });
    },

    makeDefaultColumnlabel : (tl_type, screenname) => {
        return browser.i18n.getMessage('column_' + TwitSideModule.getTimelineName(tl_type))
            + ' (' + screenname + ')';
    },

    convertTimeStamp : (date, locale, format) => {
        switch(locale) {
        case 'locale':
            return date.toLocaleString();
        case "diff":
            return "";
        case 'ja-JP':
            if (format.month) format.month = 'numeric';
            break;
        case 'ja-JP-u-ca-japanese':
            if (format.year) format.era = 'long';
            break;
        default:
        }
        return date.toLocaleString(locale, format);
    },

    createTimeformat : (option) => {
        if (!option) {
            const config = TwitSideModule.config.getPref();
            option = {
                date    : config.time_date,
                weekday : config.time_weekday,
                hour12  : config.time_hour12,
                sec     : config.time_sec
            };
        }

        const format = {
            day     : 'numeric',
            hour    : '2-digit',
            minute  : '2-digit',
            hour12 : option.hour12
        };
        switch (option.date) {
        case 'year':
            format.year = 'numeric';
        case 'month':
            format.month = 'short';
        }
        if (option.weekday)
            format.weekday = 'short';
        if (option.sec)
            format.second = '2-digit';

        return format;
    },

    analyzeTimestamp : (date) => {
        // Sun Jul 01 11:45:04 +0000 2012
        return typeof date === 'number'
            ? new Date(date)
            : new Date(Date.parse(date));
    },

    getUnixTime : () => ~~(Date.now() / 1000)
};
