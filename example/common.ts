export class MockService {
    mockMethod() {
        return new Promise(resolve => setTimeout(()=> resolve(42), 100));
    }
}