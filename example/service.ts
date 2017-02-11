import {createListener} from "../index";
import {MockService} from "./common";
const service = new MockService();

(async ()=> {
    const listener = await createListener(service);
    listener.listen();
    console.log(`iframe listening on ${window.location.href}`);
})();
