import { useEffect, useCallback } from 'react';
import { useMIDIAccess } from './access';
import { MIDIEvent, deserializeMIDIEvent } from './events';

type UseAnyMIDIInput = {
    status: 'uninitialized' | 'unsupported' | 'permission-denied' | 'success';
    retry: () => void;
};

/**
 * Registers a midimessage callback that calls onMidiEvent on every output
 * port.
 */
export function useAnyMIDIInput(onMidiEvent: (e: MIDIEvent) => void): UseAnyMIDIInput {
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
    const inputs = result.status === 'success' && result.access.inputs;

    useEffect(() => {
        if (!inputs) {
            return;
        }

        inputs.forEach((input) => {
            input.addEventListener('midimessage', handleMidiMessage);
        });

        return function unsubscribe() {
            inputs.forEach((input) => {
                input.removeEventListener('midimessage', handleMidiMessage);
            });
        };
    }, [inputs, handleMidiMessage]);

    return result;
}
