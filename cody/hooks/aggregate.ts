import { CodyHook } from '../src/board/code';
import { Context } from './context';
import { CodyResponse, isCodyError } from '../src/general/response';
import { Node } from '../src/board/graph';
import { loadResolveConfig, upsertAggregateConfig } from './utils/config';
import { extractAggregateMetadata } from './utils/metadata';
import fs from 'fs';
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

    const arDir = await createAggregateModuleIfNotExists(aggregate, ctx, true);

    if(isCodyError(arDir)) {
        return arDir;
    }

    const configErr = upsertAggregateConfig(aggregate.getLink(), metadata, resolveConfig, ctx);

    if(isCodyError(configErr)) {
        return configErr;
    }

    successDetails = successDetails + `✔️ Aggregate module ${arDir} prepared\n`;

    return {
        cody: `"${aggregate.getName()}" is add to the app.`,
        details: ['%c'+successDetails, 'color: #73dd8e;font-weight: bold'],
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
            const riErr = writeFileSync(dir + '/index.ts', `export {}`);

            if(riErr) {
                return riErr;
            }
        }
    }

    if(!fs.existsSync(aggregateDir + '/index.ts')) {
        const riErr = writeFileSync(
            aggregateDir + '/index.ts',
            `import * as Reducers from './reducers'
import * as Handlers from './handlers'
import * as Events from './events'
import * as Commands from './commands'

export {
    Reducers,
    Handlers,
    Events,
    Commands
}`
        );

        if(riErr) {
            return riErr;
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
// export {
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
