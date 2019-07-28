import { Observable } from "rxjs";

/**
 * Get the input type of the resource
 * (the data which needs to be send with the subscription)
 */
export type GetInput<T extends ObservableResource> = T extends ObservableResource<infer Input> ? Input : never

/**
 * Get the type of the output of the resource
 * (the type of the returning obervable)
 */
export type GetOutput<T extends ObservableResource> = T extends ObservableResource<any, infer Output> ? Output : never

/**
 * the basic resource which can be observed by specifing the input (data)
 */
export type ObservableResource<Input = any, Output = any> = (data: Input) => Observable<Output>

/**
 * a object map of observable resources mapped by their name
 */
export type ObservableResources = { [name: string]: ObservableResource }