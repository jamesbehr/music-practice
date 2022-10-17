import { useState, useEffect, useContext, createContext } from 'react';

type SomeEvent = NoteOnEvent | NoteOffEvent | ProgramChangeEvent;

function noteOff(deltaTick: number, note: number) : DeltaEvent {
    return {
        deltaTick,
        event: {
            type: 'note-off',
            note,
            channel: 0,
            velocity: 0x7f,
        },
    };
}

function noteOn(deltaTick: number, note: number) : DeltaEvent {
    return {
        deltaTick,
        event: {
            type: 'note-on',
            note,
            channel: 0,
            velocity: 0x7f,
        },
    };
}

export function noteOnOff(deltaTick: number, duration: number, note: number) : DeltaEvent[] {
    return [
        noteOn(deltaTick, note),
        noteOff(deltaTick + duration, note),
    ];
}

// TODO: Enum type?
interface ProgramChangeEvent {
    type: 'program-change',
    channel: number;
    program: number;
};

interface NoteOnEvent {
    type: 'note-on',
    channel: number;
    velocity: number;
    note: number;
};

interface NoteOffEvent {
    type: 'note-off';
    channel: number;
    velocity: number;
    note: number;
};

interface AbsoluteEvent {
    tick: number;
    event: SomeEvent;
};

interface DeltaEvent {
    deltaTick: number;
    event: SomeEvent;
};

enum Status {
    Unitialized,
    Unsupported,
    PermissionDenied,
    Success,
}

export class Manager extends EventTarget {
    access : WebMidi.MIDIAccess | null;
    output : WebMidi.MIDIOutput | null;
    input : WebMidi.MIDIInput | null;
    status: Status;

    constructor() {
        super();

        // TODO: Store input/output selections in localstorage
        this.access = null;
        this.output = null;
        this.input = null;
        this.status = Status.Unitialized;
    }

    connect() {
        if (!window.navigator.requestMIDIAccess) {
            this.status = Status.Unsupported;
            // TODO: Send state changed event
        }

        window.navigator.requestMIDIAccess().then((midiAccess) => {
            this.access = midiAccess;
            this.status = Status.Success;
            this.access.addEventListener('statechange', this.handleStateChange);
            this.dispatchDevicesChanged();
        }).catch((error) => {
            this.status = Status.PermissionDenied;
            // TODO: Send state changed event
        });
    }

    handleStateChange = (event: Event) => {
        this.dispatchDevicesChanged();
    };

    handleMidiMessage = (event: Event) => {
        console.log(event);
    };

    dispatchDevicesChanged() {
        this.dispatchEvent(new Event('devices-changed'));
    }

    disconnect() {
        if (this.access) {
            this.access.removeEventListener('statechange', this.handleStateChange);
        }
    }

    inputs(): WebMidi.MIDIInput[] {
        if (this.access) {
            return Array.from(this.access.inputs.values());
        }

        return [];
    }

    setInput(input: WebMidi.MIDIInput) {
        // Unsubscribe the previous input from events
        if (this.input) {
            this.input.removeEventListener('midimessage', this.handleMidiMessage);
        }

        this.input = input;

        this.input.addEventListener('midimessage', this.handleMidiMessage);
        this.dispatchDevicesChanged();
    }

    outputs(): WebMidi.MIDIOutput[] {
        if (this.access) {
            return Array.from(this.access.outputs.values());
        }

        return [];
    }

    setOutput(output: WebMidi.MIDIOutput) {
        if (this.output !== null) {
            // TODO: Clear any notes that were on
            this.output.clear();
        }

        this.output = output;
        this.dispatchDevicesChanged();
    }

    playEvent(event: SomeEvent) {
        if (!this.access) {
            console.warn('skipping event - MIDI not connected', event);
            return;
        }

        if (!this.output) {
            console.warn('skipping event - output not connected', event);
            return;
        }

        switch (event.type) {
            case 'note-off': {
                const channel = event.channel & 0xf;
                this.output.send([0x80 | channel, event.note & 0x7f, event.velocity & 0x7f]);
                break;
            }
            case 'note-on': {
                const channel = event.channel & 0xf;
                this.output.send([0x90 | channel, event.note & 0x7f, event.velocity & 0x7f]);
                break;
            }
            case 'program-change': {
                const channel = event.channel & 0xf;
                this.output.send([0xc0 | channel, event.program & 0x7f]);
                break;
            }
            default:
                console.warn('unhandled event', event);
                break;
        }
    }
};

// TODO: Maybe this should be a track player, since tracks can have independent tempos?
export class Player {
    timeoutId: number;
    msPerBeat: number;
    ticksPerBeat: number;
    tick: number;
    startTime: number;
    events: AbsoluteEvent[];
    manager: Manager;

    constructor(ticksPerBeat: number, manager: Manager) {
        this.timeoutId = 0;
        this.msPerBeat = 1000 / (120 / 60); // 120 bpm
        this.tick = 0;
        this.ticksPerBeat = ticksPerBeat;
        this.startTime = performance.now();
        this.events = [];
        this.manager = manager;
    };

    // TODO: This should be an event that sets the tempo
    setTempo(msPerBeat: number) {
        this.msPerBeat = msPerBeat;

        if (this.timeoutId > 0) {
            this.start();
        }
    }

    addEvents(events: DeltaEvent[]) {
        // TODO: Insert sorted
        this.events.push(...events.map(({ deltaTick, event }) => ({
            tick: this.tick + deltaTick,
            event,
        })));

        this.events.sort((a, b) => {
            if (a.tick < b.tick) {
                return -1;
            }

            if (a.tick > b.tick) {
                return 1;
            }

            return 0;
        });
    }

    start() {
        if (this.timeoutId > 0) {
            clearTimeout(this.timeoutId);
        }

        const startedAt = window.performance.now();

        const tick = (startTime?: number) => {
            const currentTime = window.performance.now();
            const msPerTick = this.msPerBeat / this.ticksPerBeat;

            let drift = 0;
            if (startTime !== undefined) {
                drift = msPerTick - (currentTime - startTime);
            }

            while (this.events.length > 0 && this.tick >= this.events[0].tick) {
                const event = this.events.shift()!;

                if (event.tick === this.tick) {
                    this.manager.playEvent(event.event);
                } else {
                    console.warn('missed event', event, this.tick);
                }
            }

            this.tick++;

            this.timeoutId = window.setTimeout(tick, msPerTick + drift, currentTime);
        };

        tick();
    }

    stop() {
        window.clearTimeout(this.timeoutId);
        this.timeoutId = 0;
    }
}

export const defaultManager = new Manager;
export const MIDIOutputContext = createContext<Manager>(defaultManager);

// TODO: Maybe have a separate thing for each output/inputs/state
export function useMIDI() {
    const manager = useContext(MIDIOutputContext);
    const [state, forceUpdate] = useState({ manager });

    useEffect(() => {
        function update() {
            forceUpdate({ manager: manager });
        }

        manager.addEventListener('devices-changed', update);

        return function unsubscribe() {
            manager.removeEventListener('devices-changed', update);
        };
    });

    return state;
}
