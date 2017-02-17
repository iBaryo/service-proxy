import {createListener} from "../index";
import {MockService} from "./common";
const service = new MockService();

(async ()=> {
    const listener = await createListener(service);
    listener.listen();
    console.log(`proxy listener on ${window.location.href}`);
})();
