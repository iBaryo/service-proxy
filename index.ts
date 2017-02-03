import {ServiceProxy} from "./app/ServiceProxy";
import {ProxyListener} from "./app/ProxyListener";

export async function createProxy(url: string): Promise<ServiceProxy> {
    const service = new ServiceProxy(url);
    await service.init();
    return service;
};

export async function createListener(service) {
    return new ProxyListener(service);
}