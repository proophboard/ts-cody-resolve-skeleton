import {CodyHook} from "../src/board/code";
import {Context} from "./context";
import {Node, NodeType} from "../src/board/graph";
import {CodyResponse, CodyResponseType, isCodyError} from "../src/general/response";
import { readFile, writeFile } from './utils/file';
import { nodeNameToConstName } from '../src/utils/string';
import { extractEventMetadata } from './utils/metadata';
import { getAggregateType, loadResolveConfig, upsertAggregateEventConfig } from './utils/config';
import { getSingleSource } from '../src/utils/node-traversing';

export const onEventHook: CodyHook<Context> = async (event: Node, ctx: Context): Promise<CodyResponse> => {

    const evtName = nodeNameToConstName(event);
    const metadata = extractEventMetadata(event);
    const config = loadResolveConfig(ctx);
    const eventTypesFile = ctx.feFolder + '/common/event-types.ts';

    if(isCodyError(metadata)) {
        return metadata;
    }

    if(isCodyError(config)) {
        return config;
    }

    let successDetails = 'Checklist\n\n';

    const eventTypes = readFile(eventTypesFile)

    if(isCodyError(eventTypes)) {
        return eventTypes;
    }

    const eventType = `export const ${evtName} = '${evtName}'`;

    if (eventTypes.search(new RegExp(eventType, "g")) === -1) {
        writeFile(eventTypesFile, eventTypes + "\n" + eventType);
    }

    const aggregate = getSingleSource(event, NodeType.aggregate);

    if(isCodyError(aggregate)) {
        if(config.events.hasOwnProperty(evtName) && config.events[evtName].aggregateType) {
            return {
                cody: `Skipped event ${evtName}.`,
                details: 'Looks like an aggregate event produced elsewhere.'
            }
        }

        return {
            cody: `Skipped event ${evtName}.`,
            details: 'Looks like public event not relevant for the UI.'
        }
    }

    const aggregateType = getAggregateType(aggregate, ctx);

    const evtConfigErr = upsertAggregateEventConfig(evtName, aggregateType, event.getLink(), metadata, config, ctx);

    if(isCodyError(evtConfigErr)) {
        return evtConfigErr;
    }

    return {
        cody: [`%cI'm skipping "${event.getName()}" due missing implementation.`, 'color: #fb9f4b; font-weight: bold'],
        details: [`%cIf you want me to handle ${event.getName()}, implement the desired code please.`, 'color: #414141', 'background-color: rgba(251, 159, 75, 0.2)', 'color: #414141'],
        type: CodyResponseType.Info
    }
}
