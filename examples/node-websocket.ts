import { ObservableResources, SubscriptionSocket } from "../src/"
import * as WebSocket from "ws"

export class NodeSubscriptionClientWebsocket<
    ServerResources extends ObservableResources = any,
    ClientResources extends ObservableResources = any
> extends SubscriptionSocket<ClientResources, ServerResources> {

    private pingTimeout: NodeJS.Timeout | undefined
    private websocket: WebSocket
    private messageQueue: Array<string> = []

    constructor(
        url: string,
        resources: ClientResources,
        onError: (error: any) => void,
        onClose: () => void,
        options?: WebSocket.ClientOptions,
        private timeout: number = 30000,
        private additionalTime: number = 1000
    ) {
        super(
            onError,
            () => {
                if(this.pingTimeout != null) {
                    clearTimeout(this.pingTimeout!)
                    this.pingTimeout = undefined
                }
                this.messageQueue = []
                onClose()
            },
            resources
        )
        this.websocket = new WebSocket(url, options)
        this.websocket.addEventListener('open', () => {
            this.messageQueue.forEach(message => this.send(message))
            this.messageQueue = []
        })
        this.websocket.addEventListener('ping', this.ping.bind(this))
    }

    private ping(): void {
        if(this.pingTimeout != null) {
            clearTimeout(this.pingTimeout!)
        }
        this.pingTimeout = setTimeout(() => {
            this.websocket.close()
        }, this.timeout + this.additionalTime)
    }

    protected send(message: string): void {
        if(this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(message, error => {
                if(error != null) {
                    console.error(error)
                }
            })
        } else {
            this.messageQueue.push(message)
        }
    }

}