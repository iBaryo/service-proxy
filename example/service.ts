import {createListener} from "../index";
import {MockService} from "./common";
const service = new MockService();
let cancelStop = true;
function delay(ms) {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
}

(async ()=> {
    // Creating the listener
    const listener = await createListener(service);

    // Starting to listen and passing initial value.
    listener.listen({ initial: 'everything is awesome' });

    // Setting a listener-stop canceller
    // - for example this will cancel the stopping of the service when trying for the first time
    listener.stopCancellers.push(async () => {
        await delay(10);
        if (cancelStop) {
            cancelStop = false;
            return {cancelReason: 'fun'};
        }
        else
            return false;
    });

    // Setting a value that will return when stopping
    listener.onStop = () => ({goodbye: 'so long, travel safe'});

    console.log(`proxy listener on ${window.location.href}`);
})();
