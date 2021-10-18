import {JSONSchema} from "json-schema-to-typescript";
import {CodyResponse, CodyResponseType, isCodyError} from "../../src/general/response";
import {parseJsonMetadata} from "../../src/utils/metadata";
import {Node} from "../../src/board/graph";
import {nodeNameToCamelCase, nodeNameToPascalCase, nodeNameToSnakeCase} from "../../src/utils/string";
import {
    convertShorthandObjectToJsonSchema,
    convertShorthandStringToJsonSchema,
    mapPropertiesToTitles
} from "./jsonschema";
import { UiSchema } from "@rjsf/core";
import {camelCaseToTitle, detectVoNamespace} from "./schemaHelpers";

export const DEFAULT_COMMAND_BUTTON = "CommandButton";

export interface UiButton {
    component: string;
    icon?: string;

}

export interface CommandMetadata {
    newAggregate: boolean;
    schema: JSONSchema;
    shorthand?: boolean;
    uiSchema?: {[prop: string]: any};
    uiButton?: UiButton;
}

export interface EventMetadata {
    public: boolean;
    schema: JSONSchema;
    apply: string;
    shorthand?: boolean;
    stream?: string;
}

export interface AggregateMetadata {
    aggregateType: string,
    process: string,
    stream: string,
    collection: string,
    identifier: string,
    multiStoreMode: MultiStoreMode,
    dependencies: string[],
}

export interface UiSchemaTable {
    table: {
        columns: UiSchemaTableColumn[]
    }
}

export type UiSchemaTableColumn = string | UiSchemaTableColumnConfig;

export enum ColumnType {
    string = 'string',
    number = 'number',
    relation = 'relation',
    linearProgress = 'linearProgress',
}

export interface ColumnLinearProgress {
    type: ColumnType.linearProgress,
}

export interface ColumnRelation {
    type: ColumnType.relation,
    data: string,
    targetPage: string,
    mapping: string,
    display: string,
}

export interface UiSchemaTableColumnConfig {
    field: string;
    title: string;
    config?: ColumnRelation | ColumnLinearProgress
}

export interface DocumentMetadata {
    shorthand?: boolean;
    schema: JSONSchema,
    querySchema?: JSONSchema,
    uiSchema?: UiSchema & UiSchemaTable,
    aggregateState?: boolean,
    ns?: string,
    namespace?: string,
}

export interface ProjectionMetadata {
    streams: string[],
    targetCollection: string,
}

export interface SagaMetadata {
    streams: string[],
}

export type UiRouteParams = Array<{name: string, type: string}>;

export interface UiMetadata {
    route: string,
    menuIcon: string,
    menuLabel: string,
    breadcrumbLabel: string,
    topLevel: boolean,
    routeParams: UiRouteParams,
}

type MultiStoreMode = 'mode_e' | 'mode_s' | 'mode_e_s';

type CmdSuccess = CommandMetadata;
type CmdError = CodyResponse;

export const extractCommandMetadata = (command: Node): CmdSuccess | CmdError => {
    const [rawMeta, codyErrRes] = parseJsonMetadata<CommandMetadata>(command);

    if(codyErrRes) {
        return codyErrRes;
    }

    if(typeof rawMeta !== 'object') {
        return {
            cody: `I expected metadata of command "${command.getName()}" to be an object, but it is of type: ` + typeof rawMeta,
            type: CodyResponseType.Error
        };
    }

    let newAggregate = false;
    let schema: JSONSchema = {};
    let uiSchema;
    let uiButton: UiButton | undefined;


    if(rawMeta !== null) {
        if(rawMeta.hasOwnProperty('newAggregate')) {
            // @ts-ignore
            newAggregate = !!rawMeta.newAggregate;
        }

        if(rawMeta.hasOwnProperty('uiButton')) {
            uiButton = typeof rawMeta.uiButton === 'string'? {component: rawMeta.uiButton} : rawMeta.uiButton as UiButton;

            if(!uiButton.hasOwnProperty('component')) {
                uiButton.component = DEFAULT_COMMAND_BUTTON;
            }
        }

        if(!rawMeta.hasOwnProperty('schema')) {
            return {
                cody: `I'm missing a schema definition for command "${command.getName()}"`,
                type: CodyResponseType.Error
            }
        }

        // @ts-ignore
        schema = rawMeta.schema;

        if(typeof schema !== 'object') {
            return {
                cody: `Schema definition for command "${command.getName()}" is expected to be an object, but got ` + typeof schema,
                type: CodyResponseType.Error
            }
        }

        if(rawMeta.shorthand) {
            const schemaConversion = convertShorthandObjectToJsonSchema(schema);

            if(isCodyError(schemaConversion)) {
                return schemaConversion;
            }

            schema = schemaConversion;
        }

        if(!schema.hasOwnProperty('title')) {
            schema.title = camelCaseToTitle(nodeNameToCamelCase(command));
        }

        if(rawMeta.uiSchema) {
            uiSchema = rawMeta.uiSchema;
        }
    }

    return {
        newAggregate,
        schema: mapPropertiesToTitles(schema),
        uiSchema,
        uiButton,
    }
}

type EvtSuccess = EventMetadata;
type EvtError = CodyResponse;

export const extractEventMetadata = (event: Node): EvtSuccess | EvtError => {
    const [rawMeta, codyErrRes] = parseJsonMetadata<Partial<EventMetadata>>(event);

    if(codyErrRes) {
        return codyErrRes;
    }

    if(typeof rawMeta !== 'object') {
        return {
            cody: `I expected metadata of event "${event.getName()}" to be an object, but it is of type: ` + typeof rawMeta,
            type: CodyResponseType.Error
        };
    }

    let publicFlag = false;
    let schema: JSONSchema = {};
    let apply = '';
    let stream;

    if(rawMeta !== null) {
        if(rawMeta.hasOwnProperty('public')) {
            // @ts-ignore
            publicFlag = !!rawMeta.public;
        }

        if(!rawMeta.hasOwnProperty('schema')) {
            return {
                cody: `I'm missing a schema definition for event "${event.getName()}"`,
                type: CodyResponseType.Error
            }
        }

        // @ts-ignore
        schema = rawMeta.schema;

        if(typeof schema !== 'object') {
            return {
                cody: `Schema definition for event "${event.getName()}" is expected to be an object, but got ` + typeof schema,
                type: CodyResponseType.Error
            }
        }

        if(rawMeta.shorthand) {
            const schemaConversion = convertShorthandObjectToJsonSchema(schema);

            if(isCodyError(schemaConversion)) {
                return schemaConversion;
            }

            schema = schemaConversion;
        }

        if(!schema.hasOwnProperty('title')) {
            schema.title = camelCaseToTitle(nodeNameToCamelCase(event));
        }

        if(rawMeta.apply) {
           apply = rawMeta.apply;
        }

        if(rawMeta.stream) {
            stream = rawMeta.stream;
        }
    }

    const meta: EventMetadata = {
        "public": publicFlag,
        schema: mapPropertiesToTitles(schema),
        apply
    };

    if(stream) {
        meta['stream'] = stream;
    }

    return meta;
}

type ArSuccess = AggregateMetadata;
type ArError = CodyResponse;

export const extractAggregateMetadata = (aggregate: Node): ArSuccess | ArError => {
    const [rawMeta, codyErrRes] = parseJsonMetadata<Partial<AggregateMetadata>>(aggregate);

    if(codyErrRes) {
        return codyErrRes;
    }

    if(typeof rawMeta !== 'object') {
        return {
            cody: `I expected metadata of aggregate "${aggregate.getName()}" to be an object, but it is of type: ` + typeof rawMeta,
            type: CodyResponseType.Error
        };
    }

    const aggregateType = nodeNameToPascalCase(aggregate);
    let identifier = 'id';
    let stream = nodeNameToSnakeCase(aggregate) + '_stream';
    let collection = nodeNameToSnakeCase(aggregate);
    let multiStoreMode: MultiStoreMode = 'mode_e_s';
    let process = '';
    let dependencies: string[] = [];

    if(rawMeta !== null) {
        if(rawMeta.identifier) {
            identifier = rawMeta.identifier;
        } else {
            return {
                cody: `Missing identifer in metadata of aggregate: ${aggregate.getName()}`
            }
        }

        if(rawMeta.stream) {
            stream = rawMeta.stream;
        }

        if(rawMeta.collection) {
            collection = rawMeta.collection;
        }

        if(rawMeta.process) {
            process = rawMeta.process;
        }

        if(rawMeta.multiStoreMode) {
            multiStoreMode = rawMeta.multiStoreMode;
        }

        if(rawMeta.dependencies) {
            dependencies = rawMeta.dependencies;
        }

        const checks = [
            [identifier, 'identifier', 'string'],
            [stream, 'stream', 'string'],
            [collection, 'collection', 'string'],
            [multiStoreMode, 'multiStoreMode', 'string'],
            [process, 'process', 'string'],
        ];

        for(const [metaProp, metaPropName, propType, propItemType] of checks) {
            if(typeof metaProp !== propType) {
                return {
                    cody: `${metaPropName} definition for aggregate "${aggregate.getName()}" is expected to be a ${propType}, but got ` + typeof metaProp,
                    type: CodyResponseType.Error
                }
            }
        }

        if(!Array.isArray(dependencies)) {
            return {
                cody: `dependencies definition for aggregate "${aggregate.getName()}" is expected to be an array, but got ` + typeof dependencies,
                type: CodyResponseType.Error
            }
        }

        for(const dep of dependencies) {
            if(typeof dep !== 'string') {
                return {
                    cody: `dependencies definition for aggregate "${aggregate.getName()}" is expected to be an array of string, but got an item with type ` + typeof dep,
                    type: CodyResponseType.Error
                }
            }
        }
    }

    return {
        aggregateType,
        identifier,
        stream,
        collection,
        process,
        multiStoreMode,
        dependencies,
    }
}

type DocSuccess = DocumentMetadata;
type DocError = CodyResponse;

export const extractDocumentMetadata = (document: Node): DocSuccess | DocError => {
    const [rawMeta, codyErrRes] = parseJsonMetadata<Partial<DocumentMetadata>>(document);

    if(codyErrRes) {
        return codyErrRes;
    }

    if(typeof rawMeta !== 'object') {
        return {
            cody: `I expected metadata of document "${document.getName()}" to be an object, but it is of type: ` + typeof rawMeta,
            type: CodyResponseType.Error
        };
    }

    let schema: JSONSchema = {};
    let querySchema;
    let uiSchema;
    let aggregateState: boolean = false;
    let namespace;

    if(rawMeta !== null) {
        if(!rawMeta.hasOwnProperty('schema')) {
            return {
                cody: `Missing metadata schema of document ${document.getName()}`,
                type: CodyResponseType.Error
            }
        }

        schema = rawMeta.schema as JSONSchema;

        namespace = detectVoNamespace(rawMeta, document);

        if(isCodyError(namespace)) {
            return namespace;
        }

        if(rawMeta.shorthand) {
            const schemaConversion = typeof schema === "string"? convertShorthandStringToJsonSchema(schema, namespace) : convertShorthandObjectToJsonSchema(schema, namespace);

            if(isCodyError(schemaConversion)) {
                return schemaConversion;
            }

            schema = schemaConversion;
        }

        if(typeof schema !== 'object') {
            return  {
                cody: `Expected metadata schema of document ${document.getName()} to be of type object, but got: ` + typeof rawMeta.schema,
                type: CodyResponseType.Error
            }
        }

        if(!schema.hasOwnProperty('title')) {
            schema.title = camelCaseToTitle(nodeNameToCamelCase(document.getName()));
        }

        if(rawMeta.hasOwnProperty('querySchema')) {
            if(typeof rawMeta.querySchema !== 'object') {
                return  {
                    cody: `Expected metadata querySchema of document ${document.getName()} to be of type object, but got: ` + typeof rawMeta.querySchema,
                    type: CodyResponseType.Error
                }
            }

            querySchema = rawMeta.querySchema;

            if(rawMeta.shorthand) {
                const schemaConversion = convertShorthandObjectToJsonSchema(querySchema, namespace);

                if(isCodyError(schemaConversion)) {
                    return schemaConversion;
                }

                querySchema = schemaConversion;
            }
        }

        if(rawMeta.hasOwnProperty('aggregateState')) {
            aggregateState = !!rawMeta.aggregateState;
        }

        const validateColumn = (col: UiSchemaTableColumn): true | CodyResponse => {
            if(typeof col === 'string') {
                return true;
            }

            if(typeof col !== "object") {
                return  {
                    cody: `Expected metadata uiSchema.table.columns of document ${document.getName()} to be a list of strings or objects, but got: ` + typeof col + ' for at least one column',
                    type: CodyResponseType.Error
                }
            }

            if(!col.hasOwnProperty('field')) {
                return  {
                    cody: `Missing "field" property in one of the columns of metadata uiSchema.table.columns of document ${document.getName()}`,
                    type: CodyResponseType.Error
                }
            }

            if(!col.hasOwnProperty('title')) {
                return  {
                    cody: `Missing "title" property in one of the columns of metadata uiSchema.table.columns of document ${document.getName()}`,
                    type: CodyResponseType.Error
                }
            }

            if(!col.hasOwnProperty('config')) {
                return  true;
            }

            if(typeof col.config !== "object") {
                return  {
                    cody: `Expected metadata uiSchema.table.columns.$.config of document ${document.getName()} to be of type object, but got: ` + typeof col.config + ' for at least one column',
                    type: CodyResponseType.Error
                }
            }

            if(!col.config.hasOwnProperty('type')) {
                return  {
                    cody: `Missing "type" property in one of the column configs of metadata uiSchema.table.columns of document ${document.getName()}`,
                    type: CodyResponseType.Error
                }
            }

            switch (col.config.type) {
                case ColumnType.linearProgress:
                    return true;
                case ColumnType.relation:
                    if(!col.config.hasOwnProperty('data')) {
                        return  {
                            cody: `Missing "data" property in one of the relation column configs of metadata uiSchema.table.columns of document ${document.getName()}`,
                            type: CodyResponseType.Error
                        }
                    }

                    if(!col.config.hasOwnProperty('targetPage')) {
                        return  {
                            cody: `Missing "targetPage" property in one of the relation column configs of metadata uiSchema.table.columns of document ${document.getName()}`,
                            type: CodyResponseType.Error
                        }
                    }

                    if(!col.config.hasOwnProperty('mapping')) {
                        return  {
                            cody: `Missing "mapping" property in one of the relation column configs of metadata uiSchema.table.columns of document ${document.getName()}`,
                            type: CodyResponseType.Error
                        }
                    }

                    if(!col.config.hasOwnProperty('display')) {
                        return  {
                            cody: `Missing "display" property in one of the relation column configs of metadata uiSchema.table.columns of document ${document.getName()}`,
                            type: CodyResponseType.Error
                        }
                    }

                    break;
                default:
                    // @ts-ignore
                    const type = col.config.type;
                    return  {
                        cody: `Unknown column config type "${type}" in one of the column configs of metadata uiSchema.table.columns of document ${document.getName()}`,
                        type: CodyResponseType.Error
                    }
            }

            return true;
        }

        if(rawMeta.hasOwnProperty('uiSchema')) {
            uiSchema = rawMeta.uiSchema;

            if(uiSchema && uiSchema.hasOwnProperty('table') && uiSchema.table.hasOwnProperty('columns')) {
                const columns = uiSchema.table.columns;

                for(const col of columns) {
                    const validationResult = validateColumn(col);

                    if(isCodyError(validationResult)) {
                        return validationResult;
                    }
                }
            }
        }
    }

    return {
        schema: mapPropertiesToTitles(schema),
        querySchema,
        uiSchema,
        aggregateState,
        namespace,
    }
}

type ProjSuccess = ProjectionMetadata;
type ProjError = CodyResponse;

export const extractProjectionMetadata = (policy: Node): ProjSuccess | ProjError => {
    const [rawMeta, codyErrRes] = parseJsonMetadata<Partial<ProjectionMetadata>>(policy);

    if(codyErrRes) {
        return codyErrRes;
    }

    if(typeof rawMeta !== 'object') {
        return {
            cody: `I expected metadata of policy "${policy.getName()}" to be an object, but it is of type: ` + typeof rawMeta,
            type: CodyResponseType.Error
        };
    }

    let streams: string[] = [];
    let targetCollection = '';

    if(rawMeta !== null) {
        if(!rawMeta.hasOwnProperty('targetCollection')) {
            return {
                cody: `Missing metadata targetCollection of policy ${policy.getName()}`,
                type: CodyResponseType.Error
            }
        }

        targetCollection = rawMeta.targetCollection as string;

        if(rawMeta.hasOwnProperty('streams') && Array.isArray(rawMeta.streams)) {
            for(const stream of rawMeta.streams) {
                if(typeof stream !== "string") {
                    return {
                        cody: `I expect policy ${policy.getName()} metadata "streams" to be an array of strings, but it contains a ` + typeof stream,
                        type: CodyResponseType.Error
                    }
                }
            }

            streams = rawMeta.streams;
        }
    }

    return {
        streams,
        targetCollection
    }
}

type SagaSuccess = SagaMetadata;
type SagaError = CodyResponse;

export const extractSagaMetadata = (policy: Node): SagaSuccess | SagaError => {
    const [rawMeta, codyErrRes] = parseJsonMetadata<Partial<SagaMetadata>>(policy);

    if(codyErrRes) {
        return codyErrRes;
    }

    if(typeof rawMeta !== 'object') {
        return {
            cody: `I expected metadata of policy "${policy.getName()}" to be an object, but it is of type: ` + typeof rawMeta,
            type: CodyResponseType.Error
        };
    }

    let streams: string[] = [];

    if(rawMeta !== null) {
        if(rawMeta.hasOwnProperty('streams') && Array.isArray(rawMeta.streams)) {
            for(const stream of rawMeta.streams) {
                if(typeof stream !== "string") {
                    return {
                        cody: `I expect policy ${policy.getName()} metadata "streams" to be an array of strings, but it contains a ` + typeof stream,
                        type: CodyResponseType.Error
                    }
                }
            }

            streams = rawMeta.streams;
        }
    }

    return {
        streams
    }
}

type UiSuccess = UiMetadata;
type UiError = CodyResponse;

export const extractUiMetadata = (ui: Node): UiSuccess | UiError => {
    const [rawMeta, codyErrRes] = parseJsonMetadata<Partial<UiMetadata>>(ui);

    if(codyErrRes) {
        return codyErrRes;
    }

    if(typeof rawMeta !== 'object') {
        return {
            cody: `I expected metadata of UI "${ui.getName()}" to be an object, but it is of type: ` + typeof rawMeta,
            type: CodyResponseType.Error
        };
    }

    let route = '/' + nodeNameToSnakeCase(ui).split('_').join('-');
    let menuLabel = ui.getName();
    let breadcrumbLabel = ui.getName();
    let menuIcon = 'DataUsage';
    let topLevel = false;
    let routeParams: UiRouteParams = [];

    if(rawMeta !== null) {
        if(rawMeta.route && typeof rawMeta.route === 'string') {
            route = rawMeta.route;

            if(route[0] !== '/') {
                route = '/' + route;
            }
        }

        if(rawMeta.menuIcon && typeof rawMeta.menuIcon === 'string') {
            menuIcon = rawMeta.menuIcon;
        }

        if(rawMeta.menuLabel && typeof rawMeta.menuLabel === 'string') {
            menuLabel = rawMeta.menuLabel;
        }

        if(rawMeta.breadcrumbLabel && typeof rawMeta.breadcrumbLabel === 'string') {
            breadcrumbLabel = rawMeta.breadcrumbLabel;
        }

        if(rawMeta.topLevel) {
            topLevel = true;
        }

        if(rawMeta.routeParams) {
            if(!Array.isArray(rawMeta.routeParams)) {
                return {
                    cody: `Metadata key "routeParams" of UI card "${ui.getName()}" shall be an array, but got type: ` + typeof rawMeta.routeParams,
                    type: CodyResponseType.Error
                }
            }

            for(const param of rawMeta.routeParams) {
                const codyErrMsg = `Metadata key "routeParams" of UI card "${ui.getName()}" shall only contain strings or objects of type {name: string, type: string}, but I found the type: ` + typeof param;
                if(typeof param !== "string" && typeof param !== 'object') {
                    return {
                        cody: codyErrMsg,
                        type: CodyResponseType.Error
                    }
                }

                if(typeof param === 'object') {
                    if(!Object.keys(param).includes('name') || !Object.keys(param).includes('type')) {
                        return {
                            cody: codyErrMsg,
                            type: CodyResponseType.Error
                        }
                    }

                    if(typeof param.name !== 'string' || typeof param.type !== 'string') {
                        return {
                            cody: codyErrMsg,
                            type: CodyResponseType.Error
                        }
                    }
                }
            }

            routeParams = rawMeta.routeParams.map(param => typeof param === 'string'? {name: param, type: 'string'} : param);
        }
    }

    return {
        route,
        menuIcon,
        menuLabel,
        breadcrumbLabel,
        topLevel,
        routeParams,
    }
}
