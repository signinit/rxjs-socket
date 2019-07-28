# RxJS Socket

With the help of this library, its possible to share RxJS Subscriptions between two connected applications, if both can exchange messages in form of strings.   
These applications can be Websockets or just two Process on the same system.

## Subscription Socket
The Subscription Socket class is the core of this library. By extending this class and the methods `onMessage` and `send` you can specify how the sockets communicate.   
If the socket is closed the `onClose` method should be called, which will close all open subscriptions and reset the resoures.

## Observable Resource
To specify on what you can subscribe on both sockets the `External`- and `InternalResouces` are used.   
For example a `InternalResource` to observe an user could look like this:
```typescript
{
    user: ObservableResource<number, User>
}
```
So these resources are just objects of `ObservableResource`s. To subscribe to this resource its now as simple as
```typescript
subscriptionSocket
    .observe('user', 1)
    .subscribe(user =>
        console.log(user)
    )
```
The other socket now needs to provide this resource. This is done in the constructor:
```typescript
constructor() {
    super(
        ...,
        {
            user: id => theGetUserFunction(id) 
        }
    )
}
```


## Messages

Both sockets communicate by sending stringified message objects.
Those messages are split up in five types.   
Here are some examples for the different types.

### `"subscribe"`   
subscribes to the selected resource if possible   
```json
{
    "type": "subscribe",
    "subscriptionId": 10,
    "name": "user",
    "data": 1
}
```
### `"unsubscribe"`   
unsubcribes from the selected subscription
```json
{
    "type": "unsubscribe",
    "subscriptionId": 10
}
```
### `"next"`   
pushes the next value to the selected subscription
```json
{
    "type": "next",
    "subscriptionId": 10,
    "next": { "id": 1, "username": "Sample User" }
}
```
### `"error"`
writes an error to the selected subscription
```json
{
    "type": "error",
    "subscriptionId": 10,
    "error": "unkown user with id 1"
}
```
### `"complete"`
completes the selected subscription
```json
{
    "type": "complete",
    "subscriptionId": 10
}
```

## License

See the [LICENSE](LICENSE.md) file for license rights and limitations (MIT).