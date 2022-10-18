const isProduction: boolean = process.env.NODE_ENV === 'production';

export function assert(condition: any, message?: string): asserts condition {
    if (condition) {
        return;
    }

    if (isProduction) {
        throw new Error('Assertion failed');
    }

    if (message) {
        throw new Error(`Assertion failed: ${message}`);
    }

    throw new Error('Assertion failed');
}
