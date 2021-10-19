import {CodyHook} from "../src/board/code";
import {Context} from "./context";
import {CodyResponse, CodyResponseType, isCodyError} from "../src/general/response";
import {Node} from "../src/board/graph";
import { loadResolveConfig, upsertAggregateConfig } from './utils/config';
import { extractAggregateMetadata } from './utils/metadata';

export const onAggregateHook: CodyHook<Context> = async (aggregate: Node, ctx: Context): Promise<CodyResponse> => {

    const resolveConfig = loadResolveConfig(ctx);
    const metadata = extractAggregateMetadata(aggregate);

    if(isCodyError(metadata)) {
        return metadata;
    }

    if(isCodyError(resolveConfig)) {
        return resolveConfig
    }

    let successDetails = 'Checklist:\n\n';

    const configErr = upsertAggregateConfig(aggregate.getLink(), metadata, resolveConfig, ctx);

    if(isCodyError(configErr)) {
        return configErr;
    }

    return {
        cody: [`%cI'm skipping "${aggregate.getName()}" due missing implementation.`, 'color: #fb9f4b; font-weight: bold'],
        details: [`%cIf you want me to handle ${aggregate.getName()}, implement the desired code please.`, 'color: #414141', 'background-color: rgba(251, 159, 75, 0.2)', 'color: #414141'],
        type: CodyResponseType.Info
    }
}
