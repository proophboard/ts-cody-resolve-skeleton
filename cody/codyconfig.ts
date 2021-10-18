import {onDocumentHook} from "./hooks/document";
import {onUiHook} from "./hooks/ui";
import {onCommandHook} from "./hooks/command";
import {onAggregateHook} from "./hooks/aggregate";
import {onEventHook} from "./hooks/event";
import {Map} from "immutable";
import {Node} from "./src/board/graph";

const CodyConfig = {
    context: {
        feFolder: '/dist',
        basename: '/',
        syncedNodes: Map<string, Node>(),
        syncRequired: true,
    },
    hooks: {
        onDocument: onDocumentHook,
        onUi: onUiHook,
        onCommand: onCommandHook,
        onAggregate: onAggregateHook,
        onEvent: onEventHook,
    }
};

module.exports = CodyConfig;
