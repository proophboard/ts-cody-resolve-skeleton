import { CodyHook } from '../src/board/code';
import { Context } from './context';
import { Node, NodeType } from '../src/board/graph';
import { CodyResponse, CodyResponseType, isCodyError } from '../src/general/response';
import { readFile, refreshIndexFile, shouldIgnoreFile, writeFile } from './utils/file';
import { nodeNameToPascalCase, nodeNameToSnakeCase } from '../src/utils/string';
import { extractEventMetadata } from './utils/metadata';
import { getAggregateType, loadResolveConfig, loadSchemaDefinitions, upsertAggregateEventConfig } from './utils/config';
import { getSingleSource } from '../src/utils/node-traversing';
import { compileSchema } from './utils/jsonschema';
import { writeFileSync } from '../src/utils/filesystem';
import { createAggregateModuleIfNotExists } from './aggregate';

export const onEventHook: CodyHook<Context> = async (event: Node, ctx: Context): Promise<CodyResponse> => {

    const evtName = nodeNameToPascalCase(event);
    const eventFilename = evtName + '.ts';
    const metadata = extractEventMetadata(event);
    const config = loadResolveConfig(ctx);
    const defs = loadSchemaDefinitions(ctx);
    const eventTypesFile = ctx.feFolder + '/common/event-types.ts';

    if (isCodyError(metadata)) {
        return metadata;
    }

    if (isCodyError(config)) {
        return config;
    }

    if (isCodyError(defs)) {
        return defs;
    }

    let successDetails = 'Checklist\n\n';

    // const eventTypes = readFile(eventTypesFile);
    //
    // if (isCodyError(eventTypes)) {
    //     return eventTypes;
    // }
    //
    // const eventType = `export const ${evtName} = '${evtName}'`;
    //
    // if (eventTypes.search(new RegExp(eventType, 'g')) === -1) {
    //     writeFile(eventTypesFile, eventTypes + '\n' + eventType);
    // }

    const aggregate = getSingleSource(event, NodeType.aggregate);

    if (isCodyError(aggregate)) {
        if (config.events.hasOwnProperty(evtName) && config.events[evtName].aggregateType) {
            return {
                cody: `Skipped event ${evtName}.`,
                details: 'Looks like an aggregate event produced elsewhere.',
            };
        }

        return {
            cody: `Skipped event ${evtName}.`,
            details: 'Looks like public event not relevant for the UI.',
        };
    }

    const aggregateType = getAggregateType(aggregate, ctx);

    const aggregateDir = await createAggregateModuleIfNotExists(aggregate, ctx);

    if (isCodyError(aggregateDir)) {
        return aggregateDir;
    }

    const eventDir = aggregateDir + '/events';
    const eventFile = eventDir + `/${eventFilename}`;

    try {
        const content = await compileSchema(metadata.schema, evtName, eventFile, defs, `export const ${nodeNameToSnakeCase(evtName).toUpperCase()} = '${evtName}'`);

        if (shouldIgnoreFile(eventFile)) {
            successDetails = successDetails + `⏩️ Skipped ${eventFile} due to // @cody-ignore\n`;
        } else {
            const writeFileErr = writeFileSync(eventFile, content);

            if (writeFileErr) {
                return writeFileErr;
            }

            successDetails = successDetails + `✔️ Event file ${eventFile} written\n`;
        }

        const evtConfigErr = upsertAggregateEventConfig(evtName, aggregateType, event.getLink(), metadata, config, ctx);

        if (isCodyError(evtConfigErr)) {
            return evtConfigErr;
        }

        const refreshResult = refreshIndexFile(config, ctx, NodeType.event, aggregateDir);

        if (isCodyError(refreshResult)) {
            return refreshResult;
        }
    } catch (reason) {
        return {
            cody: `I was not able to compile schema of event ${event.getName()}`,
            details: reason.toString(),
            type: CodyResponseType.Error,
        };
    }


    successDetails = successDetails + `✔️ Event ${evtName} added to resolve.json\n`;

    return {
        cody: `Event ${evtName} is added to the app!`,
        details: ['%c' + successDetails, 'color: #73dd8e;font-weight: bold'],
    };
};
