import {compile, JSONSchema} from "json-schema-to-typescript";
import * as _ from "lodash";
import path from "path";
import {CodyResponse, CodyResponseType, isCodyError} from "../../src/general/response";
import {SchemaDefinitions} from "../types";
import $RefParser from "@apidevtools/json-schema-ref-parser";
import {snakeCaseToCamelCase} from "../../src/utils/string";
import {camelCaseToTitle, definitionsContainReference, getSchemaFromDefinitions} from "./schemaHelpers";

export const COMPILE_OPTIONS = {
    style: {tabWidth: 4},
    bannerComment: `/* tslint:disable */
/**
 * This file was automatically generated by proophboard/Cody.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source element on your prooph board,
 * and let Cody generate the file again.
 */`
}

export const compileSchema =  async (schema: JSONSchema, schemaName: string, sourcePath: string, defs: SchemaDefinitions, additionalContent: string = ''): Promise<string> => {
    schema = _.clone(schema);


    if(schema.hasOwnProperty('type') && (schema.type === 'array')) {
        const itemSchema = await compileSchema(schema.items as JSONSchema, schemaName + 'Item', sourcePath, defs, additionalContent);

        return `${itemSchema}        
export type ${schemaName} = ${schemaName}Item[];        
        `;
    }

    schema.definitions = defs.definitions;

    if(schema.hasOwnProperty('$ref')) {
        const ref = schema['$ref'] as string;
        const refName = ref.replace('#/definitions/', '');

        if(!defs.sourceMap.hasOwnProperty('/' + refName)) {
            throw new Error(`Cannot find reference ${ref} in sourceMap of schema-definitions.json`);
        }

        if(!definitionsContainReference(refName, defs)) {
            throw new Error(`Cannot find reference ${ref} in schema-definitions.json`);
        }

        const refSource = defs.sourceMap['/'+refName];
        const importPath = relativeImportPath(sourcePath, refSource);

        return `${COMPILE_OPTIONS.bannerComment}

import {${removeNamespace(refName)}} from "${importPath}";

export type ${schemaName} = ${removeNamespace(refName)}; 

${additionalContent}
`.replace(/[\n]+$/, '\n');
    }

    const compiledContent = await compile(schema, schemaName, {...COMPILE_OPTIONS, bannerComment: COMPILE_OPTIONS.bannerComment});

    return (replaceRefsWithImports(compiledContent, sourcePath, schema, defs) + `\n${additionalContent}\n`).replace(/[\n]+$/, '\n');
}

const isRef = (ref: string, schema: JSONSchema): boolean => {
    // This check is important in case title matches a potential value object, but schema does not reference the VO
    if(schema.title && schema.title.replace(" ", "") === ref) {
        return schema.hasOwnProperty('$ref');
    }

    if(schema.type === "object" && schema.properties) {
        for(const prop of Object.keys(schema.properties)) {
            if(!isRef(ref, schema.properties[prop])) {
                return false
            }
        }
    }

    if(schema.type === "array" && schema.items) {
        if(!isRef(ref, schema.items)) {
            return false;
        }
    }

    return true;
}

const replaceRefsWithImports = (content: string, sourcePath: string, schema: JSONSchema, defs: SchemaDefinitions): string => {
    const parts = content.split('\nexport ');

    const filteredParts: string[] = [];
    let imports = '';

    for(const part of parts) {
        const matchRes = part.match(/^([\s]+)?(interface|type) ([^\s]+) /);

        if(!matchRes) {
            filteredParts.push(part);
            continue;
        }

        const ref = matchRes[3];

        if(defs.sourceMap.hasOwnProperty(ref) && isRef(ref, schema)) {
            const refSource = defs.sourceMap[ref];

            if(refSource === sourcePath) {
                filteredParts.push(part);
                continue;
            }

            const importPath = relativeImportPath(sourcePath, refSource);

            imports = imports + `import {${removeNamespace(ref)}} from "${importPath}";\n`;
        } else {
            filteredParts.push(part);
        }
    }

    if(filteredParts.length) {
        filteredParts[0] = filteredParts[0] + `\n${imports}`;

        return filteredParts.join('\nexport ');
    }

    return content;
}

export const NAMESPACE = "namespace";

export const removeNamespace = (ref: string): string => {
    const refParts = ref.split("/");

    return refParts[refParts.length - 1];
}

export const isRootNamespace = (ref: string): boolean => {
    return ref.length > 0 && ref.charAt(0) === "/";
}

export interface ShorthandObject {[property: string]: ShorthandObject | string}

export const convertShorthandObjectToJsonSchema = (shorthand: ShorthandObject, namespace?: string): JSONSchema | CodyResponse => {
    const schema: JSONSchema = {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
    };

    if(typeof shorthand !== 'object') {
        return {
            cody: `I was not able to convert shorthand object: "${JSON.stringify(shorthand)}" to JSONSchema`,
            type: CodyResponseType.Error
        }
    }

    if(!namespace) {
        namespace = "/";
    }

    if(namespace.charAt(namespace.length - 1) !== "/") {
        namespace += "/";
    }

    for (const property in shorthand) {
        if(!shorthand.hasOwnProperty(property)) { continue; }

        if(property === '') {
            return {
                cody: `Shorthand object ${JSON.stringify(shorthand)} contains an empty property string. Can't deal with that.`,
                details: "Please remove it!",
                type: CodyResponseType.Error
            }
        }

        let schemaProperty = property;

        if(property.slice(-1) === '?') {
            schemaProperty = property.slice(0, property.length - 1);
        } else if (property === "$ref") {
            if(Object.keys(shorthand).length > 1) {
                return {
                    cody: `Shorthand ${JSON.stringify(shorthand)} contains a top level ref property "$ref", but it is not the only property!`,
                    details: 'A top level reference cannot have other properties then "$ref".',
                    type: CodyResponseType.Error
                }
            }

            const reference = (shorthand[schemaProperty] as string).replace('#/definitions', '');

            if(isRootNamespace(reference)) {
                return {
                    "$ref": `#/definitions${reference}`
                };
            }

            return {
                "$ref": `#/definitions${namespace}${reference}`
            };
        } else if (property === '$items') {
            if(typeof shorthand[schemaProperty] !== 'string') {
                return {
                    cody: `Detected a top level shorthand array using an "$items" prop, but the value of the property is not a string.`,
                    details: "It is of type " + typeof shorthand[schemaProperty],
                    type: CodyResponseType.Error
                }
            }

            if(Object.keys(shorthand).length > 1) {
                // Allow title as the only alternative property
                if(!Object.keys(shorthand).includes('$title')) {
                    return {
                        cody: `Shorthand ${JSON.stringify(shorthand)} contains a top level array property "$items", but it is not the only property!`,
                        details: 'A top level array cannot have other properties then "$items".',
                        type: CodyResponseType.Error
                    }
                }
            }

            let itemsShorthandSchema = shorthand[schemaProperty] as string;

            if(itemsShorthandSchema.slice(-2) !== '[]') {
                itemsShorthandSchema = itemsShorthandSchema + '[]';
            }

            const arraySchema = convertShorthandStringToJsonSchema(itemsShorthandSchema, namespace);

            if(!isCodyError(arraySchema) && Object.keys(shorthand).includes('$title')) {
                arraySchema.title = shorthand['$title'] as string;
            }

            return arraySchema;
        } else if (schemaProperty === '$title') {
            schema.title = shorthand[property] as string;
            delete shorthand[property];
            continue;
        } else {
            if(schema.required) {
                schema.required.push(property);
            }
        }

        if(typeof shorthand[property] === "object") {
            const propertySchemaObj = convertShorthandObjectToJsonSchema(shorthand[property] as ShorthandObject, namespace);

            if(isCodyError(propertySchemaObj)) {
                return propertySchemaObj;
            }

            schema.properties![schemaProperty] = propertySchemaObj;
        } else if(typeof shorthand[property] === "string") {
            const propertySchema = convertShorthandStringToJsonSchema(shorthand[property] as string, namespace);

            if(isCodyError(propertySchema)) {
                return propertySchema;
            }

            schema.properties![schemaProperty] = propertySchema;
        } else {
            return {
                cody: `I tried to parse JSONSchema for property: "${ property }", but it is neither a string nor an object.`,
                details: "Can you check that please?!",
                type: CodyResponseType.Error
            }
        }
    }

    return schema;
}

export const convertShorthandStringToJsonSchema = (shorthand: string, namespace: string): JSONSchema | CodyResponse => {
    if(shorthand === '') {
        return {type: "string"}
    }

    if(namespace === "") {
        namespace = "/";
    }

    if(namespace.charAt(namespace.length - 1) !== "/") {
        namespace += "/";
    }

    const parts = shorthand.split('|');

    if(parts[0].match(/^enum:/)) {
        const enumVals = parts[0].replace('enum:', '');
        return {
            enum: enumVals.split(',').map(val => val.trim()),
        }
    }

    if(parts[0].slice(-2) === '[]') {
        const itemsParts = [parts[0].replace('[]', '')];
        itemsParts.push(...parts.slice(1));

        const itemsSchema = convertShorthandStringToJsonSchema(itemsParts.join('|'), namespace);

        if(isCodyError(itemsSchema)) {
            return itemsSchema;
        }

        return {
            type: "array",
            items: itemsSchema
        }
    }

    switch (parts[0]) {
        case 'string':
        case 'integer':
        case 'number':
        case 'boolean':
            let type: string | string[] = parts[0];

            if(parts[1] && parts[1] === 'null') {
                type = [type as string, 'null'];
                parts.splice(1,1);
            }

            const schema: {[schemaProp: string]: string | boolean | number | string[]} = {
                type,
            };

            if(parts.length > 1) {
                for (const part of parts.slice(1)) {
                    const validation = parseShorthandValidation(part);

                    if(isCodyError(validation)) {
                        return validation;
                    }

                    schema[validation[0]] = validation[1];
                }
            }

            return schema;
        default:
            let ref = parts[0];
            const schemaProps: {[name: string]: any} = {};

            if(parts.length > 1) {
                const valParts = parts.filter((item, i) => i > 0);

                for (const valPart of valParts) {
                    const validation = parseShorthandValidation(valPart);

                    if (isCodyError(validation)) {
                        return validation;
                    }

                    const [prop, val] = validation;

                    schemaProps[prop] = val;
                }
            }

            if(!isRootNamespace(ref) && schemaProps.hasOwnProperty(NAMESPACE)) {
                ref = schemaProps[NAMESPACE] + '/' + ref;
            }

            if (schemaProps.hasOwnProperty(NAMESPACE)) {
                delete schemaProps[NAMESPACE];
            }

            if(isRootNamespace(ref)) {
                return {
                    "$ref": `#/definitions${ref}`,
                    ...schemaProps
                };
            }

            return {
                "$ref": `#/definitions${namespace}${ref}`,
                ...schemaProps
            }
    }
}

export const parseShorthandValidation = (validation: string): [string, string | number | boolean] | CodyResponse => {
    const parts = validation.split(':');

    if(parts.length !== 2) {
        return {
            cody: `Can't parse shorthand validation: "${validation}". Expected format "validationKey:value". Please check again!`,
            type: CodyResponseType.Error
        }
    }

    const [validationKey, value] = parts;

    if(value === 'true') {
        return [validationKey, true];
    }

    if(value === 'false') {
        return [validationKey, false];
    }

    if(parseInt(value, 10).toString() === value) {
        return [validationKey, parseInt(value, 10)];
    }

    if(parseFloat(value).toString() === value) {
        return [validationKey, parseFloat(value)];
    }

    if(validationKey === "ns") {
        return [NAMESPACE, value];
    }

    return [validationKey, value];
}

export const dereferenceSchema = async (schema: JSONSchema, defs: SchemaDefinitions): Promise<JSONSchema> => {
    if(schema['$ref']) {
        const ref: string = schema['$ref'];
        const subSchemaName = ref.replace('#/definitions/', '');
        if(definitionsContainReference(subSchemaName, defs)) {
            const tmpSubSchema = getSchemaFromDefinitions(subSchemaName, defs);

            if(tmpSubSchema) {
                const subSchema = await dereferenceSchema(tmpSubSchema, defs);
                const orgCopy = {...schema};
                delete orgCopy['$ref'];

                return {...subSchema, ...orgCopy};
            }
        }
    }

    const schemaCopy = {...schema, definitions: defs.definitions};

    const unreferencedSchema = await $RefParser.dereference(schemaCopy);

    delete unreferencedSchema.definitions;

    return unreferencedSchema as JSONSchema;
}

export const relativeImportPath = (sourcePath: string, refSource: string): string => {
    let importPath = path.relative(sourcePath.replace(/\/[^\/]+\.ts$/, ''), refSource).replace(/\.ts$/, '');

    const importPathParts = importPath.split('/');

    if(importPathParts.length === 1) {
        importPath = `./${importPathParts[0]}`;
    }

    return importPath;
}

export const isArrayType = (def: string, defs: SchemaDefinitions): boolean => {
    if(!definitionsContainReference(def, defs)) {
        return false;
    }

    const schema = getSchemaFromDefinitions(def, defs);

    if(!schema) {
        return false;
    }

    if(!schema.hasOwnProperty('type')) {
        return false;
    }

    return schema.type === 'array';
}

export const isStateType = async (def: string, defs: SchemaDefinitions): Promise<boolean> => {
    if(!definitionsContainReference(def, defs)) {
        return false;
    }

    const tmpSchema = getSchemaFromDefinitions(def, defs);

    if(!tmpSchema) {
        return false;
    }

    const schema = await dereferenceSchema(tmpSchema, defs);

    if(!schema.hasOwnProperty('type')) {
        return false;
    }

    return schema.type === 'object';
}

export const mapPropertiesToTitles = (schema: JSONSchema, property?: string): JSONSchema => {
    const schemaCopy = JSON.parse(JSON.stringify(schema));

    if(property && !schema.title) {
        schemaCopy.title = camelCaseToTitle(snakeCaseToCamelCase(property));
    }

    if(schema.type && schema.type === 'object' && schema.properties) {
        Object.keys(schema.properties).forEach(key => {
            const propSchema = schema.properties![key];
            schemaCopy.properties[key] = mapPropertiesToTitles(propSchema, key);
        })
    }

    if(schema.type && schema.type === 'array' && schema.items) {
        schemaCopy.items = mapPropertiesToTitles(schema.items);
    }

    return schemaCopy;
}