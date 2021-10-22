import { Node, NodeType } from '../src/board/graph';
import { Context } from './context';
import { CodyHook } from '../src/board/code';
import { CodyResponse, CodyResponseType, isCodyError } from '../src/general/response';
import { extractAggregateMetadata, extractCommandMetadata } from './utils/metadata';
import { loadResolveConfig, loadSchemaDefinitions, upsertCommandConfig } from './utils/config';
import { lcWord, nodeNameToConstName, nodeNameToPascalCase, nodeNameToSnakeCase } from '../src/utils/string';
import { getSingleTarget } from '../src/utils/node-traversing';
import { createAggregateModuleIfNotExists } from './aggregate';
import { writeFileSync } from '../src/utils/filesystem';
import { refreshIndexFile, shouldIgnoreFile } from './utils/file';
import { COMPILE_OPTIONS, compileSchema } from './utils/jsonschema';

export const onCommandHook: CodyHook<Context> = async (command: Node, ctx: Context): Promise<CodyResponse> => {

    const cmdName = nodeNameToPascalCase(command);
    const cmdHandlerName = cmdName + 'Handler';
    const cmdFilename = cmdName + '.ts';
    const metadata = extractCommandMetadata(command);
    const config = loadResolveConfig(ctx);
    const defs = loadSchemaDefinitions(ctx);

    if (isCodyError(metadata)) {
        return metadata;
    }

    if (isCodyError(config)) {
        return config;
    }

    if (isCodyError(defs)) {
        return defs;
    }

    const aggregate = getSingleTarget(command, NodeType.aggregate);

    if (isCodyError(aggregate)) {
        return aggregate;
    }

    const aggregateMetadata = extractAggregateMetadata(aggregate);
    if (isCodyError(aggregateMetadata)) {
        return aggregateMetadata;
    }

    const aggregateName = nodeNameToPascalCase(aggregate);
    const aggregateType = nodeNameToPascalCase(aggregate);

    const aggregateDir = await createAggregateModuleIfNotExists(aggregate, ctx);

    if (isCodyError(aggregateDir)) {
        return aggregateDir;
    }

    let successDetails = 'Checklist\n\n';

    const cmdDir = aggregateDir + '/commands';
    const cmdFile = cmdDir + `/${cmdFilename}`;

    try {
        // generate command
        const content = await compileSchema(metadata.schema, cmdName, cmdFile, defs, `export const ${nodeNameToSnakeCase(cmdName).toUpperCase()} = '${cmdName}'`);

        if (shouldIgnoreFile(cmdFile)) {
            successDetails = successDetails + `⏩️ Skipped ${cmdFile} due to // @cody-ignore\n`;
        } else {
            const writeFileErr = writeFileSync(cmdFile, content);

            if (writeFileErr) {
                return writeFileErr;
            }

            successDetails = successDetails + `✔️ Command file ${cmdFile} written\n`;
        }

        const cmdConfigErr = upsertCommandConfig(cmdName, aggregateType, command.getLink(), metadata, config, ctx);

        if (isCodyError(cmdConfigErr)) {
            return cmdConfigErr;
        }

        const refreshResult = refreshIndexFile(config, ctx, NodeType.command, aggregateDir);

        if (isCodyError(refreshResult)) {
            return refreshResult;
        }

        // generate command handler
        const payloadType = cmdName + '.' + cmdName;

        // const event = getSingleTargetFromSyncedNodes(aggregate, NodeType.event, ctx.syncedNodes);
        //
        // if (isCodyError(event)) {
        //     return event;
        // }
        const event = 'TODO';

        const evtName = nodeNameToPascalCase(event);
        const evtType = evtName + '.' + nodeNameToConstName(evtName);

        const commandHandlerContent = `${COMPILE_OPTIONS.bannerComment}
import { CommandHandler } from '@resolve-js/core';
import { AggregateState, Command, CommandResult } from '@resolve-js/core/types/types/core';
import {${cmdName}} from '../commands';
import {${evtName}} from '../events';
// @cody-ignore
export const commandHandler: CommandHandler = (state: AggregateState, command: Command & {payload: ${payloadType}}): CommandResult => {

    return {
        type: ${evtType},
        payload: command.payload,
    }
}
`;

        const commandHandlerError = writeFileSync(ctx.feFolder + '/common/aggregates/' + aggregateName + '/handlers/' + cmdHandlerName + '.ts', commandHandlerContent);

        if (commandHandlerError) {
            return commandHandlerError;
        }

        const refreshHandlerResult = refreshIndexFile(config, ctx, 'commandHandler', aggregateDir);

        if (isCodyError(refreshHandlerResult)) {
            return refreshHandlerResult;
        }

        // generate aggregate
        let importStr = `import { Handlers } from './${aggregateName}';`;

        const aggregateContent = `${COMPILE_OPTIONS.bannerComment}
import { Aggregate } from '@resolve-js/core';
${importStr}

export default {
    ${lcWord(cmdName)}: Handlers.${cmdName}Handler.commandHandler
} as Aggregate
`;

        const aggregateError = writeFileSync(ctx.feFolder + '/common/aggregates/' + aggregateName + '.commands.ts', aggregateContent);

        if (aggregateError) {
            return aggregateError;
        }

    } catch (reason) {
        return {
            cody: `I was not able to compile schema of command ${command.getName()}`,
            details: reason.toString(),
            type: CodyResponseType.Error,
        };
    }

    return {
        cody: `Wasn't easy, but command ${cmdName} should work now!`,
        details: ['%c' + successDetails, 'color: #73dd8e;font-weight: bold'],
    };
};
