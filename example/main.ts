import {createProxy} from "../index";
import {MockService} from "./common";

(async() => {
    console.log('creating service proxy...');
    const mockProxy = (await createProxy('/example/service.html')).wrapWith(MockService);
    console.log('proxy created!');


    console.log('invoking method...');
    const result = await mockProxy.mockMethod();
    console.log(`method invoked! result: ${result}`);
})();