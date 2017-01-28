export interface IProxyMessage {
    id : string;
}
export interface IProxyRequest extends IProxyMessage {
    methodName : string;
    params? : any[];
}
export interface IProxyResponse extends IProxyMessage {
    res : any;
}

export interface IProxyError extends IProxyMessage {
    err: string;
}

export const enum ProxySignals {
    Listening = 900,
    StopListening
}