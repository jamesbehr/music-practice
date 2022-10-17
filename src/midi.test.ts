import { Manager, Status } from './midi';

describe('Manager', () => {
    class MockAccess extends EventTarget {
        inputs: Map<string, WebMidi.MIDIInput>;
        outputs: Map<string, WebMidi.MIDIOutput>;
        sysexEnabled: boolean;
        onstatechange: (e: WebMidi.MIDIConnectionEvent) => void;

        constructor(inputs: Map<string, WebMidi.MIDIInput>, outputs: Map<string, WebMidi.MIDIOutput>, sysexEnabled: boolean) {
            super();

            this.inputs = inputs;
            this.outputs = outputs;
            this.sysexEnabled = sysexEnabled;
            this.onstatechange = () => { };
        }

        addEventListener(type: 'statechange', listener: (this: this, e: WebMidi.MIDIConnectionEvent) => any, options?: boolean | AddEventListenerOptions): void;
        addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
        addEventListener(type: any, listener: any, options: any) {
            super.addEventListener(type, listener, options)
        }

        static withInputs(inputs: WebMidi.MIDIInput[]) {
            const map = new Map(inputs.map((input) => [input.id, input]));
            return new MockAccess(map, new Map, false);
        }

        static withOutputs(outputs: WebMidi.MIDIOutput[]) {
            const map = new Map(outputs.map((output) => [output.id, output]));
            return new MockAccess(new Map, map, false);
        }
    }

    class MockPort extends EventTarget {
        id: string
        manufacturer?: string | undefined;
        name?: string | undefined;
        type: WebMidi.MIDIPortType;
        version?: string | undefined;
        state: WebMidi.MIDIPortDeviceState;
        connection: WebMidi.MIDIPortConnectionState;
        onstatechange: (e: WebMidi.MIDIConnectionEvent) => void;

        addEventListener(type: 'statechange', listener: (this: this, e: WebMidi.MIDIConnectionEvent) => any, options?: boolean | AddEventListenerOptions): void;
        addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
        addEventListener(type: any, listener: any, options: any) {
            super.addEventListener(type, listener, options);
        }

        async open() {
            return this;
        }

        async close() {
            return this;
        }

        constructor(id: string, type: WebMidi.MIDIPortType) {
            super();
            this.id = id;
            this.name = 'Test MIDI Device';
            this.type = type;
            this.state = 'connected';
            this.connection = 'closed';
            this.onstatechange = () => { };
        }
    }

    class MockInput extends MockPort {
        type: 'input';
        onmidimessage: (e: WebMidi.MIDIMessageEvent) => void;

        constructor(id: string) {
            super(id, 'input');
            this.type = 'input';
            this.onmidimessage = () => { };
        }

        addEventListener(type: 'statechange', listener: (this: this, e: WebMidi.MIDIConnectionEvent) => any, options?: boolean | AddEventListenerOptions): void;
        addEventListener(type: 'midimessage', listener: (this: this, e: WebMidi.MIDIMessageEvent) => any, options?: boolean | AddEventListenerOptions): void;
        addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
        addEventListener(type: any, listener: any, options: any) {
            super.addEventListener(type, listener, options);
        }
    };

    class MockOutput extends MockPort {
        type: 'output';

        constructor(id: string) {
            super(id, 'output');
            this.type = 'output';
        }

        send(data: number[] | Uint8Array, timestamp?: number) { }

        clear() { }
    };

    describe('status', () => {
        const manager = new Manager;

        test('unitialized', () => {
            expect(manager.status).toEqual(Status.Unitialized);
        });

        test('unsupported', async () => {
            // @ts-ignore
            delete window.navigator.requestMIDIAccess;

            await manager.connect();
            expect(manager.status).toEqual(Status.Unsupported);
        });

        test('success', async () => {
            window.navigator.requestMIDIAccess = async () => new MockAccess(new Map, new Map, false);

            await manager.connect();
            expect(manager.status).toEqual(Status.Success);
        });

        test('perimission denied', async () => {
            window.navigator.requestMIDIAccess = async () => { throw new Error; };

            await manager.connect();
            expect(manager.status).toEqual(Status.PermissionDenied);
        });
    });

    describe('input/output management', () => {
        const storage: { [key: string]: string } = {};
        const output = new MockOutput('out');
        const input = new MockInput('in');
        const manager = new Manager({
            set(key: string, value: string) {
                storage[key] = value;
            },
            get(key: string) {
                return storage[key] || null;
            }
        });

        test('manages outputs', async () => {
            window.navigator.requestMIDIAccess = async () => MockAccess.withOutputs([output]);
            await manager.connect();
            expect(manager.getOutput()).toBeUndefined();
            expect(manager.outputs()).toEqual([output]);

            manager.setOutput(output);
            expect(storage.output).toEqual('out');
            expect(manager.getOutput()).toEqual(output);
        })

        test('manages inputs', async () => {
            window.navigator.requestMIDIAccess = async () => MockAccess.withInputs([input]);
            await manager.connect();
            expect(manager.getInput()).toBeUndefined();
            expect(manager.inputs()).toEqual([input]);

            manager.setInput(input);
            expect(storage.input).toEqual('in');
            expect(manager.getInput()).toEqual(input);
        })
    });
});
