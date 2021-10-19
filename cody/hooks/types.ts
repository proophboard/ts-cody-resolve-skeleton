import {UiSchema} from "@rjsf/core";
import { UiRouteParams } from './utils/metadata';

export type JSONSchema = any;


export interface ResolveConfig {
    aggregates: {
        [aggregateType: string]: {
            aggregateType: string,
            aggregateIdentifier: string,
            eventMapLink: string,
            eventStream: string,
            aggregateCollection: string,
            multiStoreMode: 'mode_e_s' | 'mode_e' | 'mode_s',
            events: string[],
            relations?: {[property: string]: string}
        }
    },
    commands: {
        [commandName: string]: {
            commandName: string;
            aggregateType: string;
            eventMapLink: string;
            createAggregate: boolean;
            schema: JSONSchema;
        }
    },
    events: {
        [eventName: string]: {
            eventName: string;
            aggregateType?: string;
            stream?: string;
            eventMapLink: string;
            public: boolean;
            schema: JSONSchema;
        }
    },
    queries: {
        [queryName: string]: {
            queryName: string;
            schema: JSONSchema;
            returnType: JSONSchema;
            eventMapLink: string;
        }
    },
    sagas: string[],
    reducers: string[],
    pages: {
        [route: string]: {
            component: string,
            topLevel: boolean,
            icon?: string,
            menuLabel?: string,
            breadcrumbLabel?: string,
            routeParams?: UiRouteParams,
        }
    }
}

export interface SchemaDefinitions {
    sourceMap: {
        [defName: string]: string,
    },
    definitions: {
        [defName: string]: JSONSchema
    }
}

export interface CommandDescription {
    commandName: string;
    aggregateType: string|null;
    aggregateIdentifier: string|null;
    createAggregate: boolean;
    schema: JSONSchema;
    eventMapLink?: string;
    uiSchema?: UiSchema;
}

export interface StateDescription {
    stateName: string;
    stateIdentifier: string;
    schema: JSONSchema;
    eventMapLink?: string;
    uiSchema?: UiSchema;
}

export interface State {[prop: string]: any}
