import { Observable, Subject, Subscriber } from "rxjs"
import { GetInput, ObservableResources, GetOutput } from "./observable-resource"
import { takeUntil, filter } from "rxjs/operators"

/**
 * the abstract socket to manage the subscriptions and resources
 * InternalResources - the resources which need to be provided
 * ExternalResources - the resources which can be subscribed to
 */
export abstract class SubscriptionSocket<
    InternalResources extends ObservableResources = any,
    ExternalResources extends ObservableResources = any
> {
    
    /**
     * a subject to fire when a subscription should be unsubscribed
     * the value is the id of the subscription to unsubscribe from
     * undefined means unsubscribe from all subscriptions
     */
    private unsubscribeSubject = new Subject<number | undefined>()
    
    /**
     * a list that knows which external resources are open
     */
    private externalResourceIsOpen: Array<boolean> = []

    /**
     * a list that knows which internal resources are open
     */
    private internalResourceIsOpen: Array<boolean> = []
    
    /**
     * simple counter to make unique subscription ids
     */
    private counter: number = 0

    /**
     * a map of all subscribers currently subscriped to mapped by the subscription id they belong to
     */
    private subscriberMap: Map<number, Subscriber<any>> = new Map()

    constructor(
        protected onError: (error: any) => void,
        private customOnClose: () => void,
        private resources: InternalResources
    ) {}

    /**
     * should be executed to clear all the subscriptions and resources
     */
    protected onClose() {
        this.externalResourceIsOpen = []
        this.internalResourceIsOpen = []
        this.subscriberMap.forEach(subscriber => subscriber.error("server disconnected"))
        this.subscriberMap.clear()
        this.unsubscribeSubject.next(undefined)
        this.customOnClose()
    }

    /**
     * gets executed when a new message was retrieved
     * @param message the retrieved message content
     */
    protected onMessage(message: string): void {
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
                let resource = this.resources[json.name]
                if(resource == null) {
                    this.send(
                        JSON.stringify({
                            type: "error",
                            error: `cant subscribe to "${json.name}"`,
                            subscriptionId
                        })
                    )
                    return
                }
                this.internalResourceIsOpen[subscriptionId] = true
                resource(json.data)
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
                        next => this.send(JSON.stringify({
                            type: "next",
                            next,
                            subscriptionId
                        })),
                        error =>
                            this.send(JSON.stringify({
                            type: "error",
                            error: error.toString(),
                            subscriptionId
                        })),
                        () => {
                            if(this.internalResourceIsOpen[subscriptionId]) {
                                delete this.internalResourceIsOpen[subscriptionId]
                                this.send(
                                    JSON.stringify({
                                        type: "complete",
                                        subscriptionId,
                                    })
                                )
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
                this.subscriberMap.delete(subscriptionId)
                break
            case "complete":
                delete this.externalResourceIsOpen[subscriptionId]
                subscriber = this.subscriberMap.get(subscriptionId)
                if(subscriber == null) {
                    this.onError("unkown subscriber")
                    return
                }
                subscriber.complete()
                this.subscriberMap.delete(subscriptionId)
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

    /**
     * function to observe an external resource
     * @param name the name of the resource
     * @param data the additional data for this resource
     */
    public observe<Name extends keyof ExternalResources>(
        name: Name,
        data: GetInput<ExternalResources[Name]>
    ): Observable<GetOutput<ExternalResources[Name]>> {
        return new Observable<GetOutput<ExternalResources[Name]>>(subscriber => {
            let subscriptionId = this.counter
            this.externalResourceIsOpen[subscriptionId] = true
            ++this.counter
            this.send(
                JSON.stringify({
                    type: "subscribe",
                    subscriptionId,
                    name: <string>name,
                    data
                })
            )
            this.subscriberMap.set(subscriptionId, subscriber)
            return () => {
                if(this.externalResourceIsOpen[subscriptionId]) {
                    delete this.externalResourceIsOpen[subscriptionId]
                    this.send(
                        JSON.stringify({
                            type: "unsubscribe",
                            subscriptionId
                        })
                    )
                    this.subscriberMap.delete(subscriptionId)
                }
            }
        })
    }

    /**
     * writes the a message to the other subscription socket
     * @param message the content to send
     */
    protected abstract send(message: string): void

}