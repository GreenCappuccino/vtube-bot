import https = require('https');
import path = require('path');
import UserAgent from "user-agents";
import {ApiClient} from "twitch";
import {ClientCredentialsAuthProvider} from "twitch-auth";

let ytParseLive = data => {
    let liveNow = null
    if (data.includes('window["ytInitialData"]')) {
        liveNow = false
        if (data.includes('"label":"LIVE NOW"') &&
            data.includes('"style":"BADGE_STYLE_TYPE_LIVE_NOW"')) {
            liveNow = true
        }
    }
    return liveNow;
}

module.exports = {
    ytChannelLive: (opt, channelID, callback) => {
        let userAgent = new UserAgent()
        let options = {
            hostname: 'www.youtube.com',
            port: 443,
            path: path.join('/channel', channelID),
            method: 'GET',
            headers: { 'User-Agent': userAgent.toString() }
        }

        let data = ''
        let req = https.request(options, res => {
            res.on('data', d => {
                data += d
            })

            res.on('end', () => {
                callback(opt, false, ytParseLive(data))
            })
        })

        req.on('error', err => {
            callback(opt, err, null)
        })

        req.end()
    },
    twitchChannelLive: async function (opt, userID, clientID, clientSecret, callback) {
        let authProvider = new ClientCredentialsAuthProvider(clientID, clientSecret)
        let apiClient = new ApiClient({ authProvider })

        let user = await apiClient.helix.users.getUserById(userID)
        if (!user) callback(opt, 'Twitch user does not exist', null)
        callback(opt, false, await user.getStream() !== null)
    }
}