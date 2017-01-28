export const getParentUrl =
    () => (window.location != window.parent.location)
        ? document.referrer
        : document.location.href;

export const validateOrigin = (origin : string, checked : string) => origin.indexOf(checked) === 0;

export const generateId = () => {
    return '123';
};