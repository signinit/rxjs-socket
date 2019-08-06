import { ObservableResources, SubscriptionSocket } from "../src/"

export class BrowserSubscriptionClientWebsocket<
    ServerResources extends ObservableResources = any,
    ClientResources extends ObservableResources = any
> extends SubscriptionSocket<ClientResources, ServerResources> {

    private websocket: WebSocket
    private messageQueue: Array<string> = []
    private isConnected: boolean = false

    constructor(
        url: string,
        resources: ClientResources,
        onError: (error: any) => void,
        onClose: () => void,
        protocols?: string | Array<string>
    ) {
        super(
            onError,
            () => {
                this.messageQueue = []
                this.isConnected = false
                onClose()
            },
            resources
        )
        this.websocket = new WebSocket(url, protocols)
        this.websocket.addEventListener('open', () => {
            this.isConnected = true
            this.messageQueue.forEach(message => this.send(message))
        })
    }

    protected send(message: string): void {
        if(this.isConnected) {
            this.websocket.send(JSON.stringify(message))
        } else {
            this.messageQueue.push(message)
        }
    }

}