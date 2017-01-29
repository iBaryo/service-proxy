import {ServiceProxy} from "./app/ServiceProxy";

export const proxy = {
    create: async(url: string): Promise<ServiceProxy> => {
        const service = new ServiceProxy(url);
        await service.init();
        return service;
    }
};