import {ProxyListener} from "../src/ProxyListener";
import {ProxySignal, IProxyRequest, IProxyResponse} from "../src/interfaces";
import {Async, resetSpies} from "./utils";
import {IProxySignalRequest} from "../src/interfaces";
import Spy = jasmine.Spy;

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
            const res = {};
            listener.listen(res);

            expect(mockWindow.addEventListener).toHaveBeenCalledWith('message', jasmine.any(Function), true);
            expect(mockTarget.postMessage).toHaveBeenCalledWith({
                id: undefined,
                signal: ProxySignal.Listening,
                res
            } as IProxyResponse, mockOrigin);
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
        describe('signal requests', () => {
            describe('for stop listening', () => {
                let stopListening : () => Promise<void>;
                beforeEach(() => {
                    stopListening = () => sendMsg({
                        origin: mockOrigin,
                        data: {
                            id: mockId,
                            signal: ProxySignal.StopListening
                        } as IProxySignalRequest
                    } as MessageEvent);
                });

                it('should stop listen and return answer', Async(async() => {
                    await stopListening();

                    expect(mockWindow.removeEventListener).toHaveBeenCalledWith('message', sendMsg, true);
                    expect(mockTarget.postMessage).toHaveBeenCalledWith({
                        id: mockId,
                        signal: ProxySignal.StopListening,
                        res: undefined
                    } as IProxyResponse, mockOrigin);
                    expect(listener.isListening).toBeFalsy();
                }));
                it('should not do anything if already stopped', Async(async() => {
                    await stopListening();
                    mockWindow.removeEventListener.calls.reset();

                    await stopListening();

                    expect(mockWindow.removeEventListener).not.toHaveBeenCalled();
                    expect(listener.isListening).toBeFalsy();
                }));
                describe('on stop return value', ()=> {
                   it('should return the onStop return value', Async(async ()=> {
                       const res = {};
                       listener.onStop = () => res;

                       await stopListening();

                       expect(mockTarget.postMessage).toHaveBeenCalledWith({
                           id: mockId,
                           signal: ProxySignal.StopListening,
                           res: res
                       } as IProxyResponse, mockOrigin);
                   }));
                    it('should return the onStop return value', Async(async ()=> {
                        const res = {};
                        listener.onStop = () => Promise.resolve(res);

                        await stopListening();

                        expect(mockTarget.postMessage).toHaveBeenCalledWith({
                            id: mockId,
                            signal: ProxySignal.StopListening,
                            res: res
                        } as IProxyResponse, mockOrigin);
                    }));
                });
                describe('stop cancellers', () => {
                    it('should not stop if there is a canceller that returns a truthy value', Async(async() => {
                        listener.stopCancellers.push(() => true);

                        await stopListening();

                        expect(mockWindow.removeEventListener).not.toHaveBeenCalled();
                        expect(listener.isListening).toBeTruthy();
                    }));
                    it('should report error if stop was cancelled', Async(async() => {
                        listener.stopCancellers.push(() => true);

                        await stopListening();

                        expect(mockTarget.postMessage).toHaveBeenCalledWith({
                            id : mockId,
                            signal: ProxySignal.Error,
                            res: true
                        } as IProxyResponse, mockOrigin);
                    }));
                    it('should report error with the cancellation object', Async(async() => {
                        const res = {};
                        listener.stopCancellers.push(() => res);

                        await stopListening();

                        expect(mockTarget.postMessage).toHaveBeenCalledWith({
                            id : mockId,
                            signal: ProxySignal.Error,
                            res
                        } as IProxyResponse, mockOrigin);
                    }));
                    it('should report error with the cancellation object from an async cancellation', Async(async() => {
                        const res = {};
                        listener.stopCancellers.push(() => Promise.resolve(res));

                        await stopListening();

                        expect(mockTarget.postMessage).toHaveBeenCalledWith({
                            id : mockId,
                            signal: ProxySignal.Error,
                            res
                        } as IProxyResponse, mockOrigin);
                    }));
                });
            });
        });
        describe('service proxy requests', () => {
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
});