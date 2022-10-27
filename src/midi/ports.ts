import { useMIDIAccess } from './access';

interface DeviceInfo {
    id: string;
    manufacturer: string;
    name: string;
    state: WebMidi.MIDIPortDeviceState;
    type: WebMidi.MIDIPortType;
}

function deviceInfoFromPort(port: WebMidi.MIDIPort): DeviceInfo {
    return {
        id: port.id,
        name: port.name || '',
        manufacturer: port.manufacturer || '',
        state: port.state,
        type: port.type,
    };
}

function deviceInfosFromPortMap(map: Map<string, WebMidi.MIDIPort>) {
    return Array.from(map.values()).map(deviceInfoFromPort);
}

export function useMIDIPorts() {
    const result = useMIDIAccess();
    if (result.status === 'success') {
        return {
            status: result.status,
            ports: [...deviceInfosFromPortMap(result.access.inputs), ...deviceInfosFromPortMap(result.access.outputs)],
        };
    }

    return { status: result.status };
}
