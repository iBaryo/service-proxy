import {createProxy} from "../index";
import {MockService} from "./common";

(async() => {
    console.log('~~~ testing service proxy in the same domain...');
    await testProxy('/example/service.html');

    console.log('~~~ testing service proxy in a different domain...');
    await testProxy('http://different-domain.com:8080/example/service.html');
})();

async function testProxy(url : string) {
    const mockProxy = (await createProxy(url)).wrapWith(MockService);
    console.log('proxy created!');


    console.log('invoking method...');
    const result = await mockProxy.mockMethod();
    console.log(`method invoked! result: ${result}`);
}