import fs from "fs";
import {CodyHook} from "../src/board/code";
import {Node, NodeType} from "../src/board/graph";
import {CodyResponse, CodyResponseType, isCodyError} from "../src/general/response";
import {Context} from "./context";

export const onDocumentHook: CodyHook<Context> = async (document: Node, ctx: Context): Promise<CodyResponse> => {
    let successDetails = 'Checklist\n\n';

    return {
        cody: [`%cI'm skipping "${document.getName()}" due missing implementation.`, 'color: #fb9f4b; font-weight: bold'],
        details: [`%cIf you want me to handle ${document.getName()}, implement the desired code please.`, 'color: #414141', 'background-color: rgba(251, 159, 75, 0.2)', 'color: #414141'],
        type: CodyResponseType.Info
    }
}
