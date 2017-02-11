import {ServiceProxy} from "./src/ServiceProxy";
import {ProxyListener} from "./src/ProxyListener";

export async function createProxy(url: string): Promise<ServiceProxy> {
    const service = new ServiceProxy(url);
    await service.init();
    return service;
};

export async function createListener(service) {
    return new ProxyListener(service);
}