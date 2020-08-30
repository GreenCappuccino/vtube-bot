import {Client} from 'discord.js-commando'
import {TextChannel} from 'discord.js'
import {MongoClient} from 'mongodb'
import {StreamStalker} from './libs/streamstalker'
import {StreamMonitor} from "./libs/streammonitor"
import Keyv = require('keyv')
import KeyvProvider = require('commando-provider-keyv')
const config: any = require('./config.json')

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

const monitor = new StreamMonitor(mongo, streamStalker, {
	databaseName: config.mongoDBName
})
monitor.on('live', (info) => {
	logs.event.send(`\`${info.streamName}\` is now **live**.`)
	stats.liveRisingCount++
})
monitor.on('offline', (info) => {
	logs.event.send(`\`${info.streamName}\` is now **offline**.`)
	stats.offlineRisingCount++
})
monitor.on('warn', (message) => {
	logs.monitor.send(`<@&${config.devRole}> **Monitor Warning** (\`${message}\`)`)
	stats.monitorWarns++
})
monitor.on('error', (err) => {
	logs.monitor.send(`<@&${config.devRole}> **Monitor Error** (\`${err}\`)`)
	stats.monitorErrors++
})


const logs: {
	general: TextChannel,
	monitor: TextChannel,
	store: TextChannel,
	event: TextChannel,
	stats: TextChannel
} = {
	general: null,
	monitor: null,
	store: null,
	event: null,
	stats: null
}

let stats: {
	startupTime: number,
	liveRisingCount: number,
	offlineRisingCount: number,
	monitorPolls: number,
	monitorWarns: number,
	monitorErrors: number,
	dbErrors: number,
} = {
	startupTime: new Date().getTime(),
	liveRisingCount: 0,
	offlineRisingCount: 0,
	monitorPolls: 0,
	monitorWarns: 0,
	monitorErrors: 0,
	dbErrors: 0
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
	// @ts-ignore
	logs.stats = client.channels.cache.get(config.logChannels.stats)
	console.log(`Logged in as ${client.user.tag}!`)
	logs.general.send(`Logged in as <@${client.user.id}> at \`${new Date().getTime()}\`.`)
	startup()
})

let reportStats = () => {
	let uptime = new Date().getTime() - stats.startupTime
	logs.stats.send(`**Statistics** (Past 30 mins) \`${uptime}\` of uptime
	Monitors went live \`${stats.liveRisingCount}\` times. 
	Monitors went offline \`${stats.offlineRisingCount}\` times.
	\`${stats.monitorWarns}\` monitor warnings, \`${stats.monitorErrors}\` monitor errors, with \`${stats.monitorPolls}\` polls`)
	stats = {
		...stats, ...{
			liveRisingCount: 0,
			offlineRisingCount: 0,
			monitorPolls: 0,
			monitorWarns: 0,
			monitorErrors: 0,
			dbErrors: 0
		}
	}
}

let startup = () => {
	setInterval(() => {
		monitor.pollMonitors()
		stats.monitorPolls++
	}, 60000) // 1 min
	setInterval(() => {
		reportStats()
	}, 1800000) // 30 mins
	mongo.connect(async err => {
		if (err) {
			logs.store.send(`<@&${config.devRole}> **DB Error** (\`streams\`)
			\`${err}\``)
			shutdown()
			return
		}
		await mongo.db(config.mongoDBName).collection("streams").find({}).forEach((doc) => {
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

client.login(config.botToken)

