export class MockService {
    public mockMethod(param?     : any) {
        return new Promise(resolve => setTimeout(()=> resolve(param), 100));
    }
}