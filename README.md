# Browser Service Proxy
Create a proxy for a service instance that exists in a different page.

## Usage
(Written in Typescript)
Lets say we have the following Mock service:
```js
export class MockService {
    public mockMethod(param? : any) {
        return new Promise(resolve => setTimeout(()=> resolve(param), 100));
    }
}
```

and we want to use an instance of it that exists within a different page that might be in a different domain.

### In the Main page
```js
import {createProxy} from "browser-service-proxy";
import {MockService} from "./common";

// async IIFE
(async function main() {
    // First we create the proxy
    const proxy = await createProxy('http://different-domain.com:8080/example/service.html');
    
    // Then we can send requests directly
    let result = await proxy.sendRequest('mockMethod', [42]);
    
    // or we can wrap it.
    const mockProxy = proxy.wrapWith(MockService);
    result = await mockProxy.mockMethod(42);
})();
```

### In the different page
(according to our example, it'll will be in http://different-domain.com:8080/example/service.html)
```js
import {createListener} from "browser-service-proxy";
import {MockService} from "./common";

// Creating the service instance
const service = new MockService();

(async ()=> {
    // Creating the listener around the service instance
    const listener = await createListener(service);
    
    // ...and start listening
    listener.listen();
})();
```

## Running the example
- Add to your hosts file the following entry:
`127.0.0.1  different-domain.com`

- Run `npm run example`
- Open you browser at `localhost:8080/example/main.html`

## Notes
- The creation of the Proxy will only resolve when an active listener has started listening.