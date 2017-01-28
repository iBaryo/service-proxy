import {ProxyListener} from "../app/ProxyListener";
import {ProxySignals, IProxyRequest, IProxyResponse} from "../app/interfaces";
import {IProxyError} from "../app/interfaces";
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
    let listener: ProxyListener<MockService>;

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
            expect(mockTarget.postMessage).toHaveBeenCalledWith(ProxySignals.Listening, mockOrigin);
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
            expect(mockTarget.postMessage).toHaveBeenCalledWith(ProxySignals.StopListening, mockOrigin);
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
            const methodName = 'mockMethod';
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
            const methodName = 'mockMethod';
            spyOn(mockService, methodName);
            await sendMsg({
                origin: mockOrigin,
                data: {
                    methodName
                } as IProxyRequest
            } as MessageEvent);

            expect(mockService[methodName]).not.toHaveBeenCalled();
            expect(mockTarget.postMessage).toHaveBeenCalledTimes(1);
            expect(mockTarget.postMessage.calls.mostRecent().args[0] as IProxyError).toEqual({
                id: undefined,
                err: 'proxy request in invalid format'
            });
        }));
        it('should report error if message is missing methodName', Async(async() => {
            const methodName = 'mockMethod';
            spyOn(mockService, methodName);
            await sendMsg({
                origin: mockOrigin,
                data: {
                    id: mockId,
                } as IProxyRequest
            } as MessageEvent);

            expect(mockService[methodName]).not.toHaveBeenCalled();
            expect(mockTarget.postMessage).toHaveBeenCalledTimes(1);
            expect(mockTarget.postMessage.calls.mostRecent().args[0] as IProxyError).toEqual({
                id: mockId,
                err: 'proxy request in invalid format'
            });
        }));
        it('should forward request to service', Async(async() => {
            const methodName = 'mockMethod';
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
            const methodName = 'mockMethod';
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
            const methodName = 'mockMethod';
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
            const methodName = 'mockMethod';
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
            const errMsg = mockTarget.postMessage.calls.mostRecent().args[0] as IProxyError;
            expect(errMsg.id).toBe(mockId);
            expect(errMsg.err).toBe(err);
            expect((errMsg as any as IProxyResponse).res).toBeUndefined();
        }));
        it('should post message to target with service\'s response', Async(async() => {
            const methodName = 'mockMethod';
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
            const methodName = 'mockMethod';
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