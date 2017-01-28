import {generateId, validateOrigin} from "./utils";
import {ProxySignals, IProxyRequest, IProxyResponse} from "./interfaces";

export class ServiceProxy {
    private _iframe: HTMLIFrameElement;
    private _pendingReqs : ((e : MessageEvent & {data: IProxyResponse})=>void)[] = [];

    constructor(public readonly url: string,
                public readonly timeout = 5000,
                private readonly _idCreator = generateId,
                private readonly _iframeCreator = () => document.createElement('iframe'),
                private readonly _iframeHost = document.body,
                private readonly _win = window) {
    }

    public init(): Promise<void> {
        this._iframe = this._iframeCreator();
        this._iframe.src = this.url;
        this._iframeHost.appendChild(this._iframe);

        return new Promise<void>((resolve, reject) => {
            const timeoutId = this._win.setTimeout(() => reject('proxy timeout'), this.timeout);
            const onInitResponse = (e: MessageEvent) => {
                if (validateOrigin(this.url, e.origin)
                    && e.data === ProxySignals.Listening) {
                    this._win.clearTimeout(timeoutId);
                    this._win.removeEventListener('message', onInitResponse, true);
                    resolve();
                }
            };
            this._win.addEventListener('message', onInitResponse, true);
        });
    }

    public sendRequest<T>(methodName: string, params?: any[]): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const req = {
                id: this._idCreator(),
                methodName,
                params
            } as IProxyRequest;

            const timeoutId = this._win.setTimeout(() => {
                reject('proxy request timeout');
            }, this.timeout);

            const onResponse = (e: MessageEvent & {data : IProxyResponse}) => {
                if (validateOrigin(this.url, e.origin)
                    && e.data && e.data.id) {

                    this._win.clearTimeout(timeoutId);
                    this._win.removeEventListener('message', onResponse, true);
                    resolve(e.data.res)
                }
            };
            this._win.addEventListener('message', onResponse, true);
            this._iframe.contentWindow.postMessage(req, this.url);
        });
    }

    public stop() {
        // todo: add notifying the listener
        this._iframeHost.removeChild(this._iframe);
    }

    public wrapWith<T>(type: new() => T): T;
    public wrapWith<T>(type: Object): T;
    public wrapWith<T>(keys: string[]): T;
    public wrapWith<T>(type: (new() => T)|Object|string[]): T {
        let keys: string[];
        if (typeof type === 'function')
            keys = Object.keys(type.prototype).filter(key => typeof(type.prototype[key]) === 'function'); // todo: won't work in es6
        else if (type instanceof Array)
            keys = type;
        else if (typeof type === 'object')
            keys = Object.keys(type);
        else
            throw 'unsupported type for proxy';

        return this.proxyFromKeys<T>(keys);
    }

    private wrapFromConstructor<T>(ctor: new()=>T): T {
        return undefined;
    }

    private proxyFromKeys<T>(keys: string[]): T {
        const proxy = {};
        keys.forEach(key =>
            proxy[key] = (...args) => this.sendRequest(key, args)
        );
        return proxy as T;
    }
}

export const proxy = {
    create: async(url: string): Promise<ServiceProxy> => {
        const service = new ServiceProxy(url);
        await service.init();
        return service;
    }
};