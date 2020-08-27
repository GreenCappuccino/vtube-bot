import Commando = require('discord.js-commando')
import { TextChannel } from 'discord.js'
import events = require('events')
import streamstalker = require('./libs/streamstalker')
import config = require('./config.json')
import Keyv = require('keyv')
import KeyvProvider = require('commando-provider-keyv')

const client = new Commando.Client({
	owner: config.ownerid
})

client.registry.registerDefaults()

const databaseUrl = `mongodb://${config.mongoUser}:${config.mongoPassword}@vtube0-shard-00-00.v71th.mongodb.net:27017,vtube0-shard-00-01.v71th.mongodb.net:27017,vtube0-shard-00-02.v71th.mongodb.net:27017/${config.mongoDBName}?ssl=true&replicaSet=atlas-jzpcfu-shard-0&authSource=admin&retryWrites=true&w=majority`
const commandoSettings = new Keyv(databaseUrl, {
	serialize: data => data,
	deserialize: data => data,
	adapter: 'mongodb',
	collection: 'commando'
})
const streams = new Keyv(databaseUrl, {
	serialize: data => data,
	deserialize: data => data,
	adapter: 'mongodb',
	collection: 'streams'
})
commandoSettings.on('error', err => {
	console.log('Commando Keyv connection error', err)
	if (logs.store) {
		logs.store.send(`<@&${config.devRole}> **DB Error** (\`commando-settings\`)
		\`${err}\``)
	}
})
streams.on('error', err => {
	console.log('Commando Keyv connection error', err)
	if (logs.store) {
		logs.store.send(`<@&${config.devRole}> **DB Error** (\`streams\`)
		\`${err}\``)
	}
})

client.setProvider(new KeyvProvider(commandoSettings))

const monitorEvent = new events.EventEmitter()

let logs : {
	general: TextChannel,
	monitor: TextChannel,
	store: TextChannel,
	event: TextChannel
} = {
	general: null,
	monitor: null,
	store: null,
	event: null
}

let updateStreamState = (name, newState, opt) => {

}

let updateMonitor = () => {

}

setInterval(() => {
	updateMonitor()
}, 60000) // 1 min

monitorEvent.on('live', (name, opt) => {
	logs.event.send(`\`${name}\` is now **live**.`)
})
monitorEvent.on('offline', (name, opt) => {
	logs.event.send(`\`${name}\` is now **offline**.`)
})

client.on('ready', () => {
	// @ts-ignore
	logs.general = client.channels.cache.get(config.logChannels.general)
	// @ts-ignore
	logs.monitor = client.channels.cache.get(config.logChannels.monitor)
	// @ts-ignore
	logs.store = client.channels.cache.get(config.logChannels.store)
	// @ts-ignore
	logs.event = client.channels.cache.get(config.logChannels.event)
	console.log(`Logged in as ${client.user.tag}!`)
	logs.general.send(`Bot (re)started! Logged in as <@${client.user.id}> at \`${new Date().getTime()}\`!`)
})


let shutdown = () => {
	logs.general.send(`**Shutting down** at \`${new Date().getTime()}\`!`)
	setTimeout(() => {
		client.destroy()
		process.exit()
	}, 5000)
}
process.on('SIGINT', () => {
	shutdown()
})
process.on('SIGTERM', () => {
	shutdown()
})

if (process.env.VTUBE_PRODUCTION === "prod") {
	client.login(config.botToken)
} else {
	client.login(config.testToken)
}

