import {ServiceProxy} from "../index";
import {MockService} from "./common";

(async() => {
    console.log('~~~ testing service proxy in the same domain...');
    await testProxy('/example/service.html');

    console.log('~~~ testing service proxy in a different domain...');
    await testProxy('http://different-domain.com:8080/example/service.html');
})();

async function testProxy(url : string) {

    const proxy = new ServiceProxy(url);
    const initRes = await proxy.init<{ initial: string }>();
    console.log(`service proxy created! received value: ${initRes.initial}`);

    const mockProxy = proxy.wrapWith(MockService);

    console.log('invoking method with no params...');
    let result = await mockProxy.mockMethod();
    console.log(`method invoked! result: ${result}`);

    console.log('invoking method with primitive...');
    result = await mockProxy.mockMethod(42);
    console.log(`method invoked! result: ${result}`);

    console.log('invoking method with object...');
    result = await mockProxy.mockMethod({success:'great'});
    console.log(`method invoked! result: ${JSON.stringify(result)}`);

    console.log('invoking method that throws sync...');
    try {
        await mockProxy.throwSyncMethod();
    }
    catch (e) {
        console.log(`method invoked! threw: ${e}`);
    }

    console.log('invoking method that throws async...');
    try {
        await mockProxy.throwAsyncMethod();
    }
    catch (e) {
        console.log(`method invoked! threw: ${e}`);
    }

    console.log(`trying to stop the proxy but it'll fail...`);
    try {
    await proxy.stop<void>();
    }
    catch(e) {
        console.log(`service proxy stopped failing as planned! received value: ${JSON.stringify(e)}`);
    }

    console.log(`now really stopping proxy...`);
    const stopRes = await proxy.stop<{goodbye : string}>();
    console.log(`service proxy stopped! received value: ${stopRes.goodbye}`);
}