import {CodyHook} from "../src/board/code";
import {Context} from "./context";
import {CodyResponse, CodyResponseType, isCodyError} from "../src/general/response";
import {Node} from "../src/board/graph";
import { loadResolveConfig, upsertAggregateConfig } from './utils/config';
import { extractAggregateMetadata } from './utils/metadata';
import fs  from 'fs';
import { nodeNameToPascalCase } from '../src/utils/string';
import { mkdirIfNotExistsSync, writeFileSync } from '../src/utils/filesystem';

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


type Success = string;
type Error = CodyResponse;

export const createAggregateModuleIfNotExists = async (aggregate: Node, ctx: Context, updateStateFile: boolean = false): Promise<Success | Error> => {
    const aggregateDir = ctx.feFolder + '/common/aggregates/' + nodeNameToPascalCase(aggregate);
    const metadata = extractAggregateMetadata(aggregate);

    if(isCodyError(metadata)) {
        return metadata;
    }

    const arDirErr = mkdirIfNotExistsSync(aggregateDir);
    if(arDirErr) {
        return arDirErr;
    }

    const subDirs = ['/commands', '/events', '/handlers', '/reducers'];

    for(let dir of subDirs) {
        dir = aggregateDir + dir;
        const dirErr = mkdirIfNotExistsSync(dir);
        if(dirErr) {
            return dirErr;
        }

        if(!fs.existsSync(dir + '/index.ts')) {
            const riErr = writeFileSync(dir + '/index.ts', `export default {}`);

            if(riErr) {
                return riErr;
            }
        }
    }

    const resolveConfig = loadResolveConfig(ctx);

    if(isCodyError(resolveConfig)) {
        return resolveConfig
    }

    const arConfigErr = upsertAggregateConfig(aggregate.getLink(), metadata, resolveConfig, ctx);

    if(isCodyError(arConfigErr)) {
        return arConfigErr;
    }

//     const aggregateTypes = Object.keys(resolveConfig.aggregates);
//     let importStr = '';
//     let exportStr = '';
//     for(const arType of aggregateTypes) {
//         importStr = importStr + `import ${arType}Handlers from './${arType}/handlers';\n`;
//         importStr = importStr + `import ${arType}Reducers from './${arType}/reducers';\n`;
//
//         exportStr = exportStr + `    ${arType}Handlers,\n`;
//         exportStr = exportStr + `    ${arType}Reducers,\n`;
//     }
//
//     const modelIndexContent = `${importStr}
// export default {
// ${exportStr}
// }
// `
//     const mIErr = writeFileSync(ctx.feFolder + '/model/index.ts', modelIndexContent);
//
//     if(mIErr) {
//         return mIErr;
//     }

    return aggregateDir;
}
