import { ObservableResource, ObservableResources, GetOutput, SubscriptionSocket, GetInput } from "../src";
import { Observable  } from "rxjs";
import * as WebSocket from "ws"

export class NodeSubscriptionServerWebsocket<
    ServerResources extends ObservableResources = any,
    ClientResources extends ObservableResources = any,
    StorageType extends { [Name in string]?: any } = any
> extends SubscriptionSocket<ServerResources, ClientResources> {

private messageQeue: Array<string> = []

constructor(
    protected websocket: WebSocket,
    public storage: StorageType,
    subscribeableResources: ToObservableServerResources<ServerResources, NodeSubscriptionServerWebsocket<ServerResources, ClientResources, StorageType>>,
    onError: (socket: NodeSubscriptionServerWebsocket<ServerResources, ClientResources, StorageType>, error: any) => void,
    onClose: (socket: NodeSubscriptionServerWebsocket<ServerResources, ClientResources, StorageType>) => void
) {
    super(
        error => onError(this, error),
        () => onClose(this),
        Object.entries(subscribeableResources).reduce((prev, [name, resource]) => {
            prev[name as keyof ServerResources] = ((input: any) => resource(input, this)) as ServerResources[keyof ServerResources]
            return prev
        }, <ServerResources>{})
    )
}

protected send(message: string): void {
    this.messageQeue.push(message)
    if(this.messageQeue.length === 1) {
        this.sendQeue()
    }
}

private sendQeue(): void {
    if(this.messageQeue.length > 0) {
        let message = this.messageQeue.shift()!
        this.sendMessage(message)
            .catch(error => this.onError(error))
            .then(this.sendQeue.bind(this))
    }
}

private sendMessage(message: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if(this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(message, error => {
                if(error != null) {
                    reject(error)
                } else {
                    resolve()
                }
            })
        }
    })
}

}

export type ToObservableServerResources<
    ServerResources extends ObservableResources = any,
    Socket extends NodeSubscriptionServerWebsocket<any, any, any> = any
> = {
[Name in keyof ServerResources]: ToObservableServerResource<
    ServerResources[Name],
    Socket
>
}

export type ToObservableServerResource<
    ServerResource extends ObservableResource,
    Socket extends NodeSubscriptionServerWebsocket<any, any, any> = any
    > = ObservableServerResource<
    GetInput<ServerResource>,
    GetOutput<ServerResource>,
    Socket
>

export type ObservableServerResource<
    Input = any,
    Output = any,
    Socket extends NodeSubscriptionServerWebsocket<any, any, any> = any
> =
(input: Input, socket: Socket) =>
    Observable<Output>