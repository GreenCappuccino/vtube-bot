import {Command, CommandoClient} from 'discord.js-commando'
import { ListStores } from '../../libs/lists'
import * as Keyv from 'keyv'

export class CreateNotificationCommand extends Command {
	private readonly valid: string[]
	private keyv: Keyv = ListStores.Instance.notificationKeyv

	constructor(client: CommandoClient) {
		super(client, {
			name: 'createnotif',
			aliases: [],
			group: 'notifications',
			memberName: 'createnotif',
			description: 'Creates a simple notification for a livestream.',
			args: [
				{
					key: 'monitorId',
					prompt: 'the monitor id of the requested monitor',
					type: 'string',
					validate: text => ListStores.Instance.publicStreamNames.includes(text)
				},
				{
					key: 'liveMessage',
					prompt: 'the message to send in the current channel when the monitor becomes live',
					type: 'string'
				}
			]
		})
	}

	run(message,{monitorId, liveMessage}) {
		this.keyv.set(monitorId, this.keyv.get(monitorId).push({channelID: message.channel.id, message: liveMessage}))
		return message.say('created new monitor')
	}
}