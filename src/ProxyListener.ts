import {IProxyRequest, IProxyResponse, ProxySignal, IProxySignalRequest} from "./interfaces";
import {getParentUrl, validateOrigin} from "./utils";
import {IProxyMessage} from "./interfaces";
import {isSignalRequest} from "./interfaces";

export type MaybePromiseAny = any|Promise<any>;
export type StopCancellers = () => MaybePromiseAny;

export class ProxyListener {
    constructor(private readonly _service: Object,
                public readonly origin = getParentUrl(),
                private readonly _target = window.parent,
                private readonly _win = window) {
    }

    public stopCancellers: StopCancellers[] = [];
    public onStop : () => MaybePromiseAny;

    private _listening = false;

    public get isListening() {
        return this._listening;
    }

    public listen(payload?: any) {
        if (!this.isListening) {
            this._win.addEventListener('message', this.onRequest, true);
            this.postMessage({
                id: undefined,
                signal: ProxySignal.Listening,
                res: payload
            } as IProxyResponse);
            this._listening = true;
        }
    }

    private stopListen() {
        if (this.isListening) {
            this._win.removeEventListener('message', this.onRequest, true);
            this._listening = false;
        }
    }

    private onRequest = async(e: MessageEvent & {data: IProxyMessage}) => { // to preserve context
        if (validateOrigin(this.origin, e.origin)) {
            const req = e.data;
            try {
                if (isSignalRequest(req)) {
                    await this.handleSignalRequest(req);
                }
                else { // normal request
                    await this.handleProxyRequest(req);
                }
            }
            catch (e) {
                this.postError({res: e.message || e, id: req.id});
            }
        }
    };

    private async handleSignalRequest(req: IProxySignalRequest) {
        switch (req.signal) {
            case ProxySignal.StopListening:
                const cancel = await this.getCancelResult();
                let res : IProxyResponse;
                if (!cancel) {
                    this.stopListen();
                    let payload;
                    if (this.onStop) {
                        payload = this.onStop();
                        if (payload.then) {
                            payload = await payload;
                        }
                    }
                    res = {
                        id: req.id,
                        signal: ProxySignal.StopListening,
                        res: payload
                    };
                }
                else {
                    res = {
                        id: req.id,
                        signal: ProxySignal.Error,
                        res: cancel
                    };
                }
                this.postMessage(res);
                break;
            default:
                // ignore
                break;
        }
    }

    private async getCancelResult() {
        for (const shouldCancelStop of this.stopCancellers) {
            let res = shouldCancelStop() as MaybePromiseAny;
            if (res.then) {
                res = await res;
            }

            if (res)
                return res;
        }

        return undefined;
    }

    private async handleProxyRequest(req: IProxyRequest) {
        this.validateRequest(req);
        const res = await this.forwardToService(req);

        this.postMessage({
            id: req.id,
            res
        } as IProxyResponse);
    }

    private validateRequest(req: IProxyRequest) {
        if (!req.id || !req.methodName) {
            throw 'proxy request in invalid format';
        }
    }

    private async forwardToService(req: IProxyRequest): Promise<any> {
        const method = this._service[req.methodName] as Function;
        let result = method.apply(this._service, req.params) as MaybePromiseAny;
        if (result && result.then) {
            result = await result;
        }
        return result;
    }

    protected postMessage(msg: any) {
        this._target.postMessage(msg, this.origin);
    }

    private postError(err: IProxyResponse) {
        err.signal = ProxySignal.Error;
        this.postMessage(err);
    }
}