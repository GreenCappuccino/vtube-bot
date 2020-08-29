import {EventEmitter} from 'events'
import {MongoClient} from 'mongodb'
import {StreamStalker} from './streamstalker'

export class StreamMonitor extends EventEmitter {
	private mongo: MongoClient
	private streamStalker: StreamStalker
	private options: {
		stateChangeTimeRequirement: number
	} = {
		stateChangeTimeRequirement: 300000 // 5 mins
	}

	constructor(mongoClient: MongoClient, streamStalker: StreamStalker, options) {
		super()
		this.mongo = mongoClient
		this.streamStalker = streamStalker
		this.options = {...this.options, ...options}
	}

	public pollMonitors = async () => {

		let sequenceTime = new Date().getTime()
		console.log("------MONITOR POLL------")
		await this.mongo.db("vtube").collection("streams").find({}).forEach((doc) => {
			let passparams = {
				sequenceTime: sequenceTime,
				channelUrl: doc.channelurl,
				streamName: doc.name,
				streamType: doc.type,
				streamUrl: doc.streamurl,
				publicStream: doc.public,
				notificationID: doc.notifications,
				lastLiveState: doc.lastLiveState,
				lastStateChangeTime: doc.lastStateChangeTime,
			}
			switch (doc.type) {
				case 'youtube':
					this.streamStalker.ytChannelLive({
						channelID: doc.identifier,
						pass: passparams
					}, (pass, err, live) => {
						if (err) this.emit('error', err)
						else {
							this.updateStreamState(pass, live)
						}
					})
					break
				case 'twitch':
					this.streamStalker.twitchChannelLive({
						userID: doc.identifier,
						pass: passparams
					}, (pass, err, live) => {
						if (err) this.emit('error', err)
						else {
							this.updateStreamState(pass, live)
						}
					})
					break
				default:
					this.emit('error', `${doc.name} type invalid`)
					break
			}
		}, (err, res) => {
			if (err) {
				this.emit('error', err)
				return
			}
		})


	}

	private async updateStreamState(pass, live) {
		const stream = await this.mongo.db("vtube").collection("streams").findOne({name: pass.streamName})
		console.log(live, stream.lastLiveState, pass.streamName)

		const currentTime = new Date().getTime()
		let liveRising: boolean = false, offlineRising: boolean = false

		if (live && !stream.lastLiveState)
			liveRising = true
		if (!live && stream.lastLiveState)
			offlineRising = true

		if ((liveRising || offlineRising) && currentTime - stream.lastStateChangeTime >= this.options.stateChangeTimeRequirement) {
			if (liveRising) this.emit('live', pass)
			if (offlineRising) this.emit('offline', pass)
			await this.mongo.db("vtube").collection("streams").updateMany({
				name: pass.streamName
			}, [
				{"$set": {lastLiveState: live}},
				{"$set": {lastStateChangeTime: currentTime}}
			], {})
		} else {
			if (liveRising) this.emit('warn', `Detected stream ${pass.streamName} state changed to live but was blocked \
			(changed under ${this.options.stateChangeTimeRequirement} ms). Not writing new state!`)
			if (offlineRising) this.emit('warn', `Detected stream ${pass.streamName} state changed to offline but was blocked \
			(changed under ${this.options.stateChangeTimeRequirement} ms). Not writing new state!`)
		}
	}
}

