import {ProxyListener} from "../src/ProxyListener";
import {ProxySignal, IProxyRequest, IProxyResponse} from "../src/interfaces";
import {Async, resetSpies} from "./utils";

describe('ProxyListener', () => {
    class MockService {
        public mockMethod() {
        }
    }
    let mockService: MockService;
    let mockOrigin: string;
    let mockTarget;
    let mockWindow;
    let listener: ProxyListener;

    beforeEach(() => {
        mockService = new MockService();
        mockOrigin = 'mock.com';
        mockTarget = {
            postMessage: jasmine.createSpy('target-post-message')
        };
        mockWindow = {
            addEventListener: jasmine.createSpy('window-add-event-listener'),
            removeEventListener: jasmine.createSpy('window-remove-event-listener'),
        };
        listener = new ProxyListener(mockService, mockOrigin, mockTarget, mockWindow);
    });

    it('should initialize', () => expect(listener).toBeTruthy());
    it('should not listen when initialized', () => expect(listener.isListening).toBeFalsy());

    describe('listen', () => {
        it('should start listening', () => {
            listener.listen();

            expect(mockWindow.addEventListener).toHaveBeenCalledWith('message', jasmine.any(Function), true);
            expect(mockTarget.postMessage).toHaveBeenCalledWith(ProxySignal.Listening, mockOrigin);
            expect(listener.isListening).toBeTruthy();
        });

        it('should not start listening if already', () => {
            listener.listen();
            listener.listen();

            expect(mockWindow.addEventListener).toHaveBeenCalledTimes(1);
            expect(mockTarget.postMessage).toHaveBeenCalledTimes(1);
            expect(listener.isListening).toBeTruthy();
        });
    });
    describe('stopListen', () => {
        it('should stop listening', () => {
            listener.listen();
            mockTarget.postMessage.calls.reset();

            listener.stopListen();

            const eventListener = mockWindow.addEventListener.calls.mostRecent().args[1];
            expect(mockWindow.removeEventListener).toHaveBeenCalledWith('message', eventListener, true);
            expect(mockTarget.postMessage).toHaveBeenCalledWith(ProxySignal.StopListening, mockOrigin);
            expect(listener.isListening).toBeFalsy();
        });
        it('should not do anything if not listening', () => {
            listener.listen();
            listener.stopListen();
            mockWindow.removeEventListener.calls.reset();
            mockTarget.postMessage.calls.reset();

            listener.stopListen();

            expect(mockWindow.removeEventListener).not.toHaveBeenCalled();
            expect(mockTarget.postMessage).not.toHaveBeenCalled();
            expect(listener.isListening).toBeFalsy();
        });
    });
    describe('on message', () => {
        const methodName = 'mockMethod';

        let sendMsg: (e: MessageEvent) => Promise<any>;
        let mockId: string;

        beforeEach(() => {
            mockId = 'mockId';

            listener.listen();
            sendMsg = mockWindow.addEventListener.calls.mostRecent().args[1];
            resetSpies(mockWindow);
            resetSpies(mockTarget);
        });
        it('should ignore if message\'s domain is not from origin', Async(async() => {
            spyOn(mockService, methodName);
            await sendMsg({
                origin: 'not-origin.com',
                data: {
                    id: mockId,
                    methodName
                } as IProxyRequest
            } as MessageEvent);

            expect(mockService[methodName]).not.toHaveBeenCalled();
            expect(mockTarget.postMessage).not.toHaveBeenCalled();
        }));

        it('should report error if message is missing id', Async(async() => {
            spyOn(mockService, methodName);
            await sendMsg({
                origin: mockOrigin,
                data: {
                    methodName
                } as IProxyRequest
            } as MessageEvent);

            expect(mockService[methodName]).not.toHaveBeenCalled();
            expect(mockTarget.postMessage).toHaveBeenCalledTimes(1);
            expect(mockTarget.postMessage.calls.mostRecent().args[0] as IProxyResponse).toEqual({
                id: undefined,
                res: 'proxy request in invalid format',
                signal: ProxySignal.Error
            }  as IProxyResponse);
        }));
        it('should report error if message is missing methodName', Async(async() => {
            spyOn(mockService, methodName);
            await sendMsg({
                origin: mockOrigin,
                data: {
                    id: mockId,
                } as IProxyRequest
            } as MessageEvent);

            expect(mockService[methodName]).not.toHaveBeenCalled();
            expect(mockTarget.postMessage).toHaveBeenCalledTimes(1);
            expect(mockTarget.postMessage.calls.mostRecent().args[0] as IProxyResponse).toEqual({
                id: mockId,
                res: 'proxy request in invalid format',
                signal: ProxySignal.Error
            }  as IProxyResponse);
        }));
        it('should forward request to service', Async(async() => {
            spyOn(mockService, methodName);
            await sendMsg({
                origin: mockOrigin,
                data: {
                    id: mockId,
                    methodName
                } as IProxyRequest
            } as MessageEvent);

            expect(mockService[methodName]).toHaveBeenCalled();
        }));
        it('should post message to target with original request id', Async(async() => {
            spyOn(mockService, methodName);
            await sendMsg({
                origin: mockOrigin,
                data: {
                    id: mockId,
                    methodName
                } as IProxyRequest
            } as MessageEvent);

            expect(mockService[methodName]).toHaveBeenCalled();
            expect(mockTarget.postMessage).toHaveBeenCalledWith({id: mockId, res: undefined}, mockOrigin);
        }));
        it('should forward request to service with parameters', Async(async() => {
            const param1 = {};
            const param2 = {};
            spyOn(mockService, methodName).and.callFake((param1, param2) => {
                expect(param1).toBeTruthy();
                expect(param2).toBeTruthy();
            });
            await sendMsg({
                origin: mockOrigin,
                data: {
                    id: mockId,
                    methodName,
                    params: [param1, param2]
                } as IProxyRequest
            } as MessageEvent);

            expect(mockService[methodName]).toHaveBeenCalledWith(param1, param2);
            expect(mockTarget.postMessage).toHaveBeenCalledWith({id: mockId, res: undefined}, mockOrigin);
        }));
        it('should post error to target if service throws', Async(async() => {
            const err = 'error123';
            spyOn(mockService, methodName).and.callFake(() => {
                throw err;
            });

            await sendMsg({
                origin: mockOrigin,
                data: {
                    id: mockId,
                    methodName,
                } as IProxyRequest
            } as MessageEvent);

            expect(mockService[methodName]).toHaveBeenCalled();
            expect(mockTarget.postMessage).toHaveBeenCalledTimes(1);
            const errMsg = mockTarget.postMessage.calls.mostRecent().args[0] as IProxyResponse;
            expect(errMsg.id).toBe(mockId);
            expect(errMsg.res).toBe(err);
            expect(errMsg.signal).toBe(ProxySignal.Error);
        }));
        it('should post error to target if service throws async', Async(async() => {
            const err = 'error123';
            spyOn(mockService, methodName).and.returnValue(Promise.reject(err));

            await sendMsg({
                origin: mockOrigin,
                data: {
                    id: mockId,
                    methodName,
                } as IProxyRequest
            } as MessageEvent);

            const errMsg = mockTarget.postMessage.calls.mostRecent().args[0] as IProxyResponse;
            expect(errMsg.id).toBe(mockId);
            expect(errMsg.res).toBe(err);
            expect(errMsg.signal).toBe(ProxySignal.Error);
        }));
        it('should post error message to target if service throws an error object', Async(async() => {
            const err = 'error123';
            spyOn(mockService, methodName).and.throwError(err);

            await sendMsg({
                origin: mockOrigin,
                data: {
                    id: mockId,
                    methodName,
                } as IProxyRequest
            } as MessageEvent);

            const errMsg = mockTarget.postMessage.calls.mostRecent().args[0] as IProxyResponse;
            expect(errMsg.id).toBe(mockId);
            expect(errMsg.res).toBe(err);
            expect(errMsg.signal).toBe(ProxySignal.Error);
        }));
        it('should post message to target with service\'s response', Async(async() => {
            const res = {};
            spyOn(mockService, methodName).and.returnValue(res);
            await sendMsg({
                origin: mockOrigin,
                data: {
                    id: mockId,
                    methodName,
                } as IProxyRequest
            } as MessageEvent);

            expect(mockService[methodName]).toHaveBeenCalled();
            expect(mockTarget.postMessage).toHaveBeenCalledWith({id: mockId, res}, mockOrigin);
        }));
        it('should post message to target with service\'s response unwrap from Promise', Async(async() => {
            const res = {};
            spyOn(mockService, methodName).and.returnValue(Promise.resolve(res));
            await sendMsg({
                origin: mockOrigin,
                data: {
                    id: mockId,
                    methodName,
                } as IProxyRequest
            } as MessageEvent);

            expect(mockService[methodName]).toHaveBeenCalled();
            expect(mockTarget.postMessage).toHaveBeenCalledWith({id: mockId, res}, mockOrigin);
        }));
    });
});