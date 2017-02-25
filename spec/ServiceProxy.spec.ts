import {ServiceProxy} from "../src/ServiceProxy";
import {Async} from "./utils";
import {ProxySignal, IProxyRequest, IProxyResponse} from "../src/interfaces";

describe('ServiceProxy', () => {
    const mockUrl = 'mockUrl.com';
    const mockTimeoutId = 123;

    let mockId;
    let mockIFrameCreator;
    let mockIFrame;
    let mockIFrameHost;

    let mockGetIFrameHost;
    let resolveIFrameHost;
    let mockWindow;

    let proxy: ServiceProxy;
    beforeEach(() => {
        mockIFrame = {
            src: undefined,
            contentWindow: {
                postMessage: jasmine.createSpy('iframe-content-window-post-message')
            }
        };
        mockIFrameCreator = jasmine.createSpy('iframe-creator').and.returnValue(mockIFrame as HTMLIFrameElement);
        mockIFrameHost = {
            appendChild: jasmine.createSpy('iframe-host-append-child')
        };
        let hostResolver;
        mockGetIFrameHost = ()=> new Promise(resolve => hostResolver = resolve);
        resolveIFrameHost = () => hostResolver(mockIFrameHost);
        mockWindow = {
            addEventListener: jasmine.createSpy('win-add-event-listener'),
            removeEventListener: jasmine.createSpy('win-remove-event-listener'),
            setTimeout: jasmine.createSpy('win-set-timeout').and.returnValue(mockTimeoutId),
            clearTimeout: jasmine.createSpy('win-clear-timeout')
        };

        mockId = 0;
        const mockIdCreator = () => String(++mockId);

        proxy = new ServiceProxy(mockUrl, jasmine.DEFAULT_TIMEOUT_INTERVAL / 5, mockIdCreator, mockIFrameCreator, mockGetIFrameHost, mockWindow);
    });

    it('should initialize', () => expect(proxy).toBeTruthy());

    describe('methods', () => {
        let initPromise: Promise<void>;
        let respondToInit: (e: MessageEvent) => Promise<void>;

        beforeEach(Async(async () => {
            initPromise = proxy.init();
            resolveIFrameHost();
            await mockGetIFrameHost;

            respondToInit = mockWindow.addEventListener.calls.mostRecent().args[1];
        }));

        describe('init', () => {
            it('should open an iframe in given url', Async(async () => {
                expect(mockIFrameCreator).toHaveBeenCalled();
                expect(mockIFrameHost.appendChild).toHaveBeenCalledWith(mockIFrame);
                expect(mockIFrame.src).toBe(mockUrl);
            }));

            it('should start listening for iframe\'s listener', () => {
                expect(mockWindow.addEventListener).toHaveBeenCalledWith('message', jasmine.any(Function), true);
            });
            describe('responses from iframe', () => {
                it('should ignore messages from other domains', Async(async() => {
                    initPromise.then(fail);
                    await respondToInit({
                        origin: 'not-origin.com',
                        data: ProxySignal.Listening
                    } as MessageEvent);

                    expect(mockWindow.clearTimeout).not.toHaveBeenCalled();
                    expect(mockWindow.removeEventListener).not.toHaveBeenCalled();
                }));
                it('should ignore messages that does not confirm listening', Async(async() => {
                    initPromise.then(fail);
                    await respondToInit({
                        origin: mockUrl,
                        data: 'not a proxy signal'
                    } as MessageEvent);

                    expect(mockWindow.clearTimeout).not.toHaveBeenCalled();
                    expect(mockWindow.removeEventListener).not.toHaveBeenCalled();
                }));
                it('should finish only when receiving response from iframe', Async(async() => {
                    await respondToInit({
                        origin: mockUrl,
                        data: ProxySignal.Listening
                    } as MessageEvent);

                    await initPromise;
                }));
                it('should clean stuff when resolving', Async(async() => {
                    await respondToInit({
                        origin: mockUrl,
                        data: ProxySignal.Listening
                    } as MessageEvent);

                    await initPromise;

                    expect(mockWindow.clearTimeout).toHaveBeenCalled();
                    expect(mockWindow.removeEventListener).toHaveBeenCalledWith('message', respondToInit, true);
                }));
                it('should throw if did not get response after timeout', Async(async() => {
                    const timeoutCallback = mockWindow.setTimeout.calls.mostRecent().args[0] as ()=>void;

                    try {
                        timeoutCallback();
                        await initPromise;
                        fail();
                    }
                    catch (e) {
                        expect(e).toBe('proxy init timeout');
                    }
                }));
            });
        });

        describe('sendRequest', () => {
            const methodName = 'mock';
            let respondToRequest: (e: MessageEvent) => void;
            beforeEach(Async(async() => {
                mockWindow.addEventListener.calls.reset();
                await respondToInit({
                    origin: mockUrl,
                    data: ProxySignal.Listening
                } as MessageEvent);

                await initPromise;
                mockWindow.clearTimeout.calls.reset();

                respondToRequest = mockWindow.addEventListener.calls.mostRecent().args[1];
            }));

            it('should post message to the iframe', () => {
                proxy.sendRequest(methodName);
                expect(mockIFrame.contentWindow.postMessage).toHaveBeenCalledWith({
                    id: String(mockId),
                    methodName,
                    params: undefined
                } as IProxyRequest, mockUrl);
            });

            describe('when getting a response', () => {
                let pendingReq: Promise<string>;
                let proxyReq: IProxyRequest;
                let mockProxyRes: IProxyResponse;
                let reqTimeout: ()=>void;
                beforeEach(() => {
                    pendingReq = proxy.sendRequest<string>(methodName);
                    proxyReq = mockIFrame.contentWindow.postMessage.calls.mostRecent().args[0];
                    mockProxyRes = {
                        id: proxyReq.id,
                        res: 'ok'
                    };
                    reqTimeout = mockWindow.setTimeout.calls.mostRecent().args[0];
                });

                it('should reject if did not get response after timeout', Async(async() => {
                    try {
                        reqTimeout();
                        await pendingReq;
                        fail();
                    }
                    catch (e) {
                        expect(e).toBe('proxy request timeout');
                    }
                }));


                it('should ignore response if came from a different origin', Async(async() => {
                    respondToRequest({
                        origin: 'not-origin.com',
                        data: mockProxyRes
                    } as MessageEvent);

                    expect(mockWindow.clearTimeout).not.toHaveBeenCalled();

                    try {
                        reqTimeout();
                        await pendingReq;
                        fail();
                    }
                    catch (e) {

                    }
                }));
                it('should resolve when gotten a response', Async(async() => {
                    respondToRequest({
                        origin: mockUrl,
                        data: mockProxyRes
                    } as MessageEvent);

                    const result = await pendingReq;
                    expect(result).toBe(mockProxyRes.res);
                }));

                it('should reject when gotten an error response', Async(async() => {
                    mockProxyRes.signal = ProxySignal.Error;
                    mockProxyRes.res = 'error';
                    respondToRequest({
                        origin: mockUrl,
                        data: mockProxyRes
                    } as MessageEvent);

                    try {
                        await pendingReq;
                        fail();
                    }
                    catch (e) {
                        expect(e).toBe(mockProxyRes.res);
                    }
                }));

                it('should handle multiple requests with different responses order', Async(async() => {
                    // Arrange
                    const pendingReq2 = proxy.sendRequest(methodName);
                    const proxyReq2 = mockIFrame.contentWindow.postMessage.calls.mostRecent().args[0];
                    const mockProxyRes2 = {
                        id: proxyReq2.id,
                        res: 'ok2'
                    };

                    const pendingReq3 = proxy.sendRequest(methodName);
                    const proxyReq3 = mockIFrame.contentWindow.postMessage.calls.mostRecent().args[0];
                    const mockProxyRes3 = {
                        id: proxyReq3.id,
                        res: 'ok3'
                    };

                    // Act
                    respondToRequest({
                        origin: mockUrl,
                        data: mockProxyRes3
                    } as MessageEvent);
                    respondToRequest({
                        origin: mockUrl,
                        data: mockProxyRes2
                    } as MessageEvent);
                    respondToRequest({
                        origin: mockUrl,
                        data: mockProxyRes
                    } as MessageEvent);

                    // Assert
                    expect(await pendingReq).toBe(mockProxyRes.res);
                    expect(await pendingReq2).toBe(mockProxyRes2.res);
                    expect(await pendingReq3).toBe(mockProxyRes3.res);
                }));
            });
        });

        describe('wrapWith', () => {
            beforeEach(() => {
                spyOn(proxy, 'sendRequest');
            });

            interface IMockWrapper {
                mockMethod(): void;
                mockMethodWithParams(param1, param2): void;
            }

            function testWrapper(wrapper: IMockWrapper) {
                wrapper.mockMethod();
                expect(proxy.sendRequest).toHaveBeenCalledWith('mockMethod', []);

                (proxy.sendRequest as jasmine.Spy).calls.reset();

                const param1 = {}, param2 = {};
                wrapper.mockMethodWithParams(param1, param2);
                expect(proxy.sendRequest).toHaveBeenCalledWith('mockMethodWithParams', [param1, param2]);
            }

            it('should return a proxy wrapper according to string array', () => {
                testWrapper(proxy.wrapWith<IMockWrapper>(['mockMethod', 'mockMethodWithParams']));
            });

            it('should return a proxy wrapper according to object', () => {
                testWrapper(proxy.wrapWith<IMockWrapper>({
                    mockMethod: () => {
                    },
                    mockMethodWithParams: () => {
                    }
                }));
            });

            it('should return a proxy wrapper according to class ctor', () => {
                class Mock {
                    public mockProp = 42;

                    constructor() {
                    }

                    public mockMethod() {
                    }
                }

                class MockExtended extends Mock implements IMockWrapper {
                    public mockMethodWithParams(param1, param2) {

                    }
                }

                const wrapper = proxy.wrapWith(MockExtended);
                expect(wrapper.mockProp).toBeUndefined();

                testWrapper(wrapper);
            });
        });
    });
});