export const resetSpies = (mock : {[key : string] : jasmine.Spy}) => Object.keys(mock).forEach(key => {
    const spy = mock[key] as jasmine.Spy;

    if (spy.calls && spy.calls.reset)
        spy.calls.reset();
});

export const Async = (fn : () => Promise<any>) => ((done) => fn().then(done).catch(fail));