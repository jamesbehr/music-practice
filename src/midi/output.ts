import { useMIDIAccess } from './access';
import {
    MIDIEventType,
    NoteOnMIDIEvent,
    NoteOffMIDIEvent,
    MIDIEvent,
    serializeMIDIEvent,
    noteOff,
    noteOffData,
} from './events';

type UseMIDIOutput = {
    /**
     * The status of the underlying MIDI access API and the port.
     */
    status: 'uninitialized' | 'unsupported' | 'permission-denied' | 'disconnected' | 'connected';

    /**
     * Send the MIDI event to the specified output port if the status is
     * 'connected'. Otherwise, this function does nothing.
     */
    sendEvent: (event: MIDIEvent) => void;

    /**
     * Re-request permission from the user to use the Web MIDI API.
     */
    retry: () => void;

    /**
     * Calls clear on the underlying MIDI port and turns off any notes that are switched on.
     */
    reset: () => void;
};

function noteToKey(event: NoteOnMIDIEvent | NoteOffMIDIEvent) {
    const { channel, note } = event;
    return (channel << 8) | note;
}

function keyToNote(key: number) {
    const channel = key >> 8;
    const note = key & 0xff;
    return { channel, note };
}

/**
 * Returns a function that will send the event it receives to a MIDI port with
 * the given id, along with the port status.
 * If no port exists with the provided id, then the function will do nothing. If
 * a port with that id is later connected, the function will still send events.
 */
export function useMIDIOutput(portId: string): UseMIDIOutput {
    const result = useMIDIAccess();
    if (result.status === 'success') {
        const output = result.access.outputs.get(portId);
        const notes = new Set<number>();

        if (output) {
            return {
                sendEvent(event) {
                    if (event.type === MIDIEventType.NoteOn) {
                        if (event.velocity === 0) {
                            notes.delete(noteToKey(event));
                        } else {
                            notes.add(noteToKey(event));
                        }
                    } else if (event.type === MIDIEventType.NoteOff) {
                        notes.delete(noteToKey(event));
                    }

                    const data = serializeMIDIEvent(event);
                    if (data) {
                        output.send(data);
                    } else {
                        console.warn('Unhandled MIDI event', event);
                    }
                },
                status: output.state,
                retry: result.retry,
                reset() {
                    output.clear();

                    notes.forEach((key) => {
                        const { note, channel } = keyToNote(key);
                        output.send(noteOffData(noteOff(note, channel)));
                    });
                },
            };
        }

        return {
            sendEvent() {},
            status: 'disconnected',
            retry: result.retry,
            reset() {},
        };
    }

    return {
        sendEvent() {},
        status: result.status,
        retry: result.retry,
        reset() {},
    };
}
