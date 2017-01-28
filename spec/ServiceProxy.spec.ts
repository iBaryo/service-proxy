import {ServiceProxy} from "../app/ServiceProxy";
import {Async} from "./utils";
import {ProxySignals, IProxyRequest} from "../app/interfaces";

describe('ServiceProxy', () => {
    const mockUrl = 'mockUrl.com';

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

        proxy = new ServiceProxy(mockUrl, undefined, mockIFrameCreator, mockIFrameHost, mockWindow);
    });

    it('should initialize', () => expect(proxy).toBeTruthy());

    describe('methods', () => {
        let initPromise: Promise<void>;
        beforeEach(() => {
            initPromise = proxy.init();
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
                let respondToInit: (e: MessageEvent) => Promise<void>;
                beforeEach(() => {
                    respondToInit = mockWindow.addEventListener.calls.mostRecent().args[1];
                });

                it('should ignore messages from other domains', Async(async() => {
                    initPromise.then(fail);
                    await respondToInit({
                        origin: 'not-origin.com',
                        data: ProxySignals.Listening
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
                        data: ProxySignals.Listening
                    } as MessageEvent);

                    await initPromise;
                }));
                it('should clean stuff when resolving', Async(async() => {
                    await respondToInit({
                        origin: mockUrl,
                        data: ProxySignals.Listening
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
                        expect(e).toBe('proxy timeout');
                    }
                }));
            });
        });

        describe('sendRequest', () => {
            let mockId : string;

            beforeEach(Async(async() => {
                await initPromise;
            }));

            it('should post message to the iframe', () => {
                const methodName = 'mock';
                proxy.sendRequest(methodName);
                expect(mockIFrame.contentWindow.postMessage).toHaveBeenCalledWith({
                    id: mockId,
                    methodName
                } as IProxyRequest);
            });
            xit('should resolve when gotten a response', Async(async() => {
            }));
            xit('should throw if did not get response after timeout', () => {
            });
        });

        describe('wrapWith', () => {
            xit('should return an object from the input class', () => {
            });
            xit('should return an object with all methods as proxy to "sendRequest" method', () => {
            });
        });
    });


});