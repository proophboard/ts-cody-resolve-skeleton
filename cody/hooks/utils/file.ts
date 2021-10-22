import { CodyResponse, CodyResponseType, isCodyError } from '../../src/general/response';
import fs from 'fs';
import { Node, NodeType } from '../../src/board/graph';
import { ResolveConfig } from '../types';
import { Context } from '../context';
import { writeFileSync } from '../../src/utils/filesystem';
import { COMPILE_OPTIONS } from './jsonschema';

export interface FileDescription {
    content: string;
    filePath: string;
    description: string;
    successMessage: string;
    node: Node;
}

export function readFile(filePath: string): string | CodyResponse {
    if (!fs.existsSync(filePath)) {
        return {
            cody: `File ${filePath} not found`,
            type: CodyResponseType.Error,
        };
    }

    return fs.readFileSync(filePath).toString();
}

export function writeFile(filePath: string, content: string): void {
    fs.writeFileSync(filePath, content);
}


export function readFileToJson<T>(filePath: string, validate?: (jsonContent: T) => T | CodyResponse): T | CodyResponse {
    if (!fs.existsSync(filePath)) {
        return {
            cody: `File ${filePath} not found`,
            type: CodyResponseType.Error,
        };
    }

    if (!validate) {
        validate = jsonContent => jsonContent;
    }

    const content = fs.readFileSync(filePath);

    try {
        return validate(JSON.parse(content.toString()));
    } catch (e) {
        return {
            cody: `Failed to parse file ${filePath}. It contains invalid JSON`,
            details: e.toString(),
            type: CodyResponseType.Error,
        };
    }
}


export const shouldIgnoreFile = (filePath: string): boolean => {
    if (!fs.existsSync(filePath)) {
        return false;
    }

    return fs.readFileSync(filePath).includes('// @cody-ignore');
};


export const refreshIndexFile = (
    config: ResolveConfig,
    ctx: Context,
    type: 'command' | 'event' | 'commandHandler',
    aggregateDir: string,
): CodyResponse | null => {
    let importString = '';
    let exportString = '';
    let list;
    let file = aggregateDir;
    let suffix = '';

    switch (type) {
        case 'command':
            list = Object.keys(config.commands);
            file += '/commands/index.ts';
            break;
        case 'event':
            list = Object.keys(config.events);
            file += '/events/index.ts';
            break;
        case 'commandHandler':
            list = Object.keys(config.commands);
            file += '/handlers/index.ts';
            suffix = 'Handler';
            break;
        default:
            return null;
    }

    for (const name of list) {
        importString = importString + `import * as ${name + suffix} from "./${name + suffix}";\n`;
        exportString = exportString + `    ${name + suffix},\n`;
    }

    const content = `${COMPILE_OPTIONS.bannerComment}
${importString}

export {
    ${exportString}
}
`;

    return writeFileSync(file, content);
};
