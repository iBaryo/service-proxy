import {generateId, validateOrigin, createIframe, getAllClassMethodsNames, getBodyElement} from "./utils";
import {ProxySignal, IProxyRequest, IProxyResponse, IProxyMessage} from "./interfaces";

export class ServiceProxy {
    private _iframe: HTMLIFrameElement;
    private _iframeHost: HTMLElement;
    private _pendingReqs: ((e: MessageEvent & {data: IProxyResponse})=>void)[] = [];

    constructor(public readonly url: string,
                public readonly timeout = 5000,
                private readonly _idCreator = generateId,
                private readonly _iframeCreator = createIframe,
                private readonly getIframeHost = getBodyElement,
                private readonly _win = window) {
    }

    public init(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._iframe = this._iframeCreator();
            this._iframe.src = this.url;
            this.getIframeHost().then(host => {
                this._iframeHost = host;
                this._iframeHost.appendChild(this._iframe);
                this._win.addEventListener('message', this.onResponse, true);

                // todo: i don't really like this - should refactor
                const timeoutId = this._win.setTimeout(() => reject('proxy init timeout'), this.timeout);
                const onInitResponse = (e: MessageEvent) => {
                    if (this.validateOrigin(e.origin)
                        && e.data === ProxySignal.Listening) {
                        this._win.clearTimeout(timeoutId);
                        this._win.removeEventListener('message', onInitResponse, true);
                        this._win.addEventListener('message', this.onResponse, true);
                        resolve();
                    }
                };

                this._win.addEventListener('message', onInitResponse, true);
            });
        });
    }

    private validateOrigin(checked: string) {
        return validateOrigin(this._iframe.src, checked);
    }

    private onResponse = (e: MessageEvent & {data: IProxyResponse}) => { // arrow function to preserve context
        const msg = e.data;
        if (this.validateOrigin(e.origin) && msg && this._pendingReqs[msg.id]) {
            this._pendingReqs[msg.id](msg);
            delete this._pendingReqs[msg.id];
        }
    };

    private postToIFrame<T>(req: IProxyMessage) {
        const onMsgResponse = this.registerMessage<T>(req);
        this._iframe.contentWindow.postMessage(req, this._iframe.src);
        return onMsgResponse;
    }

    private registerMessage<T>(req: IProxyMessage, timeout = this.timeout) {
        return new Promise<T>((resolve, reject) => {

            const timeoutId = this._win.setTimeout(() => {
                reject('proxy request timeout');
            }, timeout);

            this._pendingReqs[req.id] = (e: IProxyResponse) => {
                this._win.clearTimeout(timeoutId);
                if (e.signal === ProxySignal.Error) {
                    reject(e.res);
                }
                else {
                    resolve(e.res);
                }
            };
        });
    }

    public sendRequest<T>(methodName: string, params?: any[]): Promise<T> {
        return this.postToIFrame<T>({
            id: this._idCreator(),
            methodName,
            params
        } as IProxyRequest);
    }

    public stop() {
        // todo: add notifying the listener
        this._win.removeEventListener('message', this.onResponse, true);
        this._iframeHost.removeChild(this._iframe);
    }

    public wrapWith<T>(type: new() => T): T;
    public wrapWith<T>(type: Object): T;
    public wrapWith<T>(keys: string[]): T;
    public wrapWith<T>(type: (new() => T)|Object|string[]): T {
        let keys: string[];
        if (typeof type === 'function')
            keys = getAllClassMethodsNames(type);
        else if (type instanceof Array)
            keys = type;
        else if (typeof type === 'object')
            keys = Object.keys(type);//.concat(getAllClassMethodsNames(Object.getPrototypeOf(type)));
        else
            throw 'unsupported type for wrapper';

        return this.proxyFromKeys<T>(keys);
    }

    private proxyFromKeys<T>(keys: string[]): T {
        const proxy = {};
        keys.forEach(key =>
            proxy[key] = (...args) => this.sendRequest(key, args)
        );
        return proxy as T;
    }
}