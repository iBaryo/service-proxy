import {IProxyRequest, IProxyResponse, IProxyError, ProxySignal} from "./interfaces";
import {getParentUrl,validateOrigin} from "./utils";

export class ProxyListener {
    constructor(private readonly _service: Object,
                public readonly origin = getParentUrl(),
                private readonly _target = window.parent,
                private readonly _win = window) {
    }

    private _listening = false;

    public get isListening() {
        return this._listening;
    }

    public listen() {
        if (!this._listening) {
            this._win.addEventListener('message', this.onRequest, true);
            this.postMessage(ProxySignal.Listening);
            this._listening = true;
        }
    }

    public stopListen() {
        if (this._listening) {
            this._win.removeEventListener('message', this.onRequest, true);
            this.postMessage(ProxySignal.StopListening);
            this._listening = false;
        }
    }

    private onRequest = async(e: MessageEvent) => { // to preserve context
        if (validateOrigin(this.origin, e.origin)) {
            const req = e.data as IProxyRequest;

            try {
                this.validateRequest(req);
                const res = await this.forwardToService(req);
                this.postMessage({
                    id: req.id,
                    res
                } as IProxyResponse);
            }
            catch (e) {
                this.postError({err: e, id: req.id});
            }
        }
    };

    private validateRequest(req : IProxyRequest) {
        if (!req.id || !req.methodName) {
            throw 'proxy request in invalid format';
        }
    }

    private async forwardToService(req: IProxyRequest): Promise<any> {
        const method = this._service[req.methodName] as Function;
        let result = method.apply(this._service, req.params) as Promise<any>|any;
        if (result && result.then) {
            result = await result;
        }
        return result;
    }

    private postMessage(msg: any) {
        this._target.postMessage(msg, this.origin);
    }

    private postError(err: IProxyError) {
        this.postMessage(err);
    }
}