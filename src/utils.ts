export const getParentUrl =
    () => (window.location != window.parent.location)
        ? document.referrer
        : document.location.href;

export const validateOrigin = (origin: string, checked: string) => origin.indexOf(checked) === 0;

export const createIframe = () => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.height = '0px';
    iframe.style.width = '0px';
    iframe.style.visibility = 'hidden';
    return iframe;
};

let _counter = 1;
export const generateId = () => {
    return String(_counter++);
};

// http://stackoverflow.com/questions/31054910/get-functions-methods-of-a-class
export const getAllClassMethodsNames = (type: new()=>any) : string[] => {
    let props : string[] = [];

    let proto = type.prototype;
    do {
        const l = Object.getOwnPropertyNames(proto)
            // .concat(Object.getOwnPropertySymbols(proto).map(s => s.toString()))
            .map(s => s.toString())
            .sort()
            .filter((p, i, arr) =>
                typeof proto[p] === 'function' &&  //only the methods
                p !== 'constructor' &&           //not the constructor
                (i == 0 || p !== arr[i - 1]) &&  //not overriding in this prototype
                props.indexOf(p) === -1          //not overridden in a child
            );
        props = props.concat(l)
    }
    while (
    (proto = Object.getPrototypeOf(proto)) &&   //walk-up the prototype chain
    Object.getPrototypeOf(proto)              //not the the Object prototype methods (hasOwnProperty, etc...)
        );

    return props
};