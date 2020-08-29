import {EventEmitter} from 'events'
import {MongoClient} from 'mongodb'
import {StreamStalker} from './streamstalker'

export class StreamMonitor extends EventEmitter {
	private mongo: MongoClient;
	private streamStalker: StreamStalker;

	constructor(mongoClient: MongoClient, streamStalker: StreamStalker, options) {
		super();
		this.mongo = mongoClient
		this.streamStalker = streamStalker
	}

	public pollMonitors = async () => {

		let sequenceTime = new Date().getTime()
		console.log("------MONITOR POLL------")
		await this.mongo.db("vtube").collection("streams").find({}).forEach((doc) => {
			let passparams = {
				sequenceTime: sequenceTime,
				streamName: doc.name,
				streamType: doc.type,
				streamUrl: doc.channelurl,
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

		if (live && !stream.lastLiveState) {
			this.emit('live', pass)
			console.log("live")
		}
		if (!live && stream.lastLiveState) {
			this.emit('offline', pass)
			console.log("offline")
		}

		await this.mongo.db("vtube").collection("streams").updateMany({
			name: pass.streamName
		}, {
			"$set": {lastLiveState: live}
		}, {})

	}
}

