import { useEffect, useCallback } from 'react';
import { useMIDIAccess } from './access';
import { MIDIEvent, deserializeMIDIEvent } from './events';

type UseMIDIInput = {
    status: 'uninitialized' | 'unsupported' | 'permission-denied' | 'disconnected' | 'connected';
    retry: () => void;
};

/**
 * If a MIDI output port with the given portId exist, register a midimessage
 * callback that calls the provided onMidiEvent function.
 *
 * If no port exists with that id, wait until one exists and then register the
 * callback.
 */
export function useMIDIInput(portId: string, onMidiEvent: (e: MIDIEvent) => void): UseMIDIInput {
    const handleMidiMessage = useCallback(
        (event: Event) => {
            const midiEvent = event as WebMidi.MIDIMessageEvent;
            const parsed = deserializeMIDIEvent(midiEvent.data);
            if (parsed) {
                onMidiEvent(parsed);
            }
        },
        [onMidiEvent],
    );

    const result = useMIDIAccess();

    const input = result.status === 'success' && result.access.inputs.get(portId);

    useEffect(() => {
        if (!input) {
            return;
        }

        input.addEventListener('midimessage', handleMidiMessage);

        return function unsubscribe() {
            input.removeEventListener('midimessage', handleMidiMessage);
        };
    }, [input, handleMidiMessage]);

    if (result.status === 'success') {
        if (input) {
            return { status: 'connected', retry: result.retry };
        }

        return { status: 'disconnected', retry: result.retry };
    }

    return { status: result.status, retry: result.retry };
}
