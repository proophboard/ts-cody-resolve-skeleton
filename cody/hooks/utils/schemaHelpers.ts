import {EngineConfig, JSONSchema, SchemaDefinitions} from "../types";
import {aggregateStateName} from "./naming";
import {nodeNameToPascalCase} from "../../src/utils/string";
import {Node} from "../../src/board/graph";
import {parseJsonMetadata} from "../../src/utils/metadata";
import {CodyResponse, isCodyError} from "../../src/general/response";
import {isRootNamespace} from "./jsonschema";

export const aggregateIdentifier = (aggregateType: string, config: EngineConfig): string | null => {
    if (config.aggregates[aggregateType]) {
        return config.aggregates[aggregateType].aggregateIdentifier;
    }

    return null;
}

export const aggregateIdentifierType = (aggregateType: string, identifier: string, defs: SchemaDefinitions, defaultType = 'string'): string => {
    const arStateName = aggregateStateName(aggregateType);

    if(defs.definitions[arStateName]
        && defs.definitions[arStateName].properties
        && defs.definitions[arStateName].properties[identifier]) {
        return defs.definitions[arStateName].properties[identifier].type || defaultType;
    }

    return defaultType;
}

export const aggregateIdentifierForCommand = (command: Node, config: EngineConfig, defs: SchemaDefinitions): string | null => {
    const cmdName = nodeNameToPascalCase(command);

    if(config.commands[cmdName]) {
        const arType = config.commands[cmdName].aggregateType;
        return aggregateIdentifier(arType, config);
    }

    return null;
}

export const aggregateTypeForCommand = (command: Node, config: EngineConfig, defs: SchemaDefinitions): string | null => {
    const cmdName = nodeNameToPascalCase(command);

    if(config.commands[cmdName]) {
        return config.commands[cmdName].aggregateType;
    }

    return null;
}

export const queryPropertyType = (queryName: string, property: string, config: EngineConfig): string => {
    if(!config.queries.hasOwnProperty(queryName)) {
        return 'string'
    }

    if(!config.queries[queryName].schema.properties.hasOwnProperty(property)) {
        return 'string'
    }

    return config.queries[queryName].schema.properties[property].type || 'string';
}

export const camelCaseToTitle = (str: string): string => {
    str = str.replace(/([A-Z](?=[A-Z][a-z])|[^A-Z](?=[A-Z])|[a-zA-Z](?=[^a-zA-Z]))/g, '$1 ');
    return str.charAt(0).toUpperCase() + str.slice(1);
}

const matchTemplateString = (str: string) => {
    return str.match(/^{{(?<value>.+)}}$/);
}

export const isTemplateString = (str: string): boolean => {
    return !!matchTemplateString(str);
}

export const extractTemplateValue = (str: string): string | null => {
    const match = matchTemplateString(str);

    if(!match) {
        return null;
    }

    return match.groups!.value;
}

interface ParentMeta {
    voNamespace?: string;
}

export const detectVoNamespace = (nodeMeta: {ns?: string, namespace?: string}, node: Node): string | CodyResponse => {
    return nodeMeta.ns || nodeMeta.namespace || '/';
}


export const definitionsContainReference = (ref: string, defs: SchemaDefinitions): boolean => {
    if(ref.length === 0) {
        return false;
    }

    if(ref.charAt(0) === '/') {
        ref = ref.slice(1);
    }

    const refPath = ref.split("/");
    let defDefinitions = defs.definitions;
    let pathFound = true;

    refPath.forEach(pathPart => {
        if(!defDefinitions.hasOwnProperty(pathPart)) {
            pathFound = false;
            return false;
        }

        defDefinitions = defDefinitions[pathPart];
    })

    return pathFound;
}

export const getSchemaFromDefinitions = (def: string, defs: SchemaDefinitions): JSONSchema | null => {
    if(def.length === 0) {
        return null;
    }

    if(def.charAt(0) === '/') {
        def = def.slice(1);
    }

    const refPath = def.split("/");
    let defDefinitions = defs.definitions;
    let pathFound = true;

    refPath.forEach(pathPart => {
        if(!defDefinitions.hasOwnProperty(pathPart)) {
            pathFound = false;
            return false;
        }

        defDefinitions = defDefinitions[pathPart];
    })

    if(pathFound) {
        return JSON.parse(JSON.stringify(defDefinitions));
    }

    return null;
}
