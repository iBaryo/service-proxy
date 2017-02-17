export class MockService {
    public mockMethod(param?     : any) {
        return new Promise(resolve => setTimeout(()=> resolve(param), 100));
    }

    public throwSyncMethod() {
        throw 'wonderful error';
    }

    public throwAsyncMethod() {
        return new Promise((r, reject) => setTimeout(()=>reject('wonderful async error'), 100));
    }
}