import {Client} from 'discord.js-commando'
import {TextChannel} from 'discord.js'
import {MongoClient} from 'mongodb'
import {StreamStalker} from './libs/streamstalker'
import {StreamMonitor} from "./libs/streammonitor"
import Keyv = require('keyv')
import KeyvProvider = require('commando-provider-keyv')
import config = require('./config.json')

let publicStreamNames: string[] = []

const streamStalker = new StreamStalker({
	twitchClientID: config.twitchClientID,
	twitchClientSecret: config.twitchClientSecret
})

const client = new Client({
	owner: config.ownerid
})

client.registry.registerDefaults()

const databaseUrlKeyv = `mongodb://${config.mongoUser}:${config.mongoPassword}@vtube0-shard-00-00.v71th.mongodb.net:27017,vtube0-shard-00-01.v71th.mongodb.net:27017,vtube0-shard-00-02.v71th.mongodb.net:27017/${config.mongoDBName}?ssl=true&replicaSet=atlas-jzpcfu-shard-0&authSource=admin&retryWrites=true&w=majority`
const commandoSettings = new Keyv(databaseUrlKeyv, {
	serialize: data => data,
	deserialize: data => data,
	adapter: 'mongodb',
	collection: 'commando'
})
commandoSettings.on('error', err => {
	console.log('Commando Keyv connection error', err)
	if (logs.store) {
		logs.store.send(`<@&${config.devRole}> **DB Error** (\`commando-settings\`)
		\`${err}\``)
	}
})

const databaseUrl = `mongodb+srv://${config.mongoUser}:${config.mongoPassword}@vtube0.v71th.mongodb.net/${config.mongoDBName}?retryWrites=true&w=majority`
const mongo = new MongoClient(databaseUrl, {
	useNewUrlParser: true,
	useUnifiedTopology: true
});

client.setProvider(new KeyvProvider(commandoSettings))

const monitor = new StreamMonitor(mongo, streamStalker, {})
monitor.on('live', (info) => {
	logs.event.send(info.streamName + "livenow")
})
monitor.on('offline', (info) => {
	logs.event.send(info.streamName + "offlinenow")
})
monitor.on('error',(err) => {
	logs.monitor.send(`<@&${config.devRole}> **Monitor Error** (\`${err}\`)`)
})


let logs: {
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
	logs.general.send(`Logged in as <@${client.user.id}> at \`${new Date().getTime()}\`.`)
	startup()
})

let startup = () => {
	setInterval(() => {
		monitor.pollMonitors()
	}, 60000) // 1 min
	mongo.connect(async err => {
		if (err) {
			logs.store.send(`<@&${config.devRole}> **DB Error** (\`streams\`)
			\`${err}\``)
			shutdown()
			return
		}
		await mongo.db("vtube").collection("streams").find({}).forEach((doc) => {
			if (doc.publicList) publicStreamNames.push(doc.name)
		}, (err, res) => {
			if (err) {
				logs.store.send(`<@&${config.devRole}> **DB Error** (\`streams\`)
			\`${err}\``)
				shutdown()
				return
			}
		})

	})
}

let shutdown = () => {
	logs.general.send(`**Shutting down** at \`${new Date().getTime()}\`.`)
	setTimeout(() => {
		client.destroy()
		process.exit()
	}, 5000)
	mongo.close()
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

