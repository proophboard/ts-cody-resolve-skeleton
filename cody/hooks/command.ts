import {Node, NodeType} from "../src/board/graph";
import {Context} from "./context";
import {CodyHook} from "../src/board/code";
import {CodyResponse, CodyResponseType, isCodyError} from "../src/general/response";

export const onCommandHook: CodyHook<Context> = async (command: Node, ctx: Context): Promise<CodyResponse> => {

    let successDetails = 'Checklist\n\n';

    return {
        cody: [`%cI'm skipping "${command.getName()}" due missing implementation.`, 'color: #fb9f4b; font-weight: bold'],
        details: [`%cIf you want me to handle ${command.getName()}, implement the desired code please.`, 'color: #414141', 'background-color: rgba(251, 159, 75, 0.2)', 'color: #414141'],
        type: CodyResponseType.Info
    }
}
