import {NodeMap} from "../src/board/graph";

export interface Context {
    feFolder: string;
    basename?: string;
    syncedNodes: NodeMap;
    syncRequired: boolean;
    silent?: boolean;
}
