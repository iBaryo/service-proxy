import {ServiceProxy} from "../app/ServiceProxy";
import {Async} from "./utils";
import {ProxySignal, IProxyRequest} from "../app/interfaces";

describe('ServiceProxy', () => {
    const mockUrl = 'mockUrl.com';
    const mockId = 'mockId';


    let mockIFrameCreator;
    let mockIFrame;
    let mockIFrameHost;
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
        mockWindow = {
            addEventListener: jasmine.createSpy('win-add-event-listener'),
            removeEventListener: jasmine.createSpy('win-remove-event-listener'),
            setTimeout: jasmine.createSpy('win-set-timeout'),
            clearTimeout: jasmine.createSpy('win-clear-timeout')
        };

        const mockIdCreator = () => mockId;

        proxy = new ServiceProxy(mockUrl, 5000, mockIdCreator, mockIFrameCreator, mockIFrameHost, mockWindow);
    });

    it('should initialize', () => expect(proxy).toBeTruthy());

    describe('methods', () => {
        let initPromise: Promise<void>;
        let respondToInit: (e: MessageEvent) => Promise<void>;

        beforeEach(() => {
            initPromise = proxy.init();
            respondToInit = mockWindow.addEventListener.calls.mostRecent().args[1];
        });

        describe('init', () => {
            it('should open an iframe in given url', () => {
                expect(mockIFrameCreator).toHaveBeenCalled();
                expect(mockIFrameHost.appendChild).toHaveBeenCalledWith(mockIFrame);
                expect(mockIFrame.src).toBe(mockUrl);
            });

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
            beforeEach(Async(async() => {
                await respondToInit({
                    origin: mockUrl,
                    data: ProxySignal.Listening
                } as MessageEvent);

                await initPromise;
            }));

            it('should post message to the iframe', () => {
                const methodName = 'mock';
                proxy.sendRequest(methodName);
                expect(mockIFrame.contentWindow.postMessage).toHaveBeenCalledWith({
                    id: mockId,
                    methodName,
                    params: undefined
                } as IProxyRequest, mockUrl);
            });

            xit('should resolve when gotten a response', Async(async() => {
            }));
            xit('should throw if did not get response after timeout', () => {
            });
            xit('should handle multiple requests with different responses order', Async(async() => {
            }));
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