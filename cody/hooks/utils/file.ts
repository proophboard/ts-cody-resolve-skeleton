import {CodyResponse, CodyResponseType, isCodyError} from "../../src/general/response";
import fs from "fs";
import {Node} from "../../src/board/graph";

export interface FileDescription {
    content: string;
    filePath: string;
    description: string;
    successMessage: string;
    node: Node;
}

export function readFile(filePath: string): string | CodyResponse {
    if(!fs.existsSync(filePath)) {
        return {
            cody: `File ${filePath} not found`,
            type: CodyResponseType.Error
        }
    }

    return fs.readFileSync(filePath).toString();
}

export function writeFile(filePath: string, content: string): void {
    fs.writeFileSync(filePath, content);
}


export function readFileToJson<T>(filePath: string, validate?: (jsonContent: T) => T | CodyResponse): T | CodyResponse {
    if(!fs.existsSync(filePath)) {
        return {
            cody: `File ${filePath} not found`,
            type: CodyResponseType.Error
        }
    }

    if(!validate) {
        validate = jsonContent => jsonContent;
    }

    const content = fs.readFileSync(filePath);

    try {
        return validate(JSON.parse(content.toString()));
    } catch (e) {
        return {
            cody: `Failed to parse file ${filePath}. It contains invalid JSON`,
            details: e.toString(),
            type: CodyResponseType.Error
        }
    }
}
