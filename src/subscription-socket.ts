import { Observable, Subject, Subscriber } from "rxjs";
import { GetInput, ObservableResources, GetOutput } from "./observable-resource";
import { takeUntil, filter } from "rxjs/operators";
import { Message } from "./message";

export abstract class SubscriptionSocket<
    InternalResources extends ObservableResources = any,
    ExternalResources extends ObservableResources = any
> {
    
    private unsubscribeSubject = new Subject<number | undefined>()
    
    private externalResourceIsOpen: Array<boolean> = []
    private internalResourceIsOpen: Array<boolean> = []
    
    private counter: number = 0
    private subscriberMap: Map<number, Subscriber<any>> = new Map()
    
    protected onClose: () => void

    constructor(
        protected onError: (error: any) => void,
        onClose: () => void,
        private subscriptions: InternalResources
    ) {
        this.onClose = () => {
            this.externalResourceIsOpen = []
            this.internalResourceIsOpen = []
            this.subscriberMap.forEach(subscriber => subscriber.error("server disconnected"))
            this.subscriberMap.clear()
            this.unsubscribeSubject.next(undefined)
            onClose()
        }
    }

    onMessage(message: string): void {
        let json: any
        try {
            json = JSON.parse(message)
        } catch(error) {
            this.onError("unable to parse message")
            return
        }
        if(json.subscriptionId == null) {
            this.onError("missing subscriptionId")
            return
        }
        let subscriptionId = parseInt(json.subscriptionId)
        if(isNaN(subscriptionId)) {
            this.onError("subscriptionId not a number")
            return
        }
        switch(json.type) {
            case "subscribe":
                if(json.name == null) {
                    this.onError("missing param name on message type 'subscribe'")
                    return
                }
                let subscription = this.subscriptions[json.name]
                if(subscription == null) {
                    this.send({
                        type: "error",
                        error: `cant subscribe to "${json.name}"`,
                        subscriptionId
                    })
                    return
                }
                this.internalResourceIsOpen[subscriptionId] = true
                subscription(json.data)
                    .pipe(
                        takeUntil(
                            this.unsubscribeSubject.pipe(
                                filter(id =>
                                    id === subscriptionId ||
                                    id == null//means unsubscribe to all
                                )
                            )
                        )
                    ).subscribe(
                        next => this.send({
                            type: "next",
                            next,
                            subscriptionId
                        }),
                        error =>
                            this.send({
                            type: "error",
                            error: error.toString(),
                            subscriptionId
                        }),
                        () => {
                            if(this.internalResourceIsOpen[subscriptionId]) {
                                delete this.internalResourceIsOpen[subscriptionId]
                                this.send({
                                    type: "complete",
                                    subscriptionId,
                                })
                            }
                        }
                    )
                break
            case "unsubscribe":
                delete this.internalResourceIsOpen[subscriptionId]
                this.unsubscribeSubject.next(subscriptionId)
                break
            case "next":
                let subscriber = this.subscriberMap.get(subscriptionId)
                if(subscriber == null) {
                    this.onError("unkown subscriber")
                    return
                }
                subscriber.next(json.next)
                break
            case "error":
                delete this.externalResourceIsOpen[subscriptionId]
                subscriber = this.subscriberMap.get(subscriptionId)
                if(subscriber == null) {
                    this.onError("unkown subscriber")
                    return
                }
                subscriber.error(json.error)
                break
            case "complete":
                delete this.externalResourceIsOpen[subscriptionId]
                subscriber = this.subscriberMap.get(subscriptionId)
                if(subscriber == null) {
                    this.onError("unkown subscriber")
                    return
                }
                subscriber.complete()
                break
            default:
                subscriber = this.subscriberMap.get(subscriptionId)
                if(subscriber == null) {
                    this.onError("unkown subscriber")
                    return
                }
                subscriber.error("unkown message type")
                break
        }
    }

    public observe<Name extends keyof ExternalResources>(
        name: Name,
        data: GetInput<ExternalResources[Name]>
    ): Observable<GetOutput<ExternalResources[Name]>> {
        return new Observable<GetOutput<ExternalResources[Name]>>(subscriber => {
            let subscriptionId = this.counter
            this.externalResourceIsOpen[subscriptionId] = true
            ++this.counter
            this.send({
                type: "subscribe",
                subscriptionId,
                name: <string>name,
                data
            })
            this.subscriberMap.set(subscriptionId, subscriber)
            return () => {
                if(this.externalResourceIsOpen[subscriptionId]) {
                    delete this.externalResourceIsOpen[subscriptionId]
                    this.send({
                        type: "unsubscribe",
                        subscriptionId
                    })
                    this.subscriberMap.delete(subscriptionId)
                }
            }
        })
    }

    protected abstract send(message: Message): void

}