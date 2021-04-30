import {CommandoClient} from "discord.js-commando";
import Keyv = require('keyv')

export class Notifier {
	private client: CommandoClient
	private keyv: Keyv
	private options: {

	}

	constructor(client: CommandoClient, keyv: Keyv, options: any) {
		this.client = client
		this.keyv = keyv
		this.options = {...this.options, ...options}
	}

	public async notify(notificationID: string) {
		if (this.keyv.get(notificationID) === undefined)
			this.keyv.set(notificationID, [])
		for (let notification in await this.keyv.get(notificationID)) {
			// @ts-ignore
			await this.client.channels.cache.get(notification.channelID).send(notification.message)
		}
	}
}