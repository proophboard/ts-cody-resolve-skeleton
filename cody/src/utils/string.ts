import {camelize} from "tslint/lib/utils";
import {Node} from "../board/graph";
import {parseJsonMetadata} from "./metadata";
import {CodyResponse, isCodyError} from "../general/response";
import {extractDocumentMetadata} from "../../hooks/utils/metadata";

export const nodeNameToCamelCase = (node: Node | string): string => {
    const nodeName = typeof node === 'string'? node : node.getName();

    const name = camelize(nodeName.split(' ').join('-'));
    return name.charAt(0).toLowerCase() + name.slice(1);
}

export const nodeNameToPascalCase = (node: Node | string): string => {
    const nodeName = typeof node === 'string'? node : node.getName();

    const name = camelize(nodeName.split(' ').join('-'));
    return name.charAt(0).toUpperCase() + name.slice(1);
}

export const voNameWithNamespace = (document: Node): string | CodyResponse => {
    const voName = nodeNameToPascalCase(document);
    const metadata = extractDocumentMetadata(document);

    if(isCodyError(metadata)) {
        return metadata;
    }

    let namespace = metadata?.namespace || '/';

    if(namespace.charAt(0) !== "/") {
        namespace = "/" + namespace;
    }

    return  namespace.length === 1? '/' + voName : namespace + '/' + voName;
}

export const camelCaseToTitle = (str: string): string => {
    str = str.replace(/([A-Z](?=[A-Z][a-z])|[^A-Z](?=[A-Z])|[a-zA-Z](?=[^a-zA-Z]))/g, '$1 ');
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export const nodeNameToSnakeCase = (node: Node | string): string => {
    const nodeName = typeof node === 'string'? node : node.getName();

    if(nodeName === '') {
        return '';
    }

    let name = nodeName.split(' ').join('_').split('-').join('_');
    name = name[0].toLowerCase() + name.slice(1).replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    return name.split('__').join('_');
}

export const snakeCaseToCamelCase = (str: string): string => {
    if(str === '') {
        return str;
    }

    str = str.split('_').map(part => part.length > 0? part[0].toUpperCase() + part.slice(1) : '').join('');
    return str[0].toLowerCase() + str.slice(1);
}

export const lcWord = (word: string): string => {
    if(word.length === 0) {
        return word;
    }

    return word.charAt(0).toLowerCase()+word.slice(1);
}

export const ucWord = (word: string): string => {
    if(word.length === 0) {
        return word;
    }

    return word.charAt(0).toUpperCase()+word.slice(1);
}
