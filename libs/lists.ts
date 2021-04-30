import * as Keyv from 'keyv'

export class ListStores {
	private static _instance: ListStores

	public publicStreamNames: Array<string> = []
	public notificationKeyv: Keyv = null

	private constructor() {}
	public static get Instance() {
		return this._instance || (this._instance = new this())
	}

	public set notifKeyv(keyv: Keyv) {
		this.notificationKeyv = keyv
	}
}
