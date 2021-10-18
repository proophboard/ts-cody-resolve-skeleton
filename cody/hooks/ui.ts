import {CodyHook} from "../src/board/code";
import {Node, NodeType} from "../src/board/graph";
import {CodyResponse, CodyResponseType, isCodyError, isCodyWarning} from "../src/general/response";
import {Context} from "./context";

export const onUiHook: CodyHook<Context> = async (ui: Node, ctx: Context): Promise<CodyResponse> => {
    let successDetails = 'Checklist\n\n';

    return {
        cody: [`%cI'm skipping "${ui.getName()}" due missing implementation.`, 'color: #fb9f4b; font-weight: bold'],
        details: [`%cIf you want me to handle ${ui.getName()}, implement the desired code please.`, 'color: #414141', 'background-color: rgba(251, 159, 75, 0.2)', 'color: #414141'],
        type: CodyResponseType.Info
    }
}
