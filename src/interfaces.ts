export interface IProxyMessage {
    id : string;
}
export interface IProxyRequest extends IProxyMessage {
    methodName : string;
    params? : any[];
}
export interface IProxyResponse extends IProxyMessage {
    res : any;
    signal? : ProxySignal;
}

export const enum ProxySignal {
    Listening = 900,
    StopListening,
    Error
}