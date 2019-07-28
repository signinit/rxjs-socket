import { Observable } from "rxjs";

export type GetInput<T extends ObservableResource> = T extends ObservableResource<infer Input> ? Input : never
export type GetOutput<T extends ObservableResource> = T extends ObservableResource<any, infer Output> ? Output : never

export type ObservableResource<Input = any, Output = any> = (data: Input) => Observable<Output>

export type ObservableResources = { [name: string]: ObservableResource }