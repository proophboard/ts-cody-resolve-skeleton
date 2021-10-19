import {Node, NodeType} from "../src/board/graph";
import {Context} from "./context";
import {CodyHook} from "../src/board/code";
import {CodyResponse, CodyResponseType, isCodyError} from "../src/general/response";
import { extractCommandMetadata } from './utils/metadata';
import { loadResolveConfig, upsertCommandConfig } from './utils/config';
import { nodeNameToPascalCase } from '../src/utils/string';
import { getSingleTarget } from '../src/utils/node-traversing';

export const onCommandHook: CodyHook<Context> = async (command: Node, ctx: Context): Promise<CodyResponse> => {

    const cmdName = nodeNameToPascalCase(command);
    const metadata = extractCommandMetadata(command);
    const config = loadResolveConfig(ctx);

    if(isCodyError(metadata)) {
        return metadata;
    }

    if(isCodyError(config)) {
        return config;
    }

    const aggregate = getSingleTarget(command, NodeType.aggregate);
    if(isCodyError(aggregate)) {
        return aggregate;
    }
    const aggregateType = nodeNameToPascalCase(aggregate);

    const cmdConfigErr = upsertCommandConfig(cmdName, aggregateType, command.getLink(), metadata, config, ctx);

    if(isCodyError(cmdConfigErr)) {
        return cmdConfigErr;
    }

    let successDetails = 'Checklist\n\n';

    return {
        cody: [`%cI'm skipping "${command.getName()}" due missing implementation.`, 'color: #fb9f4b; font-weight: bold'],
        details: [`%cIf you want me to handle ${command.getName()}, implement the desired code please.`, 'color: #414141', 'background-color: rgba(251, 159, 75, 0.2)', 'color: #414141'],
        type: CodyResponseType.Info
    }
}
