import { JSONSchema } from 'json-schema-to-typescript';
import { Node, NodeLink } from '../../src/board/graph';
import { CodyResponse, CodyResponseType, isCodyError } from '../../src/general/response';
import { writeFileSync } from '../../src/utils/filesystem';
import { nodeNameToPascalCase } from '../../src/utils/string';
import { ResolveConfig, SchemaDefinitions } from '../types';
import { Context } from '../context';
import { AggregateMetadata, CommandMetadata, EventMetadata, UiRouteParams } from './metadata';
import * as fs from 'fs';
import { readFileToJson } from './file';

let resolveConfig: ResolveConfig | null;
let schemaDefinitions: SchemaDefinitions | null;

export const loadResolveConfig = (ctx: Context): ResolveConfig | CodyResponse => {
    if (!resolveConfig) {
        if (!fs.existsSync(ctx.feFolder + '/resolve.json')) {
            return {
                cody: 'Missing resolve.json in app root',
                type: CodyResponseType.Error,
            };
        }

        const maybeConfig = readFileToJson<ResolveConfig>(ctx.feFolder + '/resolve.json');

        if (isCodyError(maybeConfig)) {
            return maybeConfig;
        }

        resolveConfig = maybeConfig;
    }

    return resolveConfig;
};

export const loadSchemaDefinitions = (ctx: Context): SchemaDefinitions | CodyResponse => {
    if (!schemaDefinitions) {
        if (!fs.existsSync(ctx.feFolder + '/schema-definitions.json')) {
            return {
                cody: 'Missing schema-definitions.json in app root',
                type: CodyResponseType.Error,
            };
        }

        const maybeDefinitions = readFileToJson<SchemaDefinitions>(ctx.feFolder + '/schema-definitions.json');

        if (isCodyError(maybeDefinitions)) {
            return maybeDefinitions;
        }

        schemaDefinitions = maybeDefinitions;
    }

    return schemaDefinitions;
};


export const upsertSchemaDefinitionConfig = (schemaName: string, schemaSource: string, schema: JSONSchema, def: SchemaDefinitions, ctx: Context): CodyResponse | null => {
    if (def.sourceMap.hasOwnProperty(schemaName)) {
        if (def.sourceMap[schemaName] !== schemaSource) {
            return {
                cody: 'I found a duplicate schema definition!',
                details: `Schema name ${schemaName} is already registered in schema-definitions.json with a different source: ${def.sourceMap[schemaName]}, but you want me to add it with source: ${schemaSource}. Only one source is possible, to avoid schema conflicts. You have to resolve it first, sorry`,
                type: CodyResponseType.Error,
            };
        }
    }

    def.sourceMap[schemaName] = schemaSource;

    if (schemaName.charAt(0) === '/') {
        schemaName = schemaName.slice(1);
    }

    let defDefinitions = def.definitions;

    const nsSplit = schemaName.split('/');

    nsSplit.forEach((key, index) => {
        if (!defDefinitions.hasOwnProperty(key)) {
            defDefinitions[key] = {};
        }

        if (index < nsSplit.length - 1) {
            defDefinitions = defDefinitions[key];
        } else {
            defDefinitions[key] = schema;
        }

    });


    defDefinitions = schema;

    return writeSchemaDefinitions(def, ctx);
};

export const messageName = (message: Node, ctx: Context): string => {
    return nodeNameToPascalCase(message.getName());
};

export const getAggregateType = (aggregate: Node, ctx: Context): string => {
    return nodeNameToPascalCase(aggregate.getName());
};

export const getRelativeCommandDir = (command: Node, config: ResolveConfig): string | CodyResponse => {
    const cmdName = nodeNameToPascalCase(command.getName());
    if (!config.commands.hasOwnProperty(cmdName)) {
        return {
            cody: `Can't find command ${cmdName} in resolve.json`,
            details: 'Did you remove it or did I miss to add it?',
            type: CodyResponseType.Error,
        };
    }

    const cmdConfig = config.commands[cmdName];

    return `model/${cmdConfig.aggregateType}/commands/${cmdName}`;
};

export const getRelativeEventDir = (event: Node, config: ResolveConfig): string | CodyResponse => {
    const evtName = nodeNameToPascalCase(event.getName());
    if (!config.events.hasOwnProperty(evtName)) {
        return {
            cody: `Can't find event ${evtName} in resolve.json`,
            details: 'Did you remove it or did I miss to add it?',
            type: CodyResponseType.Error,
        };
    }

    const evtConfig = config.events[evtName];

    if (evtConfig.aggregateType) {
        return `model/${evtConfig.aggregateType}/events/${evtName}`;
    } else {
        return `external/events/${evtName}`;
    }

};

export const determineEventStreamOfEvent = (event: Node, config: ResolveConfig, ctx: Context): string | CodyResponse => {
    const evtName = messageName(event, ctx);
    if (!config.events.hasOwnProperty(evtName)) {
        return {
            cody: `Tried to look up event ${evtName} in resolve.json, but can't find it there.`,
            details: `Maybe you can give me more information about the event first?`,
            type: CodyResponseType.Error,
        };
    }

    const eventConfig = config.events[evtName];

    if (eventConfig.stream) {
        return eventConfig.stream;
    }

    const aggregateType = config.events[evtName].aggregateType;

    if (!aggregateType) {
        return {
            cody: `I try to lookup the event stream for event ${evtName}. Therefore I either need to know the responsible aggregate or you define the stream in event metadata, but there is nothing configured in resolve.json`,
            details: `Is the event not connected with an aggregate or did you forget to pass the information to me?`,
            type: CodyResponseType.Error,
        };
    }

    if (!config.aggregates.hasOwnProperty(aggregateType)) {
        return {
            cody: `The aggregate type ${aggregateType} set for event ${evtName} in resolve.json does not exist!`,
            details: `That's strange. I can only imagine that someone (not me) has accidentally removed the aggregate from the config.`,
            type: CodyResponseType.Error,
        };
    }

    return config.aggregates[aggregateType].eventStream;
};

export const upsertAggregateConfig = (link: NodeLink, aggregate: AggregateMetadata, config: ResolveConfig, ctx: Context): CodyResponse | null => {
    if (!config.aggregates.hasOwnProperty(aggregate.aggregateType)) {
        config.aggregates[aggregate.aggregateType] = {
            aggregateType: aggregate.aggregateType,
            eventMapLink: link,
            aggregateIdentifier: aggregate.identifier,
            eventStream: aggregate.stream,
            aggregateCollection: aggregate.collection,
            multiStoreMode: aggregate.multiStoreMode,
            events: [],
        };
    } else {
        config.aggregates[aggregate.aggregateType] = {
            ...config.aggregates[aggregate.aggregateType],
            ...{
                aggregateIdentifier: aggregate.identifier,
                eventStream: aggregate.stream,
                aggregateCollection: aggregate.collection,
                multiStoreMode: aggregate.multiStoreMode,
                eventMapLink: link,
            },
        };
    }

    return writeConfig(config, ctx);
};

export const upsertCommandConfig = (
    commandName: string,
    aggregateType: string,
    eventMapLink: NodeLink,
    metadata: CommandMetadata,
    config: ResolveConfig,
    ctx: Context,
): CodyResponse | null => {
    config.commands[commandName] = {
        commandName,
        aggregateType,
        eventMapLink,
        createAggregate: metadata.newAggregate,
        schema: metadata.schema,
    };

    return writeConfig(config, ctx);
};

export const upsertPublicEventConfig = (
    eventName: string,
    eventMapLink: NodeLink,
    metadata: EventMetadata,
    config: ResolveConfig,
    ctx: Context,
): CodyResponse | null => {
    config.events[eventName] = {
        eventName,
        eventMapLink,
        'public': metadata.public,
        schema: metadata.schema,
    };

    if (metadata.stream) {
        config.events[eventName]['stream'] = metadata.stream;
    }

    return writeConfig(config, ctx);
};

export const upsertAggregateEventConfig = (
    eventName: string,
    aggregateType: string,
    eventMapLink: NodeLink,
    metadata: EventMetadata,
    config: ResolveConfig,
    ctx: Context,
): CodyResponse | null => {
    config.events[eventName] = {
        eventName,
        aggregateType,
        eventMapLink,
        'public': metadata.public,
        schema: metadata.schema,
    };

    if (!config.aggregates[aggregateType].events.includes(eventName)) {
        config.aggregates[aggregateType].events.push(eventName);
    }

    return writeConfig(config, ctx);
};

export const upsertQueryConfig = (queryName: string, eventMapLink: NodeLink, schema: JSONSchema, returnType: JSONSchema, config: ResolveConfig, ctx: Context): CodyResponse | null => {
    config.queries[queryName] = {
        queryName,
        schema,
        returnType,
        eventMapLink,
    };

    return writeConfig(config, ctx);
};

export const upsertSagaConfig = (sagaName: string, config: ResolveConfig, ctx: Context): CodyResponse | null => {
    if (!config.sagas.includes(sagaName)) {
        config.sagas.push(sagaName);
    }

    return writeConfig(config, ctx);
};


export const upsertPageConfig = (config: ResolveConfig, ctx: Context, route: string, component: string, topLevel: boolean, icon?: string, menuLabel?: string, breadCrumbsLabel?: string, routeParams?: UiRouteParams): CodyResponse | null => {
    config.pages[route] = {
        component,
        topLevel,
        icon,
        menuLabel,
        breadcrumbLabel: breadCrumbsLabel,
        routeParams,
    };

    return writeConfig(config, ctx);
};

const writeConfig = (config: ResolveConfig, ctx: Context): CodyResponse | null => {
    resolveConfig = null;
    return writeFileSync(ctx.feFolder + '/resolve.json', JSON.stringify(config, null, 2));
};

const writeSchemaDefinitions = (def: SchemaDefinitions, ctx: Context): CodyResponse | null => {
    schemaDefinitions = null;
    return writeFileSync(ctx.feFolder + '/schema-definitions.json', JSON.stringify(def, null, 2));
};
