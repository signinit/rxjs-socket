export type Message =
    NextMessage |
    ErrorMessage |
    CompleteMessage |
    SubscribeMessage |
    UnsubscribeMessage

export type NextMessage = {
    type: "next"
    subscriptionId: number
    next: any
}

export type ErrorMessage = {
    type: "error"
    subscriptionId: number
    error: any
}

export type CompleteMessage = {
    type: "complete"
    subscriptionId: number
}

export type SubscribeMessage = {
    type: "subscribe"
    subscriptionId: number
    name: string
    data: any
}

export type UnsubscribeMessage = {
    type: "unsubscribe"
    subscriptionId: number
}