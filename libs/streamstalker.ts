import https = require('https');
import path = require('path');
import {ApiClient} from "twitch";
import {ClientCredentialsAuthProvider} from "twitch-auth";

export class StreamStalker {
	private readonly twitchClientID: string
	private readonly twitchClientSecret: string

	constructor(options) {
		this.twitchClientID = options.twitchClientID
		this.twitchClientSecret = options.twitchClientSecret
	}
	private static ytParseLive(data) {
		let liveNow = null
		if (data.includes('window["ytInitialData"]')) {
			liveNow = !!(data.includes('"label":"LIVE NOW"') &&
				data.includes('"style":"BADGE_STYLE_TYPE_LIVE_NOW"'));
		}
		return liveNow;
	}

	public ytChannelLive(opt, callback) {
		let options = {
			hostname: 'www.youtube.com',
			port: 443,
			path: path.join('/channel', opt.channelID),
			method: 'GET'
		}

		let data = ''
		let req = https.request(options, res => {
			res.on('data', d => {
				data += d
			})

			res.on('end', () => {
				callback(opt.pass, false, StreamStalker.ytParseLive(data))
			})
		})

		req.on('error', err => {
			callback(opt.pass, err, null)
		})

		req.end()

	}

	public async twitchChannelLive(opt, callback) {
		let authProvider = new ClientCredentialsAuthProvider(this.twitchClientID, this.twitchClientSecret)
		let apiClient = new ApiClient({ authProvider })

		let user = await apiClient.helix.users.getUserById(opt.userID)
		if (!user) callback(opt.pass, 'Twitch user does not exist', null)
		callback(opt.pass, false, await user.getStream() !== null)
	}
}