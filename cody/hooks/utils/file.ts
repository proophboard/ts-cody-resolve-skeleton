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
